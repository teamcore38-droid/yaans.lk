import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { httpError } from './errors.js';

// Initialize Cloudinary SDK
function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (cloudinaryUrl) {
    const url=new URL(cloudinaryUrl);
    if(url.protocol!=='cloudinary:')throw httpError(503,'Image storage is not configured securely.');
    cloudinary.config({cloud_name:url.hostname,api_key:decodeURIComponent(url.username),api_secret:decodeURIComponent(url.password),secure:true});
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
  limits: { fileSize: 4 * 1024 * 1024, files:1, fields:0, parts:1, fieldNameSize:40, fieldSize:1024, fieldNestingDepth:0, headerPairs:20 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg|avif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(httpError(415,'Only JPG, PNG, WebP, AVIF, and GIF images are allowed.'));
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
  const bytes=fileBuffer;
  if(!Buffer.isBuffer(bytes))throw httpError(415,'The uploaded file is not a supported image.');
  const jpeg=bytes?.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes?.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const gif=['GIF87a','GIF89a'].includes(bytes?.subarray(0,6).toString('ascii'));
  const webp=bytes?.subarray(0,4).toString('ascii')==='RIFF'&&bytes?.subarray(8,12).toString('ascii')==='WEBP';
  const avif=bytes?.length>=16&&bytes.subarray(4,8).toString('ascii')==='ftyp'&&['avif','avis'].includes(bytes.subarray(8,12).toString('ascii'));
  if(!Buffer.isBuffer(bytes)||bytes.length>4*1024*1024||!(jpeg||png||gif||webp||avif))throw httpError(415,'The uploaded file is not a supported image.');
  const isConfigured = initCloudinary();
  const requestedFolder = options.folder || process.env.CLOUDINARY_FOLDER || 'yaans_lk/products';
  const folder = process.env.APP_ENV === 'staging' ? requestedFolder.replace(/^yaans_lk\//, 'yaans_staging/') : requestedFolder;
  const customPublicId = `ylk_${randomUUID()}`;

  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: customPublicId,
          resource_type: 'image',
          overwrite: false,
          allowed_formats:['jpg','jpeg','png','webp','gif','avif'],
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
            return reject(httpError(502,'Image storage could not process the upload. Please try again.'));
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

  throw httpError(503,'Image storage is unavailable. Please try again after configuration is restored.');
}

/**
 * Universal controller helper for Express route handlers
 */
export async function handleProductImageUpload(req) {
  if (!req.file) {
    throw httpError(400,'No image file was provided.');
  }

  return await uploadToCloudinary(req.file.buffer, {
    folder: 'yaans_lk/products',
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    req
  });
}
