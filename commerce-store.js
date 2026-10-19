import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { productVariants, normalizeSku } from './catalog.js';
export const sha = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const moneyInt = (v,max=1e9) => Number.isSafeInteger(v)&&v>=0&&v<=max;
export const text = (v,max=1000) => typeof v==='string'&&v.length<=max;
export const phoneNumber = v => typeof v==='string'?v.replace(/[ ()-]/g,''):'';
export const emailValid = v => text(v,254)&&/^\S+@\S+\.\S+$/.test(v);
export const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const normalize = v => slug(String(v)).replaceAll('-',' ');
export function migrateCommerce(db) {
 db.exec('PRAGMA busy_timeout=5000');
 db.exec('BEGIN IMMEDIATE');
 try {
 const add=(table,name,def)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);};
 for(const [k,v] of Object.entries({verified:'INTEGER NOT NULL DEFAULT 0',totp_secret:'TEXT',totp_pending:'TEXT',totp_last:'INTEGER NOT NULL DEFAULT -1'}))add('users',k,v);
 for(const [k,v] of Object.entries({payment_status:"TEXT NOT NULL DEFAULT 'unpaid'",discount:'INTEGER NOT NULL DEFAULT 0',coupon:"TEXT NOT NULL DEFAULT ''",points_used:'INTEGER NOT NULL DEFAULT 0',email:"TEXT NOT NULL DEFAULT ''",region:"TEXT NOT NULL DEFAULT ''",guest_hash:'TEXT',expires:'INTEGER',stock_released:'INTEGER NOT NULL DEFAULT 0'}))add('orders',k,v);
 db.exec(`
 CREATE TABLE IF NOT EXISTS payment_intents(reference TEXT PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),amount INTEGER NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),recipient TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,region TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS product_variants(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),sku TEXT NOT NULL UNIQUE,label TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS order_events(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),actor INTEGER,kind TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory_movements(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL,variant_id INTEGER,delta INTEGER NOT NULL,reason TEXT NOT NULL,order_id INTEGER,actor INTEGER,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS payment_transactions(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),reference TEXT NOT NULL UNIQUE,actor INTEGER,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shipments(order_id INTEGER PRIMARY KEY REFERENCES orders(id),carrier TEXT NOT NULL,tracking TEXT NOT NULL,url TEXT NOT NULL,status TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS return_requests(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'requested',note TEXT NOT NULL DEFAULT '',restocked INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY,kind TEXT NOT NULL,value INTEGER NOT NULL,min_total INTEGER NOT NULL,max_discount INTEGER NOT NULL,starts INTEGER NOT NULL,ends INTEGER NOT NULL,limit_total INTEGER NOT NULL,limit_user INTEGER NOT NULL,product_ids TEXT NOT NULL DEFAULT '[]',active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS loyalty_ledger(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),order_id INTEGER NOT NULL REFERENCES orders(id),reason TEXT NOT NULL,points INTEGER NOT NULL,created TEXT NOT NULL,UNIQUE(order_id,reason));
 CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL,UNIQUE(user_id,product_id));
 CREATE TABLE IF NOT EXISTS wishlists(user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),PRIMARY KEY(user_id,product_id));
 CREATE TABLE IF NOT EXISTS mfa_recovery(hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS account_tokens(hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_outbox(id INTEGER PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,sent TEXT);
 CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT NOT NULL,target TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS commerce_settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analytics_events(id INTEGER PRIMARY KEY,event TEXT NOT NULL,product_id INTEGER,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS chat_sessions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY,session_id TEXT NOT NULL REFERENCES chat_sessions(id),role TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,id);
 CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created);
 CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id,id);
 CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(status,id);
 `);
 for(const table of ['orders','addresses'])for(const name of ['country','province_code','province_name','ward_code','ward_name','address_line','address_version'])add(table,name,"TEXT NOT NULL DEFAULT ''");
 db.prepare('INSERT OR IGNORE INTO commerce_settings VALUES(1,?)').run(JSON.stringify({holdHours:24,rewardsEnabled:false,pointsPer:10000,pointValue:1000,shippingRules:[]}));
 db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export const commerceSettings = db => JSON.parse(db.prepare('SELECT value FROM commerce_settings WHERE id=1').get().value);
