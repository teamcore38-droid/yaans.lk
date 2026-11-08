import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOADS_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'yaans_lk_uploads')
  : path.resolve(__dirname, '../../uploads');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (_err) {
  // Ignore on read-only containers
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
    } catch (_e) {
      // ignore
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = `ylk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, safeName);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB max (Vercel serverless body limit safe)
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP product images are allowed.'));
    }
  }
});

/**
 * Uploads image to Cloudinary with automatic optimization (`f_auto,q_auto`) when credentials are set,
 * or converts to a persistent Data URI on serverless / local `/uploads` in development.
 */
export async function uploadProductImage(filePath, req) {
  const hasCloudinary =
    Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    Boolean(process.env.CLOUDINARY_API_SECRET);

  if (hasCloudinary) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const result = await cloudinary.uploader.upload(filePath, {
      folder: process.env.CLOUDINARY_FOLDER || 'yaans_lk/products',
      transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
    });

    try {
      fs.unlinkSync(filePath);
    } catch (_e) {
      // ignore
    }

    return {
      url: result.secure_url,
      provider: 'cloudinary',
      publicId: result.public_id
    };
  }

  // If running on Vercel Serverless without Cloudinary keys, return inline base64 Data URI so it persists in MongoDB Atlas
  if (IS_SERVERLESS) {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'jpeg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    try {
      fs.unlinkSync(filePath);
    } catch (_e) {
      // ignore
    }
    return {
      url: dataUrl,
      provider: 'mongodb_inline_storage',
      publicId: path.basename(filePath)
    };
  }

  // Local dev fallback URL
  const filename = path.basename(filePath);
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.protocol || 'http';
  return {
    url: `${protocol}://${host}/uploads/${filename}`,
    provider: 'local_storage',
    publicId: filename
  };
}
