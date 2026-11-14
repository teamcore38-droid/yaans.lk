import { DEFAULT_BUSINESS_SETTINGS } from '../../../shared/businessSettings.js';
import { createRouter } from '../config/router.js';
import { getStore, persistStore, generateId, idFilter, withTransaction, MODEL_MAP } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { stringField } from '../config/inputValidation.js';
import { httpError } from '../config/errors.js';
import { catalogHome, catalogSettings, catalogCategories, catalogProducts, catalogProduct, catalogSeller } from '../services/catalog.js';

const router = createRouter();

router.get('/home', async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(await catalogHome());
});

router.get('/districts', async (_req, res) => {
  const config = await catalogSettings();
  res.json({ businessSettings: config.businessSettings, districts: config.districts, codEnabledGlobally: config.codEnabledGlobally,
    globalFreeShippingMinLkr: config.globalFreeShippingMinLkr,
    shippingMode: config.shippingMode || 'custom', flatShippingRateLkr: config.flatShippingRateLkr ?? 350 });
});

router.get('/policies/:version', async(req,res)=>{
  if(!/^(0|[1-9][0-9]{0,8})$/.test(req.params.version))throw httpError(400,'Invalid policy version.');
  const version=Number(req.params.version);
  const document=await mongoose.connection.db.collection('businesspublications').findOne({_id:version},{projection:{settings:1,effectiveAt:1},maxTimeMS:3000});
  if(!document&&version!==0)throw httpError(404,'Published policy not found.');
  res.set('Cache-Control','public, max-age=60');
  res.json({version,settings:document?.settings||DEFAULT_BUSINESS_SETTINGS,effectiveAt:document?.effectiveAt||null});
});

router.get('/categories', async (_req, res) => { const [categories,config] = await Promise.all([catalogCategories(),catalogSettings()]); res.json({ categories, businessSettings: config.businessSettings, businessVersion: config.businessVersion || 0, businessEffectiveAt: config.businessEffectiveAt || null, codEnabledGlobally: config.codEnabledGlobally !== false, commissionRates: {standard:config.defaultCommissionPercent ?? 8,homemade:config.homemadeCommissionPercent ?? 5} }); });
router.get('/products', async (req, res) => res.json(await catalogProducts(req.query)));
router.get('/products/:idOrSlug', async (req, res) => res.json(await catalogProduct(req.params.idOrSlug, req.query)));

// POST /api/marketplace/products/:productId/reviews
router.post('/products/:productId/reviews', authenticate, requireRole('customer'), sharedRateLimit('review-user',5,86400000,req=>req.user._id), async (req, res) => {
  const { productId } = req.params;
  const title=stringField(req.body.title,'Review headline',{maximum:160});
  const comment=stringField(req.body.comment,'Review comment',{required:true,maximum:3000});
  const district=stringField(req.body.district??req.user.defaultDistrict??'Colombo','District',{maximum:80});
  const rating=req.body.rating;
  if(!Number.isInteger(rating)||rating<1||rating>5)throw httpError(400,'Choose a whole-number rating between 1 and 5.');
  try {
    const result=await withTransaction(async session=>{
      const store=await getStore({products:idFilter(productId),reviews:{productId,userId:req.user._id}},{session});
      const product=store.products[0];
      if(!product||product.approvalStatus!=='approved')throw httpError(404,'Product not found.');
      if(store.reviews.length)throw httpError(409,'You have already reviewed this product.');
      const [purchase]=await MODEL_MAP.orders.collection.aggregate([
        {$match:{userId:req.user._id,'items.productId':product._id}},
        {$lookup:{from:'suborders',let:{parent:{$toString:'$_id'}},pipeline:[{$match:{$expr:{$eq:['$parentOrderId','$$parent']},fulfillmentStatus:'delivered','items.productId':product._id}},{$limit:1}],as:'deliveredPackages'}},
        {$match:{'deliveredPackages.0':{$exists:true}}},{$project:{_id:1}},{$limit:1}
      ],{session,maxTimeMS:3000}).toArray();
      if(!purchase)throw httpError(403,'Reviews require a delivered purchase from your signed-in account.');
      const claim=createHash('sha256').update(JSON.stringify([product._id,req.user._id])).digest('hex');
      await mongoose.connection.db.collection('reviewclaims').insertOne({_id:claim,productId:product._id,userId:req.user._id},{session});
      const review={_id:generateId('rev'),productId:product._id,userId:req.user._id,customerName:req.user.name,district,rating,title,comment,
        verifiedPurchase:true,purchaseOrderId:String(purchase._id),purchaseVerifiedAt:new Date().toISOString(),createdAt:new Date().toISOString()};
      store.reviews.push(review);await persistStore(store);
      const [stats]=await MODEL_MAP.reviews.collection.aggregate([{$match:{productId:product._id}},{$group:{_id:null,rating:{$avg:'$rating'},count:{$sum:1}}}],{session}).toArray();
      const productRating=Number(stats.rating.toFixed(1));
      await MODEL_MAP.products.collection.updateOne(idFilter(product._id),{$set:{rating:productRating,reviewCount:stats.count},$inc:{_writeVersion:1}},{session});
      const {userId,purchaseOrderId,purchaseVerifiedAt,...publicReview}=review;
      return {review:publicReview,productRating,reviewCount:stats.count};
    });
    return res.status(201).json(result);
  }catch(error){if(error.code===11000)throw httpError(409,'You have already reviewed this product.');throw error;}
});

router.get('/sellers/:slugOrId', async (req, res) => res.json(await catalogSeller(req.params.slugOrId, req.query)));

export default router;
