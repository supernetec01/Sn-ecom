import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomBytes,randomUUID } from 'node:crypto';
import { openStore,hashPassword } from '../store.js';
import { createApp } from '../server.js';

async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'sn-sku-')),db=openStore(dir),password=randomBytes(20).toString('hex');
 for(const role of ['admin','customer','editor'])db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(role,role+'@example.test',hashPassword(password),role);
 const server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});});
 const request=async(path,{method='GET',body,ctx={}}={})=>{const r=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',...ctx,...(path==='/orders'&&method==='POST'?{'Idempotency-Key':randomUUID()}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const auth={};for(const role of ['admin','customer','editor']){const login=await request('/login',{method:'POST',body:{email:role+'@example.test',password}});auth[role]={Cookie:login.cookie,'X-CSRF-Token':login.data.csrf};}
 const rows=()=>['Xanh','Đỏ','Trắng'].map((label,index)=>({sku:'CUP-'+index,label,price:100000+index*10000,stock:10+index,image:'/images/products/'+['coc-su-morning.webp','binh-giu-nhiet-everyday.webp','binh-nuoc-active.webp'][index],active:1}));
 const product=()=>({name:'Cốc ba màu',category:'Nhà bếp',description:'Cốc với ba màu',image:'/product-box.svg',price:100000,stock:0,active:1,details:{sku:''},skus:rows()});
 const variants=id=>db.prepare('SELECT * FROM product_variants WHERE product_id=? ORDER BY id').all(id);
 const skuBody=id=>variants(id).map(({id,revision,sku,label,price,image,active})=>({id,revision,sku,label,price,image,active}));
 const shipping={country:'VN',province_code:'01',ward_code:'00004',recipient:'Buyer',phone:'0901234567',address:'123 Nguyen Trai',payment:'cod'};
 const snapshot=()=>Object.fromEntries(['products','product_variants','inventory_movements','audit_log'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY id').all()]));
 return {dir,db,request,...auth,rows,product,variants,skuBody,shipping,snapshot};
}

test('One product saves three distinct SKU images atomically; checkout snapshots and decrements only the selected color',async t=>{
 const f=await fixture(t);const {request,admin,customer,product,rows,variants,shipping,db}=f;
 const lowBefore=(await request('/admin/dashboard',{ctx:admin})).data.lowStock;
 const r=await request('/admin/products',{method:'POST',ctx:admin,body:product()});assert.equal(r.status,201);const id=r.data.id,vs=variants(id);
 assert.equal((await request('/admin/dashboard',{ctx:admin})).data.lowStock,lowBefore);
 assert.equal(vs.length,3);assert.deepEqual(vs.map(v=>v.image),rows().map(v=>v.image));
 const p=(await request('/products/'+id)).data;assert.equal(p.has_variants,true);assert.equal(p.stock,33);assert.equal(p.variants.length,3);
 assert.equal((await request('/orders',{method:'POST',ctx:customer,body:{...shipping,items:[{id,quantity:1}]}})).status,400);
 const order=await request('/orders',{method:'POST',ctx:customer,body:{...shipping,items:[{id,variant_id:vs[1].id,quantity:2,price:1,image:'forged'}]}});assert.equal(order.status,201);
 const line=JSON.parse(db.prepare('SELECT items FROM orders WHERE id=?').get(order.data.id).items)[0];
 assert.equal(line.sku,'CUP-1');assert.equal(line.variant,'Đỏ');assert.equal(line.image,rows()[1].image);assert.equal(line.price,110000);
 assert.deepEqual(variants(id).map(v=>v.stock),[10,9,12]);
 assert.equal((await request('/orders/'+order.data.id+'/cancel',{method:'POST',ctx:customer,body:{}})).status,200);assert.deepEqual(variants(id).map(v=>v.stock),[10,11,12]);
});

test('Converting a single SKU uses live stock and old pending-order cancellation restores the original color once',async t=>{
 const f=await fixture(t);const {request,admin,customer,db,variants,shipping}=f;
 const p=db.prepare('SELECT * FROM products WHERE id=1').get(),info=JSON.parse(p.details);
 const old=await request('/orders',{method:'POST',ctx:customer,body:{...shipping,items:[{id:p.id,quantity:2}]}});assert.equal(old.status,201);
 const before=db.prepare('SELECT items FROM orders WHERE id=?').get(old.data.id).items;
 const rows=[{base:true,sku:info.sku,label:'Màu ban đầu',price:p.price,image:p.image,active:1},{sku:'SECOND-COLOR',label:'Màu mới',price:p.price+10000,stock:7,image:'/logo.png',active:1}];
 const changed=await request('/admin/products/'+p.id,{method:'PATCH',ctx:admin,body:{revision:p.revision,skus:rows}});assert.equal(changed.status,200);
 const current=db.prepare('SELECT * FROM products WHERE id=?').get(p.id),vs=variants(p.id);assert.equal(current.stock,0);assert.equal(current.legacy_variant_id,vs[0].id);assert.equal(vs[0].stock,p.stock-2);assert.equal(vs[1].stock,7);
 assert.equal(db.prepare('SELECT items FROM orders WHERE id=?').get(old.data.id).items,before);
 assert.equal((await request('/orders/'+old.data.id+'/cancel',{method:'POST',ctx:customer,body:{}})).status,200);assert.deepEqual(variants(p.id).map(v=>v.stock),[p.stock,7]);
 assert.equal((await request('/orders/'+old.data.id+'/cancel',{method:'POST',ctx:customer,body:{}})).status,400);assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,0);
});

test('Public catalog finds active SKU codes and colors once per product and keeps filters and hidden SKUs private',async t=>{
 const {request,admin,product,db,variants}=await fixture(t);
 const body=product();body.skus[0].label='Xanh ngọc riêng';body.skus[1].label='Xanh ngọc riêng';
 const created=await request('/admin/products',{method:'POST',ctx:admin,body});assert.equal(created.status,201);
 const id=created.data.id,vs=variants(id);
 const search=async(q,filters='')=>(await request('/catalog?q='+encodeURIComponent(q)+filters)).data;
 for(const q of ['CUP-1','xanh ngoc rieng']){
  const result=await search(q);assert.equal(result.total,1);assert.deepEqual(result.items.map(p=>p.id),[id]);
 }
 assert.equal((await search('CUP-1','&category='+encodeURIComponent('Không có'))).total,0);
 assert.equal((await search('CUP-1','&price=over500')).total,0);
 assert.equal((await search("' OR 1=1 --")).total,0);
 db.prepare('UPDATE product_variants SET active=0 WHERE id=?').run(vs[1].id);
 assert.equal((await search('CUP-1')).total,0);
 assert.equal((await search('xanh ngoc rieng')).total,1);
 db.prepare('UPDATE products SET active=0 WHERE id=?').run(id);
 assert.equal((await search('CUP-0')).total,0);
});

test('SKU metadata saves preserve concurrent sales, reject stale revisions and never overwrite stock',async t=>{
 const f=await fixture(t);const {request,admin,customer,db,product,variants,skuBody,shipping,snapshot}=f;
 const created=await request('/admin/products',{method:'POST',ctx:admin,body:product()}),id=created.data.id;
 const p=db.prepare('SELECT * FROM products WHERE id=?').get(id),rows=skuBody(id),first=variants(id)[0];
 assert.equal((await request('/orders',{method:'POST',ctx:customer,body:{...shipping,items:[{id,variant_id:first.id,quantity:1}]}})).status,201);
 rows[0].image='/logo.png';rows[0].price=125000;rows[0].label='Xanh mới';
 assert.equal((await request('/admin/products/'+id,{method:'PATCH',ctx:admin,body:{revision:p.revision,skus:rows}})).status,200);assert.equal(variants(id)[0].stock,9);
 assert.equal(variants(id)[0].image,'/logo.png');assert.equal(variants(id)[0].revision,first.revision+1);
 const state=snapshot();assert.equal((await request('/admin/products/'+id,{method:'PATCH',ctx:admin,body:{revision:p.revision,skus:rows}})).status,409);assert.deepEqual(snapshot(),state);
 const forged=skuBody(id);forged[0].stock=999;assert.equal((await request('/admin/products/'+id,{method:'PATCH',ctx:admin,body:{revision:p.revision,skus:forged}})).status,400);assert.deepEqual(snapshot(),state);
 const fresh=skuBody(id);assert.equal((await request('/admin/products/'+id+'/variants',{method:'POST',ctx:admin,body:{sku:'CONCURRENT-NEW',label:'Khác',price:123000,stock:2,image:'/logo.png'}})).status,201);
 assert.equal((await request('/admin/products/'+id,{method:'PATCH',ctx:admin,body:{revision:p.revision,skus:fresh}})).status,409);
});

test('Duplicate/unsafe/missing SKU images, wrong-parent IDs and audit errors roll back the entire batch; non-stock staff cannot write',async t=>{
 const f=await fixture(t);const {request,admin,customer,editor,product,rows,snapshot,db,skuBody}=f;
 const cases=[{rows:r=>{r[1].sku=r[0].sku;},status:409},{rows:r=>{r[1].image='';},status:400},{rows:r=>{r[1].image='javascript:alert(1)';},status:400},{rows:r=>{r[1].sku=JSON.parse(db.prepare('SELECT details FROM products WHERE id=1').get().details).sku;},status:409}];
 for(const scenario of cases){const body=product();scenario.rows(body.skus);const before=snapshot();assert.equal((await request('/admin/products',{method:'POST',ctx:admin,body})).status,scenario.status);assert.deepEqual(snapshot(),before);}
 for(const ctx of [customer,editor])assert.equal((await request('/admin/products',{method:'POST',ctx,body:product()})).status,403);
 db.exec("CREATE TEMP TRIGGER fail_sku_audit BEFORE INSERT ON audit_log WHEN NEW.action='variant_created' BEGIN SELECT RAISE(ABORT,'injected'); END");
 const before=snapshot();assert.equal((await request('/admin/products',{method:'POST',ctx:admin,body:product()})).status,500);assert.deepEqual(snapshot(),before);db.exec('DROP TRIGGER fail_sku_audit');
 const created=await request('/admin/products',{method:'POST',ctx:admin,body:product()}),id=created.data.id;
 const foreign=await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:{sku:'FOREIGN-ID',label:'Foreign',price:100,stock:1,image:'/logo.png'}});
 const body=skuBody(id);body[0].id=foreign.data.id;const state=snapshot();assert.equal((await request('/admin/products/'+id,{method:'PATCH',ctx:admin,body:{revision:0,skus:body}})).status,409);assert.deepEqual(snapshot(),state);
});

