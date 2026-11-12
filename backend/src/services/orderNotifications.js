import mongoose from 'mongoose';

// Stored in the checkout transaction: failed checkouts and retries never emit alerts.
export async function saveOrderNotifications(order, subOrders, session) {
  const db = mongoose.connection.db;
  const admins = await db.collection('users').find({ role: { $in: ['admin', 'staff'] }, isActive: { $ne: false } },
    { session, projection: { _id: 1, role: 1 } }).toArray();
  const summary = (items) => items.map(({ title, quantity }) => ({ title, quantity }));
  const entries = [
    ...admins.map((admin) => ({ recipient: `${admin.role}:${admin._id}`, orderNumber: order.orderNumber,
      items: summary(order.items), totalLkr: order.grandTotalLkr })),
    ...subOrders.map((sub) => ({ recipient: `seller:${sub.sellerId}`, orderNumber: sub.subOrderNumber,
      items: summary(sub.items), totalLkr: sub.grossTotalLkr }))
  ];
  if (entries.length) await db.collection('ordernotifications').insertMany(entries.map((entry) => ({
    ...entry, _id: `${order._id}:${entry.recipient}`, createdAt: new Date(order.createdAt), readAt: null
  })), { session });
}
