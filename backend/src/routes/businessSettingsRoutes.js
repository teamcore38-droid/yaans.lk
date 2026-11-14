import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getStore, persistStore, withTransaction, idFilter } from '../config/db.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { httpError } from '../config/errors.js';
import { businessSettings, validateBusinessSettings, validateSellerShipping } from '../services/businessSettings.js';
const router = createRouter();
router.use(authenticate, requireRole('admin'));
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/', async (_req,res)=>{
  const {platformConfig:config}=await getStore({platformConfig:true});
  res.json({settings:businessSettings(config),draft:config.businessDraft || businessSettings(config),revision:config.businessRevision||0,version:config.businessVersion||0,hasDraft:Boolean(config.businessDraft),history:(config.businessHistory||[]).map(({version,effectiveAt,actorId})=>({version,effectiveAt,actorId}))});
});
router.use(sharedRateLimit('business-settings',15,15*60000,req=>req.user._id));
router.use(async(req,_res,next)=>{
  try{if(typeof req.body?.currentPassword!=='string'||req.body.currentPassword.length>256||!req.user.passwordHash||!await bcrypt.compare(req.body.currentPassword,req.user.passwordHash))throw httpError(401,'Your current administrator password is required.');next();}catch(error){next(error);}
});
async function update(req,publish){
  return withTransaction(async session=>{
    const store=await getStore({platformConfig:true},{session}),config=store.platformConfig;
    if(!Number.isSafeInteger(req.body.revision)||req.body.revision!==(config.businessRevision||0))throw httpError(409,'Settings changed. Reload before saving.');
    if(publish){
      if(!config.businessDraft)throw httpError(400,'Save a draft before publishing.');
      const settings=validateBusinessSettings(config.businessDraft);
      const removed = businessSettings(config).references.sellerTypes.filter(type=>!settings.references.sellerTypes.some(next=>next.name===type.name)).map(type=>type.name);
      if(removed.length && await mongoose.connection.db.collection('sellers').findOne({sellerType:{$in:removed}},{session,projection:{_id:1}})) throw httpError(400,'Retire a seller type by disabling it instead of removing a type used by sellers.');
      const current={version:config.businessVersion||0,effectiveAt:config.businessEffectiveAt||null,settings:businessSettings(config)};
      await mongoose.connection.db.collection('businesspublications').updateOne({_id:current.version},{$setOnInsert:{settings:current.settings,effectiveAt:current.effectiveAt}},{upsert:true,session});
      config.businessHistory=[...(config.businessHistory||[]),{version:current.version,effectiveAt:current.effectiveAt,actorId:req.user._id}].slice(-10);
      config.businessSettings=settings;config.businessVersion=(config.businessVersion||0)+1;config.businessEffectiveAt=new Date().toISOString();
      await mongoose.connection.db.collection('businesspublications').insertOne({_id:config.businessVersion,settings,effectiveAt:config.businessEffectiveAt},{session});
    }else config.businessDraft=validateBusinessSettings(req.body.settings);
    config.businessRevision=(config.businessRevision||0)+1;
    recordAdminAuditLog(store,{action:publish?'BUSINESS_SETTINGS_PUBLISHED':'BUSINESS_SETTINGS_DRAFT_SAVED',adminId:req.user._id,adminEmail:req.user.email,ip:req.ip,metadata:{version:config.businessVersion||0,revision:config.businessRevision}});
    await persistStore(store);
    return {revision:config.businessRevision,version:config.businessVersion||0,message:publish?'Business settings published.':'Draft saved. Public settings are unchanged.'};
  });
}
router.put('/draft',async(req,res)=>res.json(await update(req,false)));
router.post('/publish',async(req,res)=>res.json(await update(req,true)));
router.post('/restore',async(req,res)=>{
  const store=await getStore({platformConfig:true});
  if(!Number.isSafeInteger(req.body.version))throw httpError(400,'Invalid history version.');
  const previous=await mongoose.connection.db.collection('businesspublications').findOne({_id:req.body.version},{maxTimeMS:3000}) || (store.platformConfig.businessHistory||[]).find(item=>item.version===req.body.version);
  if(!previous)throw httpError(404,'Published version not found.');
  req.body.settings=previous.settings;res.json(await update(req,false));
});
router.patch('/sellers/:id/shipping',async(req,res)=>{
  const store=await getStore({sellers:idFilter(req.params.id),platformConfig:true});
  const seller=store.sellers[0];if(!seller)throw httpError(404,'Seller not found.');
  validateSellerShipping(req.body.shippingPolicy,businessSettings(store.platformConfig));
  seller.shippingPolicy={...seller.shippingPolicy,...req.body.shippingPolicy};
  recordAdminAuditLog(store,{action:'SELLER_SHIPPING_OVERRIDE',adminId:req.user._id,adminEmail:req.user.email,ip:req.ip,metadata:{sellerId:seller._id}});
  await persistStore(store);res.json({message:'Seller shipping policy updated.'});
});
export default router;