test('Per-SKU image migration preserves old identity/stock; subsequent image edits survive reopening and participate in revisions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sn-sku-migration-'));let db;
 try {
  db=openStore(dir);const p=db.prepare('SELECT * FROM products WHERE id=1').get();db.prepare('INSERT INTO product_variants(product_id,sku,label,price,stock,image) VALUES(?,?,?,?,?,?)').run(p.id,'LEGACY-SKU','Xanh',150000,4,p.image);
  const before=db.prepare('SELECT id,product_id,sku,label,price,stock,active,revision,stock_revision FROM product_variants').get();
  db.exec('DROP TRIGGER product_variants_content_revision; ALTER TABLE product_variants DROP COLUMN image');db.close();db=openStore(dir);
  assert.deepEqual(db.prepare('SELECT id,product_id,sku,label,price,stock,active,revision,stock_revision FROM product_variants').get(),before);assert.equal(db.prepare('SELECT image FROM product_variants').get().image,p.image);
  db.prepare('UPDATE product_variants SET image=?').run('/logo.png');assert.equal(db.prepare('SELECT revision FROM product_variants').get().revision,before.revision+1);
  db.close();db=openStore(dir);assert.equal(db.prepare('SELECT image FROM product_variants').get().image,'/logo.png');assert.equal(db.prepare('SELECT stock FROM product_variants').get().stock,4);assert.equal(db.prepare('SELECT revision FROM product_variants').get().revision,before.revision+1);
 } finally {db?.close();rmSync(dir,{recursive:true,force:true});}
});
