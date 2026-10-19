import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { openStore, hashPassword, readProduct } from '../store.js';

async function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'sn-qa-regression-')),db=openStore(dir);
  const server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  async function request(path,{method='GET',body,ctx={},key}={}) {
    const response=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',
      ...ctx,...(key===undefined?{}:{'Idempotency-Key':key})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  const buyer=await request('/register',{method:'POST',body:{name:'QA Buyer',email:'qa-buyer@example.test',password:'qa-buyer-password-123'}});
  db.prepare("INSERT INTO users(email,name,password,role) VALUES(?,?,?,'admin')").run('qa-admin@example.test','QA Admin',hashPassword('qa-admin-password-123'));
  const login=await request('/login',{method:'POST',body:{email:'qa-admin@example.test',password:'qa-admin-password-123'}});
  const customer={Cookie:buyer.cookie,'X-CSRF-Token':buyer.data.csrf},admin={Cookie:login.cookie,'X-CSRF-Token':login.data.csrf};
  const product=readProduct(db.prepare('SELECT * FROM products WHERE id=1').get());
  const checkout={country:'VN',province_code:'01',ward_code:'00004',recipient:'QA Buyer',phone:'0901234567',address:'123 QA street',payment:'cod',items:[{id:product.id,quantity:1}]};
  return {db,request,admin,customer,product,checkout};
}

for (const [table,operation] of [['audit_log','create'],['audit_log','update'],['audit_log','hide'],['inventory_movements','create'],['inventory_movements','update']]) {
  test(`QA: ${operation} product rolls back catalog, stock movements and audit when ${table} fails`,async t=>{
    const {db,request,admin,product}=await fixture(t);
    const before={products:db.prepare('SELECT * FROM products ORDER BY id').all(),movements:db.prepare('SELECT * FROM inventory_movements ORDER BY id').all(),audit:db.prepare('SELECT * FROM audit_log ORDER BY id').all()};
    db.exec(`CREATE TEMP TRIGGER qa_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'injected QA write failure'); END`);
    const path=operation==='create'?'/admin/products':'/admin/products/'+product.id;
    const method={create:'POST',update:'PUT',hide:'DELETE'}[operation];
    const result=await request(path,{method,ctx:admin,body:operation==='hide'?undefined:{...product,name:'QA changed product',price:product.price+1,stock:product.stock+2,details:{...product.details,sku:'QA-NEW-SKU'}}});
    assert.equal(result.status,500);
    assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),before.products);
    assert.deepEqual(db.prepare('SELECT * FROM inventory_movements ORDER BY id').all(),before.movements);
    assert.deepEqual(db.prepare('SELECT * FROM audit_log ORDER BY id').all(),before.audit);
    db.exec('DROP TRIGGER qa_failure');
    // The same database connection must remain usable after rollback.
    const retry=await request(path,{method,ctx:admin,body:operation==='hide'?undefined:{...product,price:product.price+1,stock:product.stock+2,details:{...product.details,sku:'QA-NEW-SKU'}}});
    assert.equal(retry.status,operation==='create'?201:200);
  });
}

test('QA: hidden variants never reopen base SKU sales; re-enabling a variant uses only its own price and stock',async t=>{
  const {db,request,admin,customer,product,checkout}=await fixture(t);
  const variant={sku:'QA-VARIANT-ONLY',label:'QA variant',price:17000,stock:3};
  const created=await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:variant});assert.equal(created.status,201);
  const id=created.data.id;
  assert.equal((await request('/admin/variants/'+id,{method:'PUT',ctx:admin,body:{...variant,active:0}})).status,200);
  const detail=await request('/products/1');assert.equal(detail.data.stock,0);assert.equal(detail.data.has_variants,true);assert.deepEqual(detail.data.variants,[]);
  for (const path of ['/products','/catalog']) {
    const result=await request(path),rows=Array.isArray(result.data)?result.data:result.data.items;
    assert.equal(rows.find(p=>p.id===1).stock,0);
  }
  const manage=await request('/admin/products',{ctx:admin});assert.equal(manage.data.find(p=>p.id===1).all_variants[0].active,0);
  for (const items of [[{id:1,quantity:1}],[{id:1,quantity:1,variant_id:id}]]) {
    assert.equal((await request('/checkout/quote',{method:'POST',ctx:customer,body:{...checkout,items}})).status,400);
    assert.equal((await request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:{...checkout,items}})).status,400);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,product.stock);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id=?').get(id).stock,3);
  assert.equal((await request('/admin/inventory',{method:'POST',ctx:admin,body:{product_id:1,delta:1,reason:'QA cannot modify base stock'}})).status,400);
  assert.equal((await request('/admin/variants/'+id,{method:'PUT',ctx:admin,body:{...variant,active:1}})).status,200);
  const order=await request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:{...checkout,items:[{id:1,quantity:1,variant_id:id}]}});
  assert.equal(order.status,201);assert.equal(order.data.total,17000+30000);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id=?').get(id).stock,2);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,product.stock);
});

