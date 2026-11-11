import assert from 'node:assert/strict';
import mongoose from 'mongoose';

assert.equal(process.env.NODE_ENV, 'test');
assert.match(process.env.MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1:/);
assert.equal(process.env.MONGODB_DB_NAME, 'yaans_automated_test');
assert.equal(process.env.VERCEL, '1');
const { default: app } = await import('../../src/server.js');
const db = await import('../../src/config/db.js');
await db.connectDatabase();
const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
let held;
process.on('message', async ({ id, action }) => {
  try {
    if (action === 'snapshot') held = await db.getStore({ products: true, orders: true });
    if (action === 'edit-unrelated') {
      held.products.find((p) => p._id === 'prd_test_lamp').priceLkr = 3000;
      await db.persistStore(held);
    }
    if (action === 'close') {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      process.send({ id, ok: true });
      process.disconnect();
      return;
    }
    process.send({ id, ok: true });
  } catch (error) { process.send({ id, error: error.message }); }
});
process.send({ ready: true, pid: process.pid, url: `http://127.0.0.1:${server.address().port}` });
