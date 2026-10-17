import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openStore, hashPassword, checkPassword, readProduct, defaultEditorial } from './store.js';
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
const digest=v=>createHash('sha256').update(v).digest('hex');
export function createApp(db=openStore()) {
 const app=express(); app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{'img-src':["'self'",'https:'],'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null}}}));
 app.use(express.json({limit:'128kb'}));
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
  if(cookie&&/^[a-f0-9]{64}$/.test(cookie)){req.session=db.prepare('SELECT s.*,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?').get(digest(cookie),Date.now());}
  next();
 });
 const auth=(req,res,next)=>req.session?next():fail(res,'Vui lòng đăng nhập.',401);
 const csrf=(req,res,next)=>req.session&&req.get('x-csrf-token')===req.session.csrf?next():fail(res,'Phiên yêu cầu không hợp lệ.',403);
 const admin=(req,res,next)=>req.session?.role==='admin'?next():fail(res,'Không có quyền quản trị.',403);
 const session=(res,user)=>{const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),user.id,csrf,Date.now()+86400000*7);res.cookie('sn_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:86400000*7,path:'/'});return {user:{id:user.id,name:user.name,email:user.email,role:user.role},csrf};};
 const loginLimit=rateLimit({windowMs:900000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Thử lại sau ít phút.'}});
 app.get('/api/settings',(req,res)=>res.json(settings()));
 app.get('/api/products',(req,res)=>res.json(db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id DESC').all().map(readProduct)));
 app.get('/api/products/:id',(req,res)=>{
  const row=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(req.params.id);
  return row?res.json(readProduct(row)):fail(res,'Không tìm thấy sản phẩm.',404);
 });
 app.get('/api/me',(req,res)=>res.json(req.session?{user:{id:req.session.user_id,name:req.session.name,email:req.session.email,role:req.session.role},csrf:req.session.csrf}:{user:null}));
 app.post('/api/register',loginLimit,(req,res)=>{const {name,email,password}=req.body;if(!str(name,100)||!name.trim()||!str(email,254)||!/^\S+@\S+\.\S+$/.test(email)||!str(password,128)||password.length<12)return fail(res,'Nhập tên, email hợp lệ và mật khẩu từ 12–128 ký tự.');try{const id=db.prepare('INSERT INTO users(email,name,password) VALUES(?,?,?)').run(email.toLowerCase().trim(),name.trim(),hashPassword(password)).lastInsertRowid;res.status(201).json(session(res,db.prepare('SELECT * FROM users WHERE id=?').get(id)));}catch(e){if(e.code?.includes('CONSTRAINT'))return fail(res,'Email không thể đăng ký.');throw e;}});
 app.post('/api/login',loginLimit,(req,res)=>{const {email,password}=req.body;if(!str(email,254)||!str(password,128))return fail(res,'Thông tin không hợp lệ.');const user=db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());const fallback='e02f87d43e43c789d3e0f65dd321d532:'+ '0'.repeat(128);const valid=checkPassword(password,user?.password||fallback);if(!user||!valid)return fail(res,'Email hoặc mật khẩu không đúng.',401);res.json(session(res,user));});
 app.post('/api/logout',auth,csrf,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token);res.clearCookie('sn_session',{path:'/'}).json({ok:true});});
 app.get('/api/orders',auth,(req,res)=>res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.session.user_id).map(o=>({...o,items:JSON.parse(o.items),bank:JSON.parse(o.bank)}))));
 app.post('/api/orders',auth,csrf,(req,res)=>{
  const {items,payment,recipient,address,phone}=req.body;
  if(!Array.isArray(items)||!items.length||items.length>50||!str(recipient,100)||!recipient.trim()||!str(address,600)||address.trim().length<10||!str(phone,20)||!/^\+?[\d ()-]{9,20}$/.test(phone)||!['cod','bank'].includes(payment))return fail(res,'Kiểm tra người nhận, điện thoại, địa chỉ và phương thức thanh toán.');
  const s=settings();if(payment==='bank'&&!(s.bankName&&s.bankAccount&&s.bankHolder))return fail(res,'Chuyển khoản chưa được cửa hàng cấu hình. Vui lòng chọn COD.');
  const seen=new Set();for(const item of items){if(!Number.isSafeInteger(item.id)||!integer(item.quantity,99)||item.quantity<1||seen.has(item.id))return fail(res,'Giỏ hàng không hợp lệ.');seen.add(item.id);}
  db.exec('BEGIN IMMEDIATE');try{let subtotal=0;const lines=[];for(const item of items){const p=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(item.id);if(!p||p.stock<item.quantity)throw new Error('Sản phẩm không còn đủ tồn kho.');subtotal+=p.price*item.quantity;lines.push({id:p.id,name:p.name,price:p.price,quantity:item.quantity});db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(item.quantity,p.id);}const shipping=subtotal>=s.freeShipping?0:s.shippingFee;const bank=payment==='bank'?{name:s.bankName,account:s.bankAccount,holder:s.bankHolder}:{};const result=db.prepare("INSERT INTO orders(user_id,created,status,total,shipping,payment,recipient,address,phone,items,bank) VALUES(?,?,'pending',?,?,?,?,?,?,?,?)").run(req.session.user_id,new Date().toISOString(),subtotal+shipping,shipping,payment,recipient.trim(),address.trim(),phone,JSON.stringify(lines),JSON.stringify(bank));db.exec('COMMIT');res.status(201).json({id:Number(result.lastInsertRowid),total:subtotal+shipping,shipping,bank});}catch(e){db.exec('ROLLBACK');return fail(res,e.message==='Sản phẩm không còn đủ tồn kho.'?e.message:'Không thể tạo đơn hàng.');}
 });
 app.use('/api/admin',auth,admin);
 const uploadDir=path.resolve(process.env.DATA_DIR||'./data','uploads');mkdirSync(uploadDir,{recursive:true,mode:0o700});
 app.post('/api/admin/upload',csrf,express.raw({type:'application/octet-stream',limit:'5mb'}),(req,res)=>{const b=req.body;if(!Buffer.isBuffer(b)||b.length<12)return fail(res,'Tệp ảnh không hợp lệ.');let ext;if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(b[0]===255&&b[1]===216&&b[2]===255)ext='jpg';else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')ext='webp';else return fail(res,'Chỉ nhận ảnh PNG, JPEG hoặc WebP, tối đa 5 MB.');const name=randomBytes(20).toString('hex')+'.'+ext;writeFileSync(path.join(uploadDir,name),b,{mode:0o600});res.status(201).json({url:'/uploads/'+name});});
 app.get('/api/admin/products',(req,res)=>res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(readProduct)));
 function product(req,res,next){const p=req.body;if(!str(p.name,200)||!p.name.trim()||!str(p.category,100)||!settings().categories.includes(p.category)||!str(p.description,10000)||!integer(p.price,1e9)||!integer(p.stock,1e6)||!safeImage(p.image)||![0,1].includes(p.active)||(p.details!==undefined&&!productDetailsValid(p.details)))return fail(res,'Thông tin sản phẩm không hợp lệ.');next();}
 app.post('/api/admin/products',csrf,product,(req,res)=>{const p=req.body;const r=db.prepare('INSERT INTO products(name,category,description,price,stock,image,active,details) VALUES(?,?,?,?,?,?,?,?)').run(p.name,p.category,p.description,p.price,p.stock,p.image,p.active,JSON.stringify(p.details??{}));res.status(201).json({id:Number(r.lastInsertRowid)});});
 app.put('/api/admin/products/:id',csrf,product,(req,res)=>{const p=req.body;const r=db.prepare('UPDATE products SET name=?,category=?,description=?,price=?,stock=?,image=?,active=?,details=COALESCE(?,details) WHERE id=?').run(p.name,p.category,p.description,p.price,p.stock,p.image,p.active,p.details===undefined?null:JSON.stringify(p.details),req.params.id);r.changes?res.json({ok:true}):fail(res,'Không tìm thấy sản phẩm.',404);});
 app.delete('/api/admin/products/:id',csrf,(req,res)=>{db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);res.json({ok:true});});
 app.put('/api/admin/settings',csrf,(req,res)=>{const s=req.body,old=settings();if(Object.keys(s).sort().join()!==Object.keys(old).sort().join())return fail(res,'Cần giữ đúng các trường cấu hình.');for(const k of Object.keys(old)){if(typeof old[k]==='string'&&!str(s[k],10000))return fail(res,`Trường ${k} không hợp lệ.`);}if(!integer(s.shippingFee,1e7)||!integer(s.freeShipping,1e9)||!safeImage(s.logo)||!safeImage(s.heroImage)||!Array.isArray(s.categories)||s.categories.length>50||!s.categories.every(c=>str(c,100)&&c.trim())||!Array.isArray(s.benefits)||s.benefits.length>10||!s.benefits.every(c=>str(c,200))||!Array.isArray(s.policies)||s.policies.length>20||!s.policies.every(p=>p&&str(p.title,100)&&str(p.body,10000)))return fail(res,'Cấu hình không hợp lệ.');if(!editorialValid(s.editorial))return fail(res,'Nội dung bộ sưu tập, câu chuyện hoặc bài viết không hợp lệ.');if(!s.ui||Object.keys(s.ui).sort().join()!==Object.keys(old.ui).sort().join()||!Object.values(s.ui).every(v=>str(v,500)))return fail(res,'Nội dung giao diện không hợp lệ.');if(!s.colors||Object.keys(old.colors).some(k=>!/^#[0-9a-f]{6}$/i.test(s.colors[k]))||!s.labels||Object.keys(s.labels).sort().join()!==Object.keys(old.labels).sort().join()||!Object.values(s.labels).every(v=>str(v,200)))return fail(res,'Màu sắc hoặc nhãn giao diện không hợp lệ.');db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));res.json({ok:true});});
 app.get('/api/admin/orders',(req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC').all().map(o=>({...o,items:JSON.parse(o.items),bank:JSON.parse(o.bank)}))));
 app.patch('/api/admin/orders/:id',csrf,(req,res)=>{const status=req.body.status;if(!['pending','confirmed','shipped','completed','cancelled'].includes(status))return fail(res,'Trạng thái không hợp lệ.');db.exec('BEGIN IMMEDIATE');try{const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);if(!order){db.exec('ROLLBACK');return fail(res,'Không có đơn hàng.',404);}const allowed={pending:['confirmed','cancelled'],confirmed:['shipped','cancelled'],shipped:['completed'],completed:[],cancelled:[]};if(!allowed[order.status].includes(status)){db.exec('ROLLBACK');return fail(res,'Không thể chuyển sang trạng thái này.');}if(status==='cancelled')for(const i of JSON.parse(order.items))db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.quantity,i.id);db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,req.params.id);db.exec('COMMIT');res.json({ok:true});}catch(e){db.exec('ROLLBACK');throw e;}});
 app.use('/api',(req,res)=>fail(res,'Không tìm thấy API.',404));
 app.use('/uploads',express.static(uploadDir,{dotfiles:'deny',setHeaders:res=>res.set('Content-Security-Policy',"default-src 'none'; sandbox")}));
 app.use(express.static(fileURLToPath(new URL('./public',import.meta.url))));
 app.use((err,req,res,next)=>{if(err instanceof SyntaxError||err.type==='entity.too.large')return fail(res,'Dữ liệu không hợp lệ.');console.error('Request failed:',err.code||err.name);fail(res,'Lỗi xử lý yêu cầu.',500);});
 return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Super Net server started on port '+(process.env.PORT||3000)));