test('QA: every checkout requires a valid idempotency key; concurrent retries create exactly one order',async t=>{
  const {db,request,customer,product,checkout}=await fixture(t);
  for (const ctx of [customer,{}]) {
    for (const key of [undefined,'','short']) {
      const result=await request('/orders',{method:'POST',ctx,key,body:{...checkout,email:'qa-guest@example.test'}});
      assert.equal(result.status,400);
    }
  }
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,product.stock);
  const key=randomUUID(),send=body=>request('/orders',{method:'POST',ctx:customer,key,body});
  const first=await send(checkout);assert.equal(first.status,201);
  const repeats=await Promise.all([send(checkout),send(checkout),send(checkout)]);
  for (const result of repeats) { assert.equal(result.status,200);assert.deepEqual(result.data,first.data); }
  assert.equal((await send({...checkout,address:'Different address'})).status,409);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM checkout_requests').get().n,1);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,product.stock-1);
});

test('QA: product, variant and CSV SKU writes use the same trimmed identity, including legacy whitespace',async t=>{
  const {db,request,admin,product}=await fixture(t);
  const create=sku=>request('/admin/products',{method:'POST',ctx:admin,body:{...product,name:'QA SKU',details:{sku}}});
  const first=await create(' \tQA-TRIMMED\u00a0 ');assert.equal(first.status,201);
  const saved=db.prepare('SELECT details FROM products WHERE id=?').get(first.data.id);assert.equal(JSON.parse(saved.details).sku,'QA-TRIMMED');
  assert.equal((await create('QA-TRIMMED')).status,409);
  assert.equal((await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:{sku:' QA-TRIMMED ',label:'Duplicate',price:1,stock:1}})).status,409);
  const update=await request('/admin/products/'+first.data.id,{method:'PUT',ctx:admin,body:{...product,details:{sku:'\tQA-TRIMMED '}}});assert.equal(update.status,200);
  const csv=sku=>request('/admin/products/import',{method:'POST',ctx:admin,body:{rows:[{name:'CSV test',category:product.category,description:'Test',price:1,stock:1,image:'',active:1,sku}]}});
  assert.equal((await csv(' QA-TRIMMED ')).status,409);
  const createdVariant=await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:{sku:'\tQA-VARIANT\u00a0',label:'Variant',price:1,stock:1}});assert.equal(createdVariant.status,201);
  assert.equal(db.prepare('SELECT sku FROM product_variants WHERE id=?').get(createdVariant.data.id).sku,'QA-VARIANT');
  assert.equal((await create('QA-VARIANT')).status,409);
  assert.equal((await csv(' QA-VARIANT ')).status,409);
  // Simulate rows saved by the old release. Prevent new collisions without
  // silently renaming existing SKUs or changing order snapshots.
  db.prepare('UPDATE products SET details=? WHERE id=2').run(JSON.stringify({sku:'\t QA-LEGACY \u00a0'}));
  db.prepare('UPDATE product_variants SET sku=? WHERE id=?').run('\tQA-LEGACY-VARIANT\u00a0',createdVariant.data.id);
  for(const sku of ['QA-LEGACY','QA-LEGACY-VARIANT']) {
    assert.equal((await create(sku)).status,409);assert.equal((await csv(sku)).status,409);
    assert.equal((await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:{sku,label:'Duplicate legacy',price:1,stock:1}})).status,409);
  }
  assert.equal(JSON.parse(db.prepare('SELECT details FROM products WHERE id=2').get().details).sku,'\t QA-LEGACY \u00a0');
});

test('QA: successful price edits record both old and new amounts in the same audit transaction',async t=>{
  const {db,request,admin,product}=await fixture(t);
  assert.equal((await request('/admin/products/1',{method:'PUT',ctx:admin,body:{...product,price:product.price+1000}})).status,200);
  const note=JSON.parse(db.prepare("SELECT note FROM audit_log WHERE action='product_update' ORDER BY id DESC LIMIT 1").get().note);
  assert.equal(note.before.price,product.price);assert.equal(note.after.price,product.price+1000);
});
