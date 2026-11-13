import documentRoutes from './routes/documentRoutes.js';
import staffProductRoutes from './routes/staffProductRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import staffAdminRoutes from './routes/staffAdminRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createHash, timingSafeEqual } from 'node:crypto';

import { connectDatabase, pingDatabase } from './config/db.js';
import notificationRoutes from './routes/notificationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { operationalStatus, recordOperationalEvent } from './config/operations.js';
import { corsOrigin } from './config/origins.js';
import { recordSecurityEvent } from './config/securityEvents.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Vercel overwrites the forwarded client IP. Direct local deployments do not
// trust caller-supplied forwarding headers.
app.set('trust proxy', process.env.VERCEL ? 1 : false);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives:{defaultSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'none'"]} }
  })
);
app.use(compression());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit:'64kb', parameterLimit:100 }));
app.use('/api',(req,_res,next)=>{
  if(['POST','PUT','PATCH'].includes(req.method)&&req.is('application/json')&&(!req.body||typeof req.body!=='object'||Array.isArray(req.body)))return next(Object.assign(new Error('A JSON object is required.'),{status:400}));
  next();
});

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
    environment: process.env.APP_ENV === 'staging' ? 'staging' : 'production',
    revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
    platform: 'Yaans.lk Sri Lankan Multi-Vendor Marketplace API',
    mongoConnected: true,
    writesEnabled: process.env.MAINTENANCE_READ_ONLY !== 'true',
    currency: 'LKR (Rs.)',
    taxCalculation: 'disabled',
    timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

app.get('/api/operations/status', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const secret = process.env.MONITORING_TOKEN;
  const provided = req.headers.authorization || '';
  if (!secret || secret.length < 32 || !timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(`Bearer ${secret}`).digest())) {
    return res.status(401).json({ message: 'Monitoring authentication required.' });
  }
  try { res.json(await operationalStatus()); } catch (error) { next(error); }
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin/staff', staffAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff/products', staffProductRoutes);
app.use('/api/staff', staffRoutes);

// Global error handler
app.use(async (err, _req, res, _next) => {
  const status = err.status || (err.name==='MulterError' ? (/SIZE|COUNT|LIMIT_PART/.test(err.code)?413:400) : err.code === 11000 ? 409 : /Mongo|Mongoose/.test(err.name) ? 503 : 500);
  if (status >= 500) {
    console.error('[Yaans.lk API Error]', { status, name: err.name, code: err.code });
    await recordOperationalEvent(/Mongo|Mongoose/.test(err.name) ? 'database_error' : 'server_error');
  }
  if(status===403)await recordSecurityEvent('request_denied',{ip:_req.ip,userId:_req.user?._id,role:_req.user?.role,outcome:'denied'});
  res.status(status).json({ message: err.name==='MulterError'?'The upload exceeds the permitted file, field or nesting limits.':err.status ? err.message : status === 409 ? 'A record with these details already exists.' : 'The request could not be saved. Please try again.', ...(['WRITE_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code) ? { code: err.code } : {}) });
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
