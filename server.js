import { saveSkuOptions } from './sku-options.js';
import sharp from 'sharp';
import { assertRevision } from './concurrency.js';
import { assertSkuAvailable, normalizeSku, productVariants } from './catalog.js';
import { installTranslations } from './translations.js';
import { installCommerce } from './commerce-api.js';
import { decorateProduct, verifyTotp, movement, audit, transact, expireOrders, useMfa } from './commerce-store.js';
import { installSeo } from './seo.js';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openStore, hashPassword, checkPassword, readProduct, defaultEditorial } from './store.js';
import { navigationValid } from './navigation.js';
import { permissionsFor, publicUser, adminGate } from './access.js';
import { installAdminApi } from './admin-api.js';
const str=(v,max=500)=>typeof v==='string'&&v.length<=max;
const integer=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const safeImage=v=>str(v,2000)&&(v===''||/^\/(?!\/)[\w./-]+$/.test(v)||/^https:\/\/[^\s]+$/.test(v));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).sort().join() === [...keys].sort().join();
const productDetailsValid = details => {
 if (!record(details)) return false;
 const strings = { sku: 100, summary: 500, material: 300, dimensions: 300, capacity: 200, color: 100, care: 2000, badge: 60 };
 const keys = [...Object.keys(strings), 'features', 'specifications', 'gallery', 'is_sample'];
 if (Object.keys(details).some(key => !keys.includes(key))) return false;
 for (const [key, limit] of Object.entries(strings)) if (Object.hasOwn(details, key) && !str(details[key], limit)) return false;
 if (Object.hasOwn(details, 'features') && (!Array.isArray(details.features) || details.features.length > 20 || !details.features.every(value => str(value, 500)))) return false;
 if (Object.hasOwn(details, 'specifications') && (!Array.isArray(details.specifications) || details.specifications.length > 24 || !details.specifications.every(value => exactKeys(value, ['label', 'value']) && str(value.label, 100) && str(value.value, 500)))) return false;
 if (Object.hasOwn(details, 'gallery') && (!Array.isArray(details.gallery) || details.gallery.length > 10 || !details.gallery.every(value => value !== '' && safeImage(value)))) return false;
 return !Object.hasOwn(details, 'is_sample') || typeof details.is_sample === 'boolean';
};
const editorialValid = value => {
 if (!exactKeys(value, Object.keys(defaultEditorial))) return false;
 const texts = ['collectionEyebrow', 'featuredEyebrow', 'featuredTitle', 'featuredText', 'featuredButton', 'catalogEyebrow', 'catalogText', 'serviceTitle', 'footerHeading', 'footerText'];
 if (!texts.every(key => str(value[key], 5000))) return false;
 if (!Array.isArray(value.categoryImages) || value.categoryImages.length > 50 || !value.categoryImages.every(item => exactKeys(item, ['category', 'image', 'caption']) && str(item.category, 100) && safeImage(item.image) && str(item.caption, 300))) return false;
 if (!exactKeys(value.story, ['eyebrow', 'title', 'text', 'image', 'button']) || !['eyebrow', 'title', 'text', 'button'].every(key => str(value.story[key], 5000)) || !safeImage(value.story.image)) return false;
 if (!exactKeys(value.journal, ['eyebrow', 'title', 'text', 'articles']) || !['eyebrow', 'title', 'text'].every(key => str(value.journal[key], 5000))) return false;
 return Array.isArray(value.journal.articles) && value.journal.articles.length <= 12 && value.journal.articles.every(item => exactKeys(item, ['title', 'excerpt', 'image', 'body']) && str(item.title, 300) && str(item.excerpt, 1000) && str(item.body, 10000) && safeImage(item.image));
};
function validateSettings(s,old) {
 if (!record(s)) return 'Cấu hình không hợp lệ.';
 if(Object.keys(s).sort().join()!==Object.keys(old).sort().join())return 'Cần giữ đúng các trường cấu hình.';for(const k of Object.keys(old)){if(typeof old[k]==='string'&&!str(s[k],10000))return `Trường ${k} không hợp lệ.`;}if(!integer(s.shippingFee,1e7)||!integer(s.freeShipping,1e9)||!safeImage(s.logo)||!safeImage(s.heroImage)||!Array.isArray(s.categories)||s.categories.length>50||!s.categories.every(c=>str(c,100)&&c.trim())||!Array.isArray(s.benefits)||s.benefits.length>10||!s.benefits.every(c=>str(c,200))||!Array.isArray(s.policies)||s.policies.length>20||!s.policies.every(p=>p&&str(p.title,100)&&str(p.body,10000)))return 'Cấu hình không hợp lệ.';if(!editorialValid(s.editorial))return 'Nội dung bộ sưu tập, câu chuyện hoặc bài viết không hợp lệ.';if(!navigationValid(s.navigation))return 'Nội dung thanh điều hướng không hợp lệ.';if(!s.ui||Object.keys(s.ui).sort().join()!==Object.keys(old.ui).sort().join()||!Object.values(s.ui).every(v=>str(v,500)))return 'Nội dung giao diện không hợp lệ.';if(!s.colors||Object.keys(old.colors).some(k=>!/^#[0-9a-f]{6}$/i.test(s.colors[k]))||!s.labels||Object.keys(s.labels).sort().join()!==Object.keys(old.labels).sort().join()||!Object.values(s.labels).every(v=>str(v,200)))return 'Màu sắc hoặc nhãn giao diện không hợp lệ.';
 return null;
}
const digest=v=>createHash('sha256').update(v).digest('hex');
export function createApp(db=openStore(), { translation = {} } = {}) {
 const app=express(); app.disable('x-powered-by');
 // Only enable this for a proxy on the same machine, e.g. the demo tunnel.
 if(process.env.TRUST_PROXY==='loopback')app.set('trust proxy','loopback');
 app.use(helmet({contentSecurityPolicy:{directives:{'img-src':["'self'",'https:'],'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null}}}));
 app.use(express.json({limit:'128kb'}));
 app.get('/healthz',(_req,res)=>{try{db.prepare('SELECT 1').get();res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
 const settings=()=>JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
 const fail=(res,message,status=400)=>res.status(status).json({error:message});
 app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false}));
 app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
   const expected=process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`;
   if(req.get('origin')!==expected)return fail(res,'Nguồn yêu cầu không hợp lệ.',403);
  }
  const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('sn_session='))?.slice(11);
  if(cookie&&/^[a-f0-9]{64}$/.test(cookie)){req.session=db.prepare('SELECT s.*,u.email,u.name,u.role,u.password_change_required FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>? AND u.disabled=0').get(digest(cookie),Date.now());}
  if(req.session)req.session.permissions=permissionsFor(req.session.role);
  if (req.session?.password_change_required) {
   const route=req.originalUrl.split('?')[0];
   const accountAllowed=['/api/me','/api/account/password','/api/account/security','/api/logout','/api/login'];
   const publicRead=req.method==='GET'&&/^\/api\/(settings$|products(?:\/|$)|catalog$|commerce$|collections\/|locations\/)/.test(route);
   if (!accountAllowed.includes(route) && !publicRead) return res.status(403).json({error:'Vui lòng đổi mật khẩu do quản trị viên cấp trước khi tiếp tục.',code:'PASSWORD_CHANGE_REQUIRED'});
  }
  next();
 });
 const auth=(req,res,next)=>req.session?next():fail(res,'Vui lòng đăng nhập.',401);
 const csrf=(req,res,next)=>req.session&&req.get('x-csrf-token')===req.session.csrf?next():fail(res,'Phiên yêu cầu không hợp lệ.',403);
 const permit=(...permissions)=>(req,res,next)=>req.session?.permissions.some(value=>permissions.includes(value))?next():fail(res,'Bạn không có quyền thực hiện thao tác này.',403);
 const admin=adminGate;
 const staff=(req,res,next)=>req.session.permissions.length?next():fail(res,'Không có quyền quản trị.',403);
 const session=(res,user)=>{const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),user.id,csrf,Date.now()+86400000*7);res.cookie('sn_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:86400000*7,path:'/'});return {user:publicUser(user),csrf};};
 const loginLimit=rateLimit({windowMs:900000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Thử lại sau ít phút.'}});
 installTranslations(app,db,translation);
 app.use('/api/admin',auth,admin);
 installAdminApi(app,{db,auth,csrf,permit,settings,validateSettings,passwordLimit:loginLimit});
 installCommerce(app,db,{auth,csrf,admin,settings,loginLimit});
 app.get('/api/settings',(req,res)=>res.json(settings()));
 app.get('/api/products',(req,res)=>res.json(db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id DESC').all().map(p=>decorateProduct(db,p,readProduct))));
 // Return product records only: order contents and customer information stay private.
 app.get('/api/collections/bestsellers',(req,res)=>res.json(db.prepare(`
  SELECT p.* FROM orders AS o
  JOIN json_each(o.items) AS line
  JOIN products AS p ON p.id=json_extract(line.value,'$.id')
  WHERE o.status='completed' AND p.active=1
   AND json_type(line.value,'$.id')='integer'
   AND json_type(line.value,'$.quantity')='integer'
   AND json_extract(line.value,'$.quantity')>0
  GROUP BY p.id
  ORDER BY SUM(json_extract(line.value,'$.quantity')) DESC,p.id DESC
 `).all().map(p=>decorateProduct(db,p,readProduct))));
 app.get('/api/products/:id',(req,res)=>{
  const row=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(req.params.id);
  return row?res.json(decorateProduct(db,row,readProduct)):fail(res,'Không tìm thấy sản phẩm.',404);
 });
 app.get('/api/me',(req,res)=>res.json(req.session?{user:publicUser(req.session),csrf:req.session.csrf}:{user:null}));
 app.post('/api/register',loginLimit,(req,res)=>{const {name,email,password}=req.body;if(!str(name,100)||!name.trim()||!str(email,254)||!/^\S+@\S+\.\S+$/.test(email)||!str(password,128)||password.length<12)return fail(res,'Nhập tên, email hợp lệ và mật khẩu từ 12–128 ký tự.');try{const id=db.prepare('INSERT INTO users(email,name,password) VALUES(?,?,?)').run(email.toLowerCase().trim(),name.trim(),hashPassword(password)).lastInsertRowid;res.status(201).json(session(res,db.prepare('SELECT * FROM users WHERE id=?').get(id)));}catch(e){if(e.code?.includes('CONSTRAINT'))return fail(res,'Email không thể đăng ký.');throw e;}});
 app.post('/api/login',loginLimit,(req,res)=>{const {email,password}=req.body;if(!str(email,254)||!str(password,128))return fail(res,'Thông tin không hợp lệ.');const user=db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());const fallback='e02f87d43e43c789d3e0f65dd321d532:'+ '0'.repeat(128);const valid=checkPassword(password,user?.password||fallback);if(!user||user.disabled||!valid)return fail(res,'Email hoặc mật khẩu không đúng.',401);if(!useMfa(db,user,req.body.otp))return fail(res,'Nhập mã xác thực hai bước hoặc mã khôi phục hợp lệ.',401);res.json(session(res,user));});
 app.post('/api/logout',auth,csrf,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token);res.clearCookie('sn_session',{path:'/'}).json({ok:true});});
 app.use('/api/admin',auth,admin);
 const uploadDir=path.resolve(path.dirname(db.location('main')||path.resolve(process.env.DATA_DIR||'./data','store.sqlite')),'uploads');mkdirSync(uploadDir,{recursive:true,mode:0o700});
 app.post('/api/admin/upload',csrf,express.raw({type:'application/octet-stream',limit:'5mb'}),async(req,res)=>{const b=req.body;if(!Buffer.isBuffer(b)||b.length<12)return fail(res,'Tệp ảnh không hợp lệ.');try{const metadata=await sharp(b,{limitInputPixels:25000000}).metadata();if(!['png','jpeg','webp'].includes(metadata.format))return fail(res,'Chỉ nhận PNG, JPEG hoặc WebP.');const converted=await sharp(b,{limitInputPixels:25000000,animated:false}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();const name=randomBytes(20).toString('hex')+'.webp';writeFileSync(path.join(uploadDir,name),converted,{mode:0o600});audit(db,req.session.user_id,'image_upload',name);res.status(201).json({url:'/uploads/'+name});}catch{return fail(res,'Không giải mã được ảnh. Chỉ dùng PNG/JPEG/WebP hợp lệ, tối đa 5 MB và 25 triệu điểm ảnh.');}});
 app.get('/api/admin/products',permit('products.manage'),(req,res)=>res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(p=>({...decorateProduct(db,p,readProduct),base_price:p.price,base_stock:p.stock,all_variants:productVariants(db,p.id)}))));
 const validProduct=p=>record(p)&&str(p.name,200)&&p.name.trim()&&str(p.category,100)&&settings().categories.includes(p.category)&&str(p.description,10000)&&integer(p.price,1e9)&&integer(p.stock,1e6)&&safeImage(p.image)&&[0,1].includes(p.active)&&(p.details===undefined||productDetailsValid(p.details));
 function product(req,res,next){
  const p=req.body;
  if(!validProduct(p))return fail(res,'Thông tin sản phẩm không hợp lệ.');
  if(p.details && Object.hasOwn(p.details,'sku'))p.details={...p.details,sku:normalizeSku(p.details.sku)};
  next();
 }
 const catalogWrite=fn=>(req,res,next)=>{
  try{fn(req,res);}catch(error){if(error.status)return fail(res,error.message,error.status);next(error);}
 };
 app.post('/api/admin/products',csrf,permit('products.manage'),product,catalogWrite((req,res)=>{
  const p=req.body;
  const id=transact(db,()=>{
   assertSkuAvailable(db,p.details?.sku);
   const id=Number(db.prepare('INSERT INTO products(name,category,description,price,stock,image,active,details) VALUES(?,?,?,?,?,?,?,?)').run(p.name,p.category,p.description,p.price,p.stock,p.image,p.active,JSON.stringify(p.details??{})).lastInsertRowid);
   movement(db,id,null,p.stock,'product_created',null,req.session.user_id);
   audit(db,req.session.user_id,'product_created',id,JSON.stringify({after:{price:p.price,stock:p.stock,active:p.active,sku:p.details?.sku||''}}));
   if(p.skus!==undefined)saveSkuOptions(db,id,p.skus,req.session.user_id,{creating:true});
   return id;
  });
  res.status(201).json({id});
 }));
 const updateProduct=catalogWrite((req,res)=>{
  const patch=req.method==='PATCH',body=req.body;
  if(patch&&(!record(body)||Object.keys(body).some(key=>!['revision','name','category','description','price','image','active','details','skus'].includes(key))))return fail(res,'Chỉ sửa thông tin sản phẩm; điều chỉnh số lượng tại mục Kho & biến thể.');
  transact(db,()=>{
   const previous=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
   if(!previous)throw Object.assign(Error('Không tìm thấy sản phẩm.'),{status:404});
   assertRevision(body.revision,previous.revision);
   if(!patch)assertRevision(body.stock_revision,previous.stock_revision);
   const p=patch?{...previous,...body,details:body.details===undefined?JSON.parse(previous.details):{...JSON.parse(previous.details),...body.details}}:body;
   if(!validProduct(p)||(body.details!==undefined&&!productDetailsValid(body.details)))throw Object.assign(Error('Thông tin sản phẩm không hợp lệ.'),{status:400});
   if(p.details&&Object.hasOwn(p.details,'sku'))p.details={...p.details,sku:normalizeSku(p.details.sku)};
   assertSkuAvailable(db,p.details?.sku,{productId:previous.id});
   db.prepare('UPDATE products SET name=?,category=?,description=?,price=?,stock=?,image=?,active=?,details=COALESCE(?,details) WHERE id=?').run(p.name,p.category,p.description,p.price,p.stock,p.image,p.active,p.details===undefined?null:JSON.stringify(p.details),previous.id);
   if(previous.stock!==p.stock)movement(db,previous.id,null,p.stock-previous.stock,'admin_edit',null,req.session.user_id);
   audit(db,req.session.user_id,'product_update',previous.id,JSON.stringify({before:{price:previous.price,stock:previous.stock,active:previous.active,sku:normalizeSku(JSON.parse(previous.details).sku)},after:{price:p.price,stock:p.stock,active:p.active,sku:p.details===undefined?normalizeSku(JSON.parse(previous.details).sku):p.details.sku||''}}));
   if(body.skus!==undefined)saveSkuOptions(db,previous.id,body.skus,req.session.user_id);
  });
  res.json({ok:true});
 });
 app.put('/api/admin/products/:id',csrf,permit('products.manage'),product,updateProduct);
 app.patch('/api/admin/products/:id',csrf,permit('products.manage'),updateProduct);
 app.delete('/api/admin/products/:id',csrf,permit('products.manage'),catalogWrite((req,res)=>{
  transact(db,()=>{
   db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
   audit(db,req.session.user_id,'product_hide',req.params.id);
  });
  res.json({ok:true});
 }));
 app.get('/api/admin/settings',permit('content.manage','settings.manage'),(req,res)=>res.json(settings()));
 app.use('/api',(req,res)=>fail(res,'Không tìm thấy API.',404));
 app.use('/uploads',express.static(uploadDir,{dotfiles:'deny',setHeaders:res=>res.set('Content-Security-Policy',"default-src 'none'; sandbox")}));
 installSeo(app,db,settings);
 app.use(express.static(fileURLToPath(new URL('./public',import.meta.url))));
 app.use((err,req,res,next)=>{if(err instanceof SyntaxError||err.type==='entity.too.large')return fail(res,'Dữ liệu không hợp lệ.');console.error('Request failed:',err.code||err.name);fail(res,'Lỗi xử lý yêu cầu.',500);});
 return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const db=openStore();expireOrders(db);createApp(db).listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('Super Net server started on port '+(process.env.PORT||3000)));setInterval(()=>{try{expireOrders(db);}catch{console.error('Order expiry failed');}},60000).unref();}
