import { isOwner, isCoAdmin, hasAdminPermission } from '../../../shared/adminAccess.js';
import { stringField } from '../config/inputValidation.js';
import { httpError } from '../config/errors.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
const rules=[
 ['GET',/^\/operations$/,null],['GET',/^\/operation-requests$/, 'orders'],['POST',/^\/operation-requests$/, 'orders'],
 ['GET',/^\/orders\/[^/]+$/, 'orders'],
 ['GET',/^\/banners$/, 'merchandising'],['POST',/^\/banners$/, 'merchandising'],['PUT',/^\/banners\/[^/]+$/, 'merchandising'],['DELETE',/^\/banners\/[^/]+$/, 'merchandising'],
 ['PUT',/^\/config\/banners$/, 'merchandising'],['POST',/^\/categories$/, 'merchandising'],['PUT',/^\/categories\/[^/]+$/, 'merchandising'],
 ['PUT',/^\/sellers\/[^/]+\/status$/, 'sellers'],['PUT',/^\/products\/[^/]+(?:\/moderation)?$/, 'products'],
 ['POST',/^\/product-image$/, 'products'],['POST',/^\/upload-image$/, 'merchandising']
];
export async function authorizeAdminRoute(req,res,next){
 try{
  res.set('Cache-Control','private, no-store');
  if(isOwner(req.user))return next();
  const rule=rules.find(([method,path])=>method===req.method&&path.test(req.path));
  if(!isCoAdmin(req.user)||!rule||(rule[2]&&!hasAdminPermission(req.user,rule[2])))throw httpError(403,'This operation requires owner access or an assigned permission.');
  if(req.path.startsWith('/sellers/')){
    if(Object.keys(req.body).some(k=>!['status','rejectionReason'].includes(k)))throw httpError(403,'Seller financial and identity settings are owner-controlled.');
    if(!['approved','rejected','suspended','pending'].includes(req.body.status)||typeof req.body.rejectionReason!=='string'||!req.body.rejectionReason.trim()||req.body.rejectionReason.length>500)throw httpError(400,'Select a valid status and provide a review reason (up to 500 characters).');
  }
  if(req.path.startsWith('/products/')){
    const allowed=['revision','title','sku','categorySlug','subCategorySlug','description','highlights','images','isHomemade','isFeatured','isDeal','codEligible','approvalStatus','tags'];
    if(hasAdminPermission(req.user,'productPricing'))allowed.push('priceLkr','compareAtPriceLkr');
    if(hasAdminPermission(req.user,'productStock'))allowed.push('stock');
    if(Object.keys(req.body).some(k=>!allowed.includes(k)))throw httpError(403,'Product price, stock or other restricted fields are not permitted.');
    if(req.body.approvalStatus!==undefined&&!['pending','approved','rejected'].includes(req.body.approvalStatus))throw httpError(400,'Invalid listing status.');
    for(const [key,maximum] of Object.entries({title:200,sku:120,description:10000,categorySlug:80,subCategorySlug:80,adminNote:1000}))if(req.body[key]!==undefined)stringField(req.body[key],key,{required:['title','sku'].includes(key),maximum});
    for(const key of ['isHomemade','isFeatured','isDeal','codEligible'])if(req.body[key]!==undefined&&typeof req.body[key]!=='boolean')throw httpError(400,'Invalid product flag.');
    for(const key of ['highlights','tags'])if(req.body[key]!==undefined&&(!Array.isArray(req.body[key])||req.body[key].length>20||req.body[key].some(value=>typeof value!=='string'||value.length>300)))throw httpError(400,'Invalid product content.');
    for(const key of ['priceLkr','stock','compareAtPriceLkr'])if(req.body[key]!==undefined&&!(key==='compareAtPriceLkr'&&req.body[key]===null)&&(typeof req.body[key]!=='number'||!Number.isFinite(req.body[key])||req.body[key]<(key==='stock'?0:0.01)||(key==='stock'&&!Number.isSafeInteger(req.body[key]))))throw httpError(400,'Invalid product amount.');
  }
  if(req.path.startsWith('/categories')){
    if(Object.keys(req.body).some(key=>!['name','quadHeadline','description','imageUrl','displayOrder','showInQuadGrid','subCategories'].includes(key)))throw httpError(400,'Unsupported department field.');
    for(const key of ['name','quadHeadline','description','imageUrl'])if(req.body[key]!==undefined)stringField(req.body[key],key,{required:['name','quadHeadline'].includes(key),maximum:key==='description'?3000:key==='imageUrl'?2048:160});
    if(req.body.displayOrder!==undefined&&(!Number.isSafeInteger(req.body.displayOrder)||Math.abs(req.body.displayOrder)>10000))throw httpError(400,'Invalid department order.');
    if(req.body.showInQuadGrid!==undefined&&typeof req.body.showInQuadGrid!=='boolean')throw httpError(400,'Invalid department visibility.');
    if(req.body.subCategories!==undefined){
      if(!Array.isArray(req.body.subCategories)||req.body.subCategories.length>30)throw httpError(400,'Invalid subcategories.');
      for(const sub of req.body.subCategories){if(!sub||typeof sub!=='object'||Array.isArray(sub))throw httpError(400,'Invalid subcategory.');for(const key of ['name','slug','imageUrl','bgTint'])if(sub[key]!==undefined)stringField(sub[key],key,{maximum:key==='imageUrl'?2048:160});}
    }
  }
  if(!['GET','HEAD'].includes(req.method)){
    // Await a durable, redacted intent event before executing the mutation.
    const mongoose=(await import('mongoose')).default;
    await mongoose.connection.db.collection('securityevents').insertOne({event:'coadmin_operation',userId:String(req.user._id),role:'admin',outcome:'requested',method:req.method,path:req.path,createdAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)},{maxTimeMS:3000});
  }
  const json=res.json.bind(res);
  res.json=body=>{
    if(body?.seller){const {bankDetails,nicOrBrNumber,commissionRateOverride,...safe}=body.seller;body={...body,seller:safe};}
    return json(body);
  };
  next();
 }catch(error){await recordSecurityEvent('coadmin_access_denied',{userId:req.user?._id,role:req.user?.role,ip:req.ip,outcome:'denied'});next(error);}
}