export function transact(db,fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function audit(db,actor,action,target,note=''){db.prepare('INSERT INTO audit_log(actor,action,target,note,created) VALUES(?,?,?,?,?)').run(actor??null,action,String(target),note,now());}
export function event(db,id,actor,kind,note){db.prepare('INSERT INTO order_events(order_id,actor,kind,note,created) VALUES(?,?,?,?,?)').run(id,actor??null,kind,note,now());}
export function queueEmail(db,to,subject,body){if(emailValid(to)&&!to.endsWith('@guest.invalid'))db.prepare('INSERT INTO notification_outbox(recipient,subject,body,created) VALUES(?,?,?,?)').run(to,subject,body,now());}
export function notifyOrder(db,o,note){queueEmail(db,o.email||db.prepare('SELECT email FROM users WHERE id=?').get(o.user_id)?.email,`Đơn SN${o.id}: ${note}`,`${note}\nMã đơn: SN${o.id}\nTổng tiền: ${o.total} VND.\nVui lòng liên hệ cửa hàng nếu cần hỗ trợ.`);}
export function movement(db,id,variant,delta,reason,order=null,actor=null){db.prepare('INSERT INTO inventory_movements(product_id,variant_id,delta,reason,order_id,actor,created) VALUES(?,?,?,?,?,?,?)').run(id,variant??null,delta,reason,order,actor,now());}
export function releaseStock(db,o,actor,reason){
 if(o.stock_released)return;
 for(const i of JSON.parse(o.items)){
  if(i.variant_id)db.prepare('UPDATE product_variants SET stock=stock+? WHERE id=?').run(i.quantity,i.variant_id);
  else db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.quantity,i.id);
  movement(db,i.id,i.variant_id,i.quantity,reason,o.id,actor);
 }
 db.prepare('UPDATE orders SET stock_released=1 WHERE id=?').run(o.id);
}
export const pointsBalance=(db,id)=>db.prepare('SELECT COALESCE(SUM(points),0) n FROM loyalty_ledger WHERE user_id=?').get(id).n;
export function cancelOrder(db,o,actor,reason){
 if(!['pending','confirmed'].includes(o.status)||!['unpaid','refunded'].includes(o.payment_status))throw Error('Chỉ hủy trực tiếp đơn chưa giao và chưa thu tiền; đơn đã thu cần xử lý hoàn tiền.');
 releaseStock(db,o,actor,reason);db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(o.id);
 if(o.points_used)db.prepare('INSERT OR IGNORE INTO loyalty_ledger(user_id,order_id,reason,points,created) VALUES(?,?,?,?,?)').run(o.user_id,o.id,'restore',o.points_used,now());
 event(db,o.id,actor,'cancelled',reason);notifyOrder(db,o,reason);
}
export function expireOrders(db){return transact(db,()=>{const rows=db.prepare("SELECT * FROM orders WHERE status='pending' AND payment_status='unpaid' AND expires IS NOT NULL AND expires<?").all(Date.now());for(const o of rows)cancelOrder(db,o,null,'Đơn hết thời hạn chờ xác nhận.');return rows.length;});}
export function decorateProduct(db,p,read){
 const row=read(p);if(!row)return row;
 const all=productVariants(db,p.id),variants=all.filter(v=>v.active===1).map(v=>({...v,sku:normalizeSku(v.sku)}));
 // Inactive variants still establish the product's SKU model. Never restore the
 // legacy parent stock when the last active choice is hidden.
 const inventory=all.length?{price:Math.min(...(variants.length?variants:all).map(v=>v.price)),stock:variants.reduce((n,v)=>n+v.stock,0)}:{};
 return {...row,has_variants:all.length>0,variants,...inventory,url:`/san-pham/${p.id}-${slug(p.name)}`};
}
export function readOrder(db,o){return {...o,guest_hash:undefined,items:JSON.parse(o.items),bank:JSON.parse(o.bank),shipment:db.prepare('SELECT * FROM shipments WHERE order_id=?').get(o.id)||null,returns:db.prepare('SELECT * FROM return_requests WHERE order_id=?').get(o.id)||null,history:db.prepare('SELECT kind,note,created FROM order_events WHERE order_id=? ORDER BY id').all(o.id),payments:db.prepare('SELECT kind,amount,reference,created FROM payment_transactions WHERE order_id=? ORDER BY id').all(o.id)};}
// RFC 6238 TOTP (SHA-1, 30 seconds, six digits), with replay prevention at enrollment/login.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function totpSecret(){let bits=0,value=0,out='';for(const n of randomBytes(20)){value=(value<<8)|n;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}return out;}
export function totpCode(secret,step=Math.floor(Date.now()/30000)){let bits=0,value=0,bytes=[];for(const c of secret){value=(value<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',Buffer.from(bytes)).update(b).digest();const offset=h[19]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
export function verifyTotp(secret,code,last=-1){if(!/^[0-9]{6}$/.test(code||''))return -1;const step=Math.floor(Date.now()/30000);for(const n of [step-1,step,step+1])if(n>last&&timingSafeEqual(Buffer.from(totpCode(secret,n)),Buffer.from(code)))return n;return -1;}

export function useMfa(db,user,code){
 if(!user.totp_secret)return true;
 const step=verifyTotp(user.totp_secret,code,user.totp_last);
 if(step>=0){db.prepare('UPDATE users SET totp_last=? WHERE id=?').run(step,user.id);return true;}
 if(typeof code==='string'&&/^[a-f0-9]{16}$/.test(code)){const deleted=db.prepare('DELETE FROM mfa_recovery WHERE user_id=? AND hash=?').run(user.id,sha(code));return deleted.changes===1;}
 return false;
}
