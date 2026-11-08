import dotenv from 'dotenv';
import { connectDatabase, seedMongoDatabase } from '../config/db.js';

dotenv.config();

async function runSeed() {
  console.log('Seeding Yaans.lk Marketplace database...');
  await connectDatabase();
  await seedMongoDatabase();
  console.log('Yaans.lk Marketplace seed complete!');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
