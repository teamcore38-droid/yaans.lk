import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import {
  connectDatabase,
  refreshStoreIfNeeded,
  syncStoreToMongo
} from './config/db.js';
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

// Ensure DB connection is ready and sync mutations to MongoDB Atlas before completing response
app.use('/api', async (req, res, next) => {
  try {
    await connectDatabase();
    if (req.method === 'GET') {
      await refreshStoreIfNeeded();
    } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const origJson = res.json.bind(res);
      res.json = (body) => {
        syncStoreToMongo()
          .catch(() => {})
          .finally(() => {
            origJson(body);
          });
        return res;
      };
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Serve local uploaded images when running in local development
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check
app.get('/api/health', async (_req, res) => {
  const dbInfo = await connectDatabase();
  res.json({
    status: 'ok',
    platform: 'Yaans.lk Sri Lankan Multi-Vendor Marketplace API',
    database: dbInfo.storePath,
    mongoConnected: dbInfo.isMongoConnected,
    currency: 'LKR (Rs.)',
    taxCalculation: 'disabled',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Yaans.lk API Error]:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
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
