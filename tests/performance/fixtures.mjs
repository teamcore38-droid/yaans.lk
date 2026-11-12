import { buildTestStore } from '../support/fixtures.js';

export async function populateCapacityData(db, { products = 1000, sellers = 100, reviews = 10000, orders = 10000 } = {}) {
  if (db.databaseName !== 'yaans_automated_test' || ![products, sellers, reviews, orders].every(Number.isSafeInteger) ||
      products < 1 || products > 5000 || sellers < 1 || sellers > 500 || reviews < 0 || reviews > 50000 || orders < 0 || orders > 50000) {
    throw new Error('Capacity fixtures require the disposable test database and bounded synthetic sizes.');
  }
  const base = buildTestStore();
  const catalog = Array.from({ length: products }, (_, i) => ({ ...base.products[1],
    _id: `prd_load_${String(i).padStart(6, '0')}`, slug: `synthetic-load-product-${i}`, sku: `LOAD-${i}`,
    title: `Synthetic ${i % 2 ? 'Ceylon Spice' : 'Home Product'} ${i}`,
    description: 'Synthetic catalog entry used only for isolated capacity measurement. '.repeat(8),
    sellerId: `sel_load_${i % sellers}`, sellerSlug: `synthetic-load-seller-${i % sellers}`,
    sellerName: `Synthetic Seller ${i % sellers}`, sellerDistrict: i % 2 ? 'Colombo' : 'Kandy',
    priceLkr: 100 + (i % 50) * 100, stock: 10000, soldCount: i % 100,
    categorySlug: i % 2 ? 'homemade-pantry' : 'electronics', isHomemade: Boolean(i % 2),
    isFeatured: i % 3 === 0, isDeal: i % 5 === 0, compareAtPriceLkr: i % 7 === 0 ? 10000 : null,
    rating: 3 + (i % 20) / 10, approvalStatus: i % 17 === 0 ? 'pending' : 'approved',
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString()
  }));
  await db.collection('sellers').insertMany(Array.from({ length: sellers }, (_, i) => ({ ...base.sellers[i % 2],
    _id: `sel_load_${i}`, userId: `usr_load_seller_${i}`, slug: `synthetic-load-seller-${i}`,
    storeName: `Synthetic Seller ${i}`, status: i % 19 === 0 ? 'suspended' : 'approved'
  })));
  await db.collection('products').insertMany(catalog);
  if (reviews) await db.collection('reviews').insertMany(Array.from({ length: reviews }, (_, i) => ({
    _id: `rev_load_${i}`, productId: i % 2 ? 'prd_test_spice' : catalog[i % products]._id,
    customerName: 'Synthetic Reviewer', district: 'Colombo', rating: 4, title: 'Synthetic review',
    comment: 'Synthetic review for capacity testing. '.repeat(6), verifiedPurchase: true,
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString()
  })));
  if (orders) {
    const historical = Array.from({ length: orders }, (_, i) => ({
      _id: `ord_load_history_${i}`, orderNumber: `YLK-HISTORY-${i}`, userId: `usr_load_customer_${i % 100}`,
      isGuestOrder: false, customerEmail: `history-${i % 100}@test.yaans.invalid`, customerPhone: '0771234567',
      shippingAddress: { recipientName: 'Synthetic History', phone: '0771234567', addressLine1: 'Test data only', city: 'Colombo', district: 'Colombo' },
      items: [], subOrderIds: [`sub_load_history_${i}`], sellerCount: 1, itemsSubtotalLkr: 1000,
      totalDeliveryFeeLkr: 350, grandTotalLkr: 1350, paymentMethod: 'COD', codConfirmedByCustomer: true,
      overallStatus: 'delivered', createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString()
    }));
    await db.collection('orders').insertMany(historical);
    await db.collection('suborders').insertMany(historical.map((order, i) => ({
      _id: order.subOrderIds[0], subOrderNumber: `${order.orderNumber}-S1`, parentOrderId: order._id,
      parentOrderNumber: order.orderNumber, sellerId: `sel_load_${i % sellers}`, sellerName: `Synthetic Seller ${i % sellers}`,
      customerName: 'Synthetic History', customerPhone: order.customerPhone, shippingAddress: order.shippingAddress,
      items: [], itemsSubtotalLkr: 1000, deliveryFeeLkr: 350, grossTotalLkr: 1350, commissionRatePercent: 8,
      commissionAmountLkr: 80, netSellerEarningsLkr: 920, paymentMethod: 'COD', codCollectionStatus: 'pending_collection',
      fulfillmentStatus: 'delivered', settlementStatus: 'unsettled', statusHistory: [], createdAt: order.createdAt
    })));
  }
  await db.collection('products').updateOne({ _id: 'prd_test_spice' }, { $set: {
    stock: 100000, 'variants.0.values.0.stock': 50000, 'variants.0.values.1.stock': 50000
  } });
  return { products: products + base.products.length, sellers: sellers + base.sellers.length, reviews, orders, subOrders: orders };
}
