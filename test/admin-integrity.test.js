import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';
import { parseCsv } from '../public/csv.js';
import { openStore, hashPassword, readProduct } from '../store.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sn-admin-integrity-')), db = openStore(dir);
  const password = 'isolated-admin-test-password';
  for (const role of ['admin', 'customer']) db.prepare('INSERT INTO users(email,name,password,role) VALUES(?,?,?,?)').run(role+'@example.test', role, hashPassword(password), role);
  const server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:'+server.address().port;
  async function request(path, { method = 'GET', body, ctx = {}, key } = {}) {
    const r = await fetch(base+'/api'+path, { method, headers: { Origin: base, 'Content-Type':'application/json', ...ctx, ...(key ? {'Idempotency-Key':key} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status:r.status, cookie:r.headers.get('set-cookie')?.split(';')[0], data: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text() };
  }
  // Logins need their own Set-Cookie header.
  const contexts = {};
  for (const role of ['admin','customer']) {
    const r = await fetch(base+'/api/login', { method:'POST', headers:{Origin:base,'Content-Type':'application/json'}, body:JSON.stringify({email:role+'@example.test',password}) });
    const data = await r.json(); assert.equal(r.status, 200);
    contexts[role] = {Cookie:r.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':data.csrf};
  }
  const product = () => readProduct(db.prepare('SELECT * FROM products WHERE id=1').get());
  const checkout = {country:'VN',province_code:'01',ward_code:'00004',recipient:'QA Buyer',phone:'0901234567',address:'123 QA street',payment:'cod',items:[{id:1,quantity:1}]};
  const snapshot = () => Object.fromEntries(['products','product_variants','inventory_movements','audit_log','settings','reviews'].map(name => [name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
  return { db, request, product, checkout, snapshot, ...contexts };
}

test('Admin description save preserves stock sold after opening the form and rejects stale content', async t => {
  const {db,request,product,checkout,admin,customer} = await fixture(t);
  db.prepare('UPDATE products SET stock=32 WHERE id=1').run();
  const opened = product();
  assert.equal((await request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:checkout})).status,201);
  assert.equal(product().stock,31);
  const movements = db.prepare('SELECT * FROM inventory_movements').all();
  const saved = await request('/admin/products/1',{method:'PATCH',ctx:admin,body:{revision:opened.revision,description:'Description changed while a customer bought'}});
  assert.equal(saved.status,200); assert.equal(product().stock,31);
  assert.equal(product().description,'Description changed while a customer bought');
  assert.deepEqual(db.prepare('SELECT * FROM inventory_movements').all(),movements);
  assert.equal((await request('/admin/products/1',{method:'PATCH',ctx:admin,body:{revision:opened.revision,price:1}})).status,409);
  assert.equal((await request('/admin/products/1',{method:'PATCH',ctx:admin,body:{revision:product().revision,stock:99}})).status,400);
});

test('Legacy product PUT requires both revisions and rejects stock ABA without any partial writes', async t => {
  const {db,request,product,snapshot,admin} = await fixture(t);
  const opened=product();
  db.prepare('UPDATE products SET stock=stock-1 WHERE id=1').run();
  db.prepare('UPDATE products SET stock=stock+1 WHERE id=1').run();
  const before=snapshot();
  assert.equal((await request('/admin/products/1',{method:'PUT',ctx:admin,body:{...opened,description:'stale'}})).status,409);
  assert.deepEqual(snapshot(),before);
  const {revision,stock_revision,...unversioned}=product();
  assert.equal((await request('/admin/products/1',{method:'PUT',ctx:admin,body:unversioned})).status,428);
  assert.deepEqual(snapshot(),before);
  assert.equal((await request('/admin/products/1',{method:'PUT',ctx:admin,body:{...product(),description:'fresh'}})).status,200);
});

test('Variant metadata preserves concurrent stock while stale PUT and CSV imports roll back', async t => {
  const {db,request,product,snapshot,admin} = await fixture(t);
  const create=await request('/admin/products/1/variants',{method:'POST',ctx:admin,body:{sku:'QA-INTEGRITY',label:'Red',price:1000,stock:32}});
  assert.equal(create.status,201); const id=create.data.id;
  const opened=db.prepare('SELECT * FROM product_variants WHERE id=?').get(id);
  db.prepare('UPDATE product_variants SET stock=31 WHERE id=?').run(id);
  let before=snapshot();
  assert.equal((await request('/admin/variants/'+id,{method:'PUT',ctx:admin,body:{...opened,label:'Stale'}})).status,409);
  assert.deepEqual(snapshot(),before);
  assert.equal((await request('/admin/variants/'+id,{method:'PATCH',ctx:admin,body:{revision:opened.revision,label:'Blue'}})).status,200);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id=?').get(id).stock,31);
  const old=product(); db.prepare('UPDATE products SET stock=stock-1 WHERE id=1').run();
  const row={id:1,name:old.name,category:old.category,description:'stale csv',price:old.price,stock:old.stock,image:old.image,active:old.active,revision:String(old.revision),stock_revision:String(old.stock_revision)};
  before=snapshot();
  const newRow={...row,id:'',name:'Must roll back'};
  assert.equal((await request('/admin/products/import',{method:'POST',ctx:admin,body:{rows:[newRow,row]}})).status,409);
  assert.deepEqual(snapshot(),before);
  delete row.revision; delete row.stock_revision;
  assert.equal((await request('/admin/products/import',{method:'POST',ctx:admin,body:{rows:[row]}})).status,428);
  const fresh=product();
  assert.equal((await request('/admin/products/import',{method:'POST',ctx:admin,body:{rows:[{...row,revision:String(fresh.revision),stock_revision:String(fresh.stock_revision),stock:fresh.stock}]}})).status,200);
  const csv=await request('/admin/export/products',{ctx:admin}); assert.equal(csv.status,200);
  const exported=parseCsv(csv.data);assert.ok(Object.hasOwn(exported[0],'revision'));assert.ok(Object.hasOwn(exported[0],'stock_revision'));
  const productsBefore=db.prepare('SELECT * FROM products ORDER BY id').all();
  assert.equal((await request('/admin/products/import',{method:'POST',ctx:admin,body:{rows:exported}})).status,200);
  assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(),productsBefore);
});

test('Review audit failure rolls back publication; retry succeeds once and missing reviews return 404', async t => {
  const {db,request,snapshot,admin}=await fixture(t);
  const buyer=db.prepare("SELECT id FROM users WHERE role='customer'").get().id;
  const id=Number(db.prepare("INSERT INTO reviews(user_id,product_id,rating,body,created) VALUES(?,1,5,'QA review',?)").run(buyer,new Date().toISOString()).lastInsertRowid);
  const before=snapshot();
  db.exec("CREATE TEMP TRIGGER fail_review_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  assert.equal((await request('/admin/reviews/'+id,{method:'PATCH',ctx:admin,body:{status:'approved'}})).status,500);
  assert.deepEqual(snapshot(),before);
  assert.equal((await request('/products/1/reviews')).data.length,0);
  db.exec('DROP TRIGGER fail_review_audit');
  assert.equal((await request('/admin/reviews/'+id,{method:'PATCH',ctx:admin,body:{status:'approved'}})).status,200);
  assert.equal((await request('/products/1/reviews')).data.length,1);
  const count=db.prepare("SELECT count(*) n FROM audit_log WHERE action='review'").get().n;
  assert.equal((await request('/admin/reviews/'+id,{method:'PATCH',ctx:admin,body:{status:'approved'}})).status,200);
  assert.equal(db.prepare("SELECT count(*) n FROM audit_log WHERE action='review'").get().n,count);
  assert.equal((await request('/admin/reviews/99999',{method:'PATCH',ctx:admin,body:{status:'approved'}})).status,404);
});

test('Audit API exposes legacy and new price changes safely, including zero and malformed notes', async t => {
  const {db,request,admin}=await fixture(t);
  const insert=db.prepare("INSERT INTO audit_log(action,target,note,created) VALUES('product_update','1',?,?)");
  for(const note of [JSON.stringify({before:{price:1000,stock:1,password:'secret'},after:{price:0,stock:0,bankAccount:'sensitive'}}),JSON.stringify({entity:'product',entity_id:'1',details:{before:{price:5},after:{price:6},password:'secret'}}),'old plain text', 'null', '[]']) insert.run(note,new Date().toISOString());
  const result=await request('/admin/audit',{ctx:admin}); assert.equal(result.status,200);
  assert.ok(result.data.some(r=>r.details.before?.price===1000&&r.details.after?.price===0));
  assert.ok(result.data.some(r=>r.details.before?.price===5&&r.details.after?.price===6));
  assert.ok(!JSON.stringify(result.data).includes('secret')); assert.ok(!JSON.stringify(result.data).includes('sensitive'));
});

test('Legacy settings PUT and category writes enforce the same revision as PATCH and audit failures roll back', async t => {
  const {db,request,snapshot,admin}=await fixture(t);
  const old=(await request('/admin/config',{ctx:admin})).data;
  assert.equal((await request('/admin/settings',{method:'PATCH',ctx:admin,body:{section:'policies',revision:old.revision,values:{policies:[{title:'New',body:'Preserve this'}]}}})).status,200);
  let before=snapshot();
  assert.equal((await request('/admin/settings',{method:'PUT',ctx:admin,body:{...old.settings,revision:old.revision}})).status,409);
  assert.equal((await request('/admin/settings',{method:'PUT',ctx:admin,body:old.settings})).status,428);
  assert.equal((await request('/admin/categories',{method:'POST',ctx:admin,body:{name:'Unversioned'}})).status,428);
  assert.deepEqual(snapshot(),before);
  const fresh=(await request('/admin/config',{ctx:admin})).data;
  db.exec("CREATE TEMP TRIGGER fail_config_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  assert.equal((await request('/admin/settings',{method:'PUT',ctx:admin,body:{...fresh.settings,revision:fresh.revision,heroTitle:'Must roll back'}})).status,500);
  assert.deepEqual(snapshot(),before); db.exec('DROP TRIGGER fail_config_audit');
  assert.equal((await request('/admin/settings',{method:'PUT',ctx:admin,body:{...fresh.settings,revision:fresh.revision,heroTitle:'Fresh write'}})).status,200);
  assert.equal(JSON.parse(db.prepare('SELECT value FROM settings').get().value).policies[0].body,'Preserve this');
  assert.equal(db.prepare('SELECT revision FROM settings').get().revision,fresh.revision+1);
});

test('Concurrent orders, stale stock edits and cancellation reconcile inventory movements exactly', async t => {
  const {db,request,product,checkout,snapshot,admin,customer}=await fixture(t);
  db.prepare('UPDATE products SET stock=2 WHERE id=1').run();
  const opened=product();
  const first=await request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:checkout});assert.equal(first.status,201);
  const [second,stale]=await Promise.all([
    request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:checkout}),
    request('/admin/products/1',{method:'PUT',ctx:admin,body:{...opened,description:'Must not resurrect stock'}}),
  ]);
  assert.equal(second.status,201);assert.equal(stale.status,409);assert.equal(product().stock,0);
  const before=snapshot();
  assert.equal((await request('/orders',{method:'POST',ctx:customer,key:randomUUID(),body:checkout})).status,400);
  assert.deepEqual(snapshot(),before);
  for(const id of [first.data.id,second.data.id])assert.equal((await request('/orders/'+id+'/cancel',{method:'POST',ctx:customer,body:{}})).status,200);
  assert.equal(product().stock,2);
  assert.equal(db.prepare('SELECT SUM(delta) n FROM inventory_movements WHERE product_id=1').get().n,0);
  assert.equal(product().stock_revision,opened.stock_revision+4);
  assert.equal(product().revision,opened.revision);
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check),['ok']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('48 role checks protect new and legacy writes and audit details at the API boundary', async t => {
  const {db,request,snapshot,admin,customer}=await fixture(t);
  const roles={admin,customer};
  for(const role of ['manager','editor','sales','inventory']){
    db.prepare('INSERT INTO users(email,name,password,role) VALUES(?,?,?,?)').run(role+'@example.test',role,hashPassword('role-check-password'),role);
    const response=await request('/login',{method:'POST',body:{email:role+'@example.test',password:'role-check-password'}});
    assert.equal(response.status,200);
    roles[role]={Cookie:response.cookie,'X-CSRF-Token':response.data.csrf};
  }
  const products=['admin','manager','inventory'],marketing=['admin','manager','editor'];
  const cases=[
    ['PATCH','/admin/products/1',{},products,428],
    ['PUT','/admin/products/1',{},products,400],
    ['PATCH','/admin/variants/99999',{},products,404],
    ['PATCH','/admin/reviews/99999',{status:'approved'},marketing,404],
    ['PUT','/admin/settings',{},['admin'],428],
    ['PATCH','/admin/settings',{},['admin','editor'],400],
    ['GET','/admin/audit',undefined,['admin'],200],
    ['POST','/admin/products/import',{rows:[]},products,400],
  ];
  const before=snapshot();let checked=0;
  for(const [role,ctx] of Object.entries(roles))for(const [method,path,body,allowed,status] of cases){
    assert.equal((await request(path,{method,body,ctx})).status,allowed.includes(role)?status:403,role+' '+method+' '+path);checked++;
  }
  assert.equal(checked,48);assert.deepEqual(snapshot(),before);
});

test('Revision migration preserves every existing value and is repeatable without resetting revisions', () => {
  const dir=mkdtempSync(join(tmpdir(),'sn-admin-migration-'));let db;
  try {
    db=openStore(dir);
    db.prepare("INSERT INTO product_variants(product_id,sku,label,price,stock) VALUES(1,'MIGRATION-SKU','Existing variant',123,4)").run();
    db.prepare("INSERT INTO audit_log(action,target,note,created) VALUES('product_update','1','{\"before\":{\"price\":1},\"after\":{\"price\":2}}','2026-10-19')").run();
    const user=Number(db.prepare("INSERT INTO users(email,name,password,role) VALUES('migration@example.test','Existing user',?,'admin')").run(hashPassword('existing-migration-password')).lastInsertRowid);
    db.prepare("INSERT INTO sessions(token,user_id,csrf,expires) VALUES('existing-session-hash',?,'existing-csrf',1999999999999)").run(user);
    const item=db.prepare('SELECT * FROM products WHERE id=1').get();
    const order=Number(db.prepare("INSERT INTO orders(user_id,created,status,total,shipping,payment,recipient,address,phone,items,bank) VALUES(?,'2026-10-19','completed',?,0,'cod','Existing recipient','Existing address','0901234567',?,'{}')").run(user,item.price,JSON.stringify([{id:item.id,name:item.name,price:item.price,quantity:1}])).lastInsertRowid);
    db.prepare("INSERT INTO payment_transactions(order_id,kind,amount,reference,actor,created) VALUES(?,'receipt',?,'EXISTING-RECEIPT',?,'2026-10-19')").run(order,item.price,user);
    db.prepare("INSERT INTO reviews(user_id,product_id,rating,body,status,created) VALUES(?,1,5,'Existing published review','approved','2026-10-19')").run(user);
    db.close();db=new DatabaseSync(join(dir,'store.sqlite'));
    for(const table of ['products','product_variants']){
      db.exec(`DROP TRIGGER ${table}_content_revision; DROP TRIGGER ${table}_stock_revision; ALTER TABLE ${table} DROP COLUMN revision; ALTER TABLE ${table} DROP COLUMN stock_revision;`);
    }
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const before=Object.fromEntries(tables.map(({name})=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
    db.close();db=openStore(dir);
    for(const {name} of tables){
      const columns=Object.keys(before[name][0]||{});
      if(columns.length)assert.deepEqual(db.prepare('SELECT '+columns.join(',')+' FROM '+name+' ORDER BY rowid').all(),before[name],name);
      else assert.equal(db.prepare('SELECT COUNT(*) n FROM '+name).get().n,0,name);
    }
    db.prepare('UPDATE products SET stock=stock-1,description=? WHERE id=1').run('Post-migration content');
    const expected=db.prepare('SELECT * FROM products WHERE id=1').get();
    assert.equal(expected.revision,1);assert.equal(expected.stock_revision,1);
    db.close();db=openStore(dir);
    assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=1').get(),expected);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('products_content_revision','products_stock_revision','product_variants_content_revision','product_variants_stock_revision')").get().n,4);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check),['ok']);
  } finally {db?.close();rmSync(dir,{recursive:true,force:true});}
});
