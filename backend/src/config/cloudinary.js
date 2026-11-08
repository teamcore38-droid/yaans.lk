import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary SDK
function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cloudinaryUrl });
    return true;
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      secure: true
    });
    return true;
  }

  return false;
}

// Multer memory storage: direct stream to Cloudinary without writing to disk (ideal for Vercel Serverless)
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg|avif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, AVIF, and GIF images are allowed.'));
    }
  }
});

/**
 * Uploads an image buffer or file stream to Cloudinary with professional production settings:
 * - Organized folder: yaans_lk/products, yaans_lk/sellers, yaans_lk/banners
 * - Automatic WebP/AVIF format conversion (f_auto)
 * - Intelligent visual quality compression (q_auto:good)
 * - Max dimension bound (1200x1200px limit)
 * - EXIF profile strip for faster mobile loading
 */
export async function uploadToCloudinary(fileBuffer, options = {}) {
  const isConfigured = initCloudinary();
  const folder = options.folder || process.env.CLOUDINARY_FOLDER || 'yaans_lk/products';
  const customPublicId = options.publicId || `ylk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: customPublicId,
          resource_type: 'image',
          overwrite: true,
          transformation: [
            {
              width: 1200,
              height: 1200,
              crop: 'limit',
              quality: 'auto:good',
              fetch_format: 'auto',
              flags: 'strip_profile'
            }
          ]
        },
        (error, result) => {
          if (error) {
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            provider: 'cloudinary'
          });
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  // Graceful fallback for local development if Cloudinary env vars are missing
  const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (IS_SERVERLESS) {
    const mime = options.mimetype || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    return {
      url: dataUrl,
      publicId: customPublicId,
      provider: 'mongodb_inline_storage'
    };
  }

  // Local uploads folder fallback
  const uploadsDir = path.resolve(process.cwd(), 'backend/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const ext = (options.originalname && path.extname(options.originalname)) || '.jpg';
  const filename = `${customPublicId}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, fileBuffer);

  const req = options.req;
  const host = req?.get('host') || 'localhost:5000';
  const protocol = req?.protocol || 'http';

  return {
    url: `${protocol}://${host}/uploads/${filename}`,
    publicId: customPublicId,
    provider: 'local_storage'
  };
}

/**
 * Universal controller helper for Express route handlers
 */
export async function handleProductImageUpload(req) {
  if (!req.file) {
    throw new Error('No image file was provided.');
  }

  return await uploadToCloudinary(req.file.buffer, {
    folder: 'yaans_lk/products',
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    req
  });
}
