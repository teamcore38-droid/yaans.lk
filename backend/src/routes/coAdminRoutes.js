import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getStore, persistStore, generateId, idFilter, withTransaction } from '../config/db.js';
import { validateAuthBody, validateNewPassword, stringField } from '../config/inputValidation.js';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { createMfaChallenge, verifyMfaLogin } from '../services/adminMfa.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { httpError } from '../config/errors.js';
import { ADMIN_PERMISSIONS, OPERATIONS_PRESET } from '../../../shared/adminAccess.js';
const router=createRouter();
router.use(authenticate,requireRole('admin'));
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/',async(req,res)=>{
  const after=stringField(req.query.after,'Cursor',{maximum:128});
  const rows=await mongoose.connection.db.collection('users').find({role:'admin',adminAccess:'coadmin',...(after?{_id:{$gt:after}}:{})},{projection:{_id:1,name:1,email:1,phone:1,isActive:1,adminPermissions:1,adminMustChangePassword:1,'adminMfa.enabled':1,createdAt:1},maxTimeMS:3000}).sort({_id:1}).limit(26).toArray();
  res.json({coadmins:rows.slice(0,25).map(({adminMfa,...user})=>({...user,mfaEnabled:adminMfa?.enabled===true})),nextCursor:rows.length>25?String(rows[24]._id):null,permissions:ADMIN_PERMISSIONS,preset:OPERATIONS_PRESET});
});
router.use(sharedRateLimit('coadmin-management',10,15*60000,req=>req.user._id),validateAuthBody);
router.use(async(req,_res,next)=>{
 try {
  if(!req.body.currentPassword||!await bcrypt.compare(req.body.currentPassword,req.user.passwordHash))throw httpError(401,'Your current owner password is required.');
  await verifyMfaLogin(createMfaChallenge(req.user),req.body.code);
  next();
 } catch(error) { next(error); }
});
function permissions(value=OPERATIONS_PRESET){
  if(!Array.isArray(value)||value.length>Object.keys(ADMIN_PERMISSIONS).length||value.some(p=>typeof p!=='string'||!Object.hasOwn(ADMIN_PERMISSIONS,p))||new Set(value).size!==value.length)throw httpError(400,'Invalid administrator permissions.');
  return [...value];
}
router.post('/',async(req,res)=>{
  const name=stringField(req.body.name,'Name',{required:true,maximum:120});
  const email=stringField(req.body.email,'Email',{required:true,maximum:254}).toLowerCase();
  const phone=stringField(req.body.phone,'Phone',{required:true,maximum:32});
  validateNewPassword(req.body.password);const hash=await bcrypt.hash(req.body.password,12);const allowed=permissions(req.body.permissions);
  const account=await withTransaction(async session=>{
    const store=await getStore({users:{email},platformConfig:true},{session});
    if(store.users.length)throw httpError(409,'An account already uses this email.');
    const user={_id:generateId('usr_coadmin'),name,email,phone,passwordHash:hash,role:'admin',adminAccess:'coadmin',adminPermissions:allowed,adminMustChangePassword:true,adminInvitationExpiresAt:new Date(Date.now()+48*3600000).toISOString(),isActive:true,tokenVersion:0,createdAt:new Date().toISOString()};
    store.users.push(user);recordAdminAuditLog(store,{action:'coadmin_created',adminId:req.user._id,adminEmail:req.user.email,ip:req.ip,metadata:{targetId:user._id,permissions:allowed}});await persistStore(store);return user;
  });
  res.status(201).json({id:account._id,message:'Co-admin created. Share the temporary password privately; it expires in 48 hours. Password change and authenticator enrollment are required.'});
});
router.patch('/:id',async(req,res)=>{
  stringField(req.params.id,'Account ID',{required:true,maximum:128});
  const allowed=req.body.permissions===undefined?undefined:permissions(req.body.permissions);
  if(req.body.isActive!==undefined&&typeof req.body.isActive!=='boolean')throw httpError(400,'Invalid account status.');
  if(req.body.resetSecurity!==undefined&&req.body.resetSecurity!==true)throw httpError(400,'Invalid security reset.');
  let hash;if(req.body.resetSecurity){validateNewPassword(req.body.newPassword);hash=await bcrypt.hash(req.body.newPassword,12);}
  await withTransaction(async session=>{
    const store=await getStore({users:{$and:[idFilter(req.params.id),{role:'admin',adminAccess:'coadmin'}]},platformConfig:true},{session});
    const user=store.users[0];if(!user)throw httpError(404,'Co-admin not found.');
    if(allowed!==undefined)user.adminPermissions=allowed;
    if(req.body.isActive!==undefined)user.isActive=req.body.isActive;
    if(hash){user.passwordHash=hash;user.adminMfa=null;delete user.adminMfaPending;user.adminMustChangePassword=true;user.adminInvitationExpiresAt=new Date(Date.now()+48*3600000).toISOString();}
    user.tokenVersion=(user.tokenVersion||0)+1;
    recordAdminAuditLog(store,{action:hash?'coadmin_security_reset':'coadmin_access_changed',adminId:req.user._id,adminEmail:req.user.email,ip:req.ip,metadata:{targetId:user._id,permissions:user.adminPermissions,isActive:user.isActive}});await persistStore(store);
  });
  res.json({message:'Co-admin access updated. Existing sessions have been revoked.'});
});
export default router;
