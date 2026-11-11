import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDatabase, pingDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
  })
);
app.use(compression());
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API protection
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// A reversible read-only window lets old deployments drain during a persistence
// cutover. Quotes are read-only; every account/order/admin mutation is held.
app.use('/api', (req, res, next) => {
  if (process.env.MAINTENANCE_READ_ONLY === 'true' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path !== '/orders/quote') {
    return res.status(503).json({ code: 'MAINTENANCE', message: 'Orders and account changes are temporarily paused for a secure update. Please retry shortly.' });
  }
  next();
});

// Routes explicitly await their own durable writes; never patch response methods.
app.use('/api', async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

// Serve local uploaded images when running in local development
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check
app.get('/api/health', async (_req, res, next) => {
  try {
    await pingDatabase();
    res.json({
    status: 'ok',
    platform: 'Yaans.lk Sri Lankan Multi-Vendor Marketplace API',
    mongoConnected: true,
    writesEnabled: process.env.MAINTENANCE_READ_ONLY !== 'true',
    currency: 'LKR (Rs.)',
    taxCalculation: 'disabled',
    timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 11000 ? 409 : /Mongo|Mongoose/.test(err.name) ? 503 : 500);
  if (status >= 500) console.error('[Yaans.lk API Error]', { status, name: err.name, code: err.code });
  res.status(status).json({ message: err.status ? err.message : status === 409 ? 'A record with these details already exists.' : 'The request could not be saved. Please try again.', ...(['WRITE_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code) ? { code: err.code } : {}) });
});

// Only listen on local TCP port when not imported as a Vercel Serverless Function
if (!process.env.VERCEL) {
  connectDatabase().then((dbInfo) => {
    app.listen(PORT, () => {
      console.log(`============================================================`);
      console.log(`  Yaans.lk Marketplace Backend running on http://localhost:${PORT}`);
      console.log(`  Data Store: ${dbInfo.storePath}`);
      console.log(`============================================================`);
    });
  });
}

export default app;
