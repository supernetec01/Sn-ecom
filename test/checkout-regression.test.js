import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../store.js';
import { createApp } from '../server.js';

test('Checkout validates phones and atomically replays requests without consuming extra stock', async () => {
 const dir=mkdtempSync(join(tmpdir(),'sn-checkout-')); const db=openStore(dir);
 const server=createApp(db).listen(0,'127.0.0.1'); await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 async function post(path,body,headers={}) {const r=await fetch(base+'/api'+path,{method:'POST',headers:{origin:base,'content-type':'application/json',...headers},body:JSON.stringify(body)}); return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try {
  const a=await post('/register',{name:'Regression',email:'regression@example.test',password:'test-password-123456'});
  assert.equal(a.status,201);
  const headers={cookie:a.cookie,'x-csrf-token':a.data.csrf};
  const p=db.prepare('SELECT * FROM products WHERE stock>5 LIMIT 1').get();
  const order={country:'VN',province_code:'01',ward_code:'00004',items:[{id:p.id,quantity:1}],payment:'cod',recipient:'Tester',address:'123 Test address',phone:'0901234567'};
  for(const phone of ['---------','         ','()()()()()','123','090abc1234567']) assert.equal((await post('/orders',{...order,phone},headers)).status,400);
  assert.equal((await post('/orders',{...order,items:[null]},headers)).status,400);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);
  const key='checkout-request-000001';const keyed={...headers,'Idempotency-Key':key};
  const first=await post('/orders',{...order,phone:'(+84) 901-234-567'},keyed);assert.equal(first.status,201);
  const repeats=await Promise.all(Array.from({length:3},()=>post('/orders',{...order,phone:'+84901234567'},keyed)));
  for(const r of repeats){assert.equal(r.status,200);assert.deepEqual(r.data,first.data);}
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(p.id).stock,p.stock-1);
  assert.equal(db.prepare('SELECT phone FROM orders WHERE id=?').get(first.data.id).phone,'+84901234567');
  assert.equal((await post('/orders',{...order,phone:'+84901234567',address:'456 Other address'},keyed)).status,409);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);
  assert.equal((await post('/orders',order,{...headers,'Idempotency-Key':'short'})).status,400);
  const second=await post('/orders',order,{...headers,'Idempotency-Key':'checkout-request-000002'});assert.equal(second.status,201);assert.notEqual(second.data.id,first.data.id);
  // The ledger survives reopening an existing database, including exhausted stock.
  const reopened=openStore(dir);assert.equal(reopened.prepare('SELECT count(*) n FROM checkout_requests').get().n,2);reopened.close();
  db.prepare('UPDATE products SET stock=0 WHERE id=?').run(p.id);
  assert.equal((await post('/orders',{...order,phone:'+84901234567'},keyed)).data.id,first.data.id);
 } finally {await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
});
