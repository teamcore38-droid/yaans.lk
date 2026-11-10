import fs from 'fs';
import path from 'path';
import dns from 'dns';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

dns.setServers(['8.8.8.8', '1.1.1.1']);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BANNER_SRC_DIR = 'D:\\yaans.lk\\yaans_banners_webp';
const PUBLIC_BANNERS_DIR = path.resolve(__dirname, '../../frontend/public/banners');

if (!fs.existsSync(PUBLIC_BANNERS_DIR)) {
  fs.mkdirSync(PUBLIC_BANNERS_DIR, { recursive: true });
}

const BANNER_CONFIGS = [
  {
    id: 'bnr_1',
    key: 'essentials',
    title: 'Sri Lankan Homemade & Everyday Essentials',
    categorySlug: 'homemade-pantry',
    ctaLink: '/products?category=homemade-pantry',
    displayOrder: 1,
    desktopFile: 'essentials-desktop.webp',
    mobileFile: 'essentials-mobile.webp'
  },
  {
    id: 'bnr_2',
    key: 'electronics',
    title: 'Electronics & Tech Accessories',
    categorySlug: 'electronics',
    ctaLink: '/products?category=electronics',
    displayOrder: 2,
    desktopFile: 'electronics-desktop.webp',
    mobileFile: 'electronics-mobile.webp'
  },
  {
    id: 'bnr_3',
    key: 'spices',
    title: 'Ceylon Spices & Local Homemade Goods',
    categorySlug: 'homemade-pantry',
    ctaLink: '/products?category=homemade-pantry',
    displayOrder: 3,
    desktopFile: 'spices-desktop.webp',
    mobileFile: 'spices-mobile.webp'
  },
  {
    id: 'bnr_4',
    key: 'fashion',
    title: 'T-Shirts, Dresses & Island Fashion',
    categorySlug: 'fashion-handloom',
    ctaLink: '/products?category=fashion-handloom',
    displayOrder: 4,
    desktopFile: 'fashion-desktop.webp',
    mobileFile: 'fashion-mobile.webp'
  },
  {
    id: 'bnr_5',
    key: 'tools',
    title: 'Tools & Home Improvement Essentials',
    categorySlug: '',
    ctaLink: '/products',
    displayOrder: 5,
    desktopFile: 'tools-desktop.webp',
    mobileFile: 'tools-mobile.webp'
  },
  {
    id: 'bnr_6',
    key: 'baby',
    title: 'Baby & Kids Products',
    categorySlug: '',
    ctaLink: '/products',
    displayOrder: 6,
    desktopFile: 'baby-desktop.webp',
    mobileFile: 'baby-mobile.webp'
  },
  {
    id: 'bnr_7',
    key: 'gifts',
    title: 'Handmade Gifts & Local Crafts',
    categorySlug: '',
    ctaLink: '/products',
    displayOrder: 7,
    desktopFile: 'gifts-desktop.webp',
    mobileFile: 'gifts-mobile.webp'
  }
];

async function uploadFile(filePath, publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        folder: 'yaans_lk/banners',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas!');

  const updatedBanners = [];

  for (const item of BANNER_CONFIGS) {
    console.log(`\nProcessing banner: ${item.title} (${item.key})`);

    const desktopSrc = path.join(BANNER_SRC_DIR, item.desktopFile);
    const mobileSrc = path.join(BANNER_SRC_DIR, item.mobileFile);

    // Copy to frontend/public/banners
    fs.copyFileSync(desktopSrc, path.join(PUBLIC_BANNERS_DIR, item.desktopFile));
    fs.copyFileSync(mobileSrc, path.join(PUBLIC_BANNERS_DIR, item.mobileFile));
    console.log(`  ✓ Copied to frontend/public/banners/`);

    // Upload desktop to Cloudinary
    const desktopPublicId = `ylk_banner_${item.key}_desktop_${Date.now()}`;
    console.log(`  Uploading desktop image (${item.desktopFile}) to Cloudinary...`);
    const desktopRes = await uploadFile(desktopSrc, desktopPublicId);
    console.log(`  ✓ Desktop CDN URL: ${desktopRes.secure_url}`);

    // Upload mobile to Cloudinary
    const mobilePublicId = `ylk_banner_${item.key}_mobile_${Date.now()}`;
    console.log(`  Uploading mobile image (${item.mobileFile}) to Cloudinary...`);
    const mobileRes = await uploadFile(mobileSrc, mobilePublicId);
    console.log(`  ✓ Mobile CDN URL: ${mobileRes.secure_url}`);

    updatedBanners.push({
      id: item.id,
      title: item.title,
      imageUrl: desktopRes.secure_url,
      mobileImageUrl: mobileRes.secure_url,
      categorySlug: item.categorySlug,
      ctaLink: item.ctaLink,
      active: true,
      displayOrder: item.displayOrder
    });
  }

  console.log('\nUpdating MongoDB Atlas platformconfigs...');
  const res = await mongoose.connection.db
    .collection('platformconfigs')
    .updateOne({}, { $set: { banners: updatedBanners } });

  console.log('MongoDB update result:', res);

  console.log('\nAll 7 banners updated successfully in MongoDB Atlas:');
  console.log(JSON.stringify(updatedBanners, null, 2));

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch((err) => {
  console.error('Error uploading banners:', err);
  process.exit(1);
});
