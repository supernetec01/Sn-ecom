import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../store.js';
import { createApp } from '../server.js';
import { addressMetadata, listProvinces, listWards, validateVietnamAddress } from '../vietnam-addresses.js';

test('The pinned two-tier Vietnam dataset has 34 provinces and 3321 unique wards with valid parents', () => {
 const provinces=listProvinces(),all=new Set();assert.equal(provinces.length,34);assert.equal(addressMetadata.version,'v5.2.0');
 const asset=JSON.parse(readFileSync(new URL('../public/datasets/vietnam-addresses.json',import.meta.url),'utf8'));
 assert.match(asset.source_commit,/^[a-f0-9]{40}$/);assert.match(asset.source_sha256,/^[a-f0-9]{64}$/);
 for(const province of provinces){assert.match(province.code,/^[0-9]{2}$/);assert.equal('districts' in province,false);const wards=listWards(province.code);assert.ok(wards.length);
  for(const ward of wards){assert.match(ward.code,/^[0-9]{5}$/);assert.equal(all.has(ward.code),false);all.add(ward.code);const address=validateVietnamAddress({country:'VN',province_code:province.code,ward_code:ward.code,address:'12 Nguyễn Du'});assert.equal(address.province_name,province.name);assert.equal(address.ward_name,ward.name);}
 }
 assert.equal(all.size,3321);assert.equal(listProvinces().find(p=>p.code==='01').name,'Thành phố Hà Nội');assert.equal(listWards('01').find(w=>w.code==='00004').name,'Phường Ba Đình');assert.ok(asset.provinces.some(p=>p.wards.some(w=>w.name.startsWith('Đặc khu '))));
});

test('Shipping rejects foreign and mismatched locations, snapshots canonical names, and flags legacy saved addresses',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'sn-vn-'));const db=openStore(dir),server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});});
 let context={};async function request(path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:{origin:base,'content-type':'application/json',...(path==='/orders'&&method==='POST'?{'Idempotency-Key':randomUUID()}:{}),...context},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 let result=await request('/locations/provinces');assert.equal(result.data.provinces.length,34);result=await request('/locations/provinces/79/wards');assert.ok(result.data.wards.length>0);const hcmWard=result.data.wards[0].code;assert.equal((await request('/locations/provinces/99/wards')).status,404);
 result=await request('/register','POST',{name:'Address test',email:'vn-address@example.test',password:'vn-address-password-123'});context={cookie:result.cookie,'x-csrf-token':result.data.csrf};const uid=result.data.user.id;
 const product=db.prepare('SELECT * FROM products LIMIT 1').get();const good={recipient:'Khách hàng',phone:'0901234567',country:'VN',province_code:'01',ward_code:'00004',address:'12 Nguyễn Du',payment:'cod',items:[{id:product.id,quantity:1}]};
 for(const overrides of [{country:'US'},{province_code:'99'},{ward_code:'99999'},{ward_code:hcmWard},{province_code:1},{ward_code:4},{province_code:undefined},{ward_code:undefined}]){
  const payload={...good,...overrides};assert.equal((await request('/orders','POST',payload)).status,400);assert.equal((await request('/addresses','POST',payload)).status,400);assert.equal((await request('/checkout/quote','POST',payload)).status,400);
 }
 assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,product.stock);
 const spoof={...good,province_name:'USA',ward_name:'Fake ward',region:'Foreign region'};result=await request('/addresses','POST',spoof);assert.equal(result.status,201);const saved=db.prepare('SELECT * FROM addresses WHERE id=?').get(result.data.id);assert.equal(saved.province_code,'01');assert.equal(saved.ward_code,'00004');assert.equal(saved.country,'VN');assert.equal(saved.province_name,'Thành phố Hà Nội');assert.equal(saved.address,'12 Nguyễn Du');
 result=await request('/orders','POST',spoof);assert.equal(result.status,201);const order=db.prepare('SELECT * FROM orders WHERE id=?').get(result.data.id);assert.equal(order.address,'12 Nguyễn Du, Phường Ba Đình, Thành phố Hà Nội, Việt Nam');assert.equal(order.address_line,'12 Nguyễn Du');assert.equal(order.province_name,'Thành phố Hà Nội');assert.equal(order.ward_name,'Phường Ba Đình');assert.equal(order.region,'Hà Nội');assert.equal(order.address_version,'v5.2.0');
 db.prepare('INSERT INTO addresses(user_id,recipient,phone,address,region) VALUES(?,?,?,?,?)').run(uid,'Khách cũ','0901234567','123 địa chỉ cũ, Quận Ba Đình','Ha Noi');const legacy=db.prepare('SELECT * FROM addresses WHERE province_code=\'\'').get();const reopened=openStore(dir);assert.equal(reopened.prepare('SELECT address FROM addresses WHERE id=?').get(legacy.id).address,legacy.address);assert.equal(reopened.prepare('SELECT address FROM orders WHERE id=?').get(order.id).address,order.address);reopened.close();
 result=await request('/addresses');assert.equal(result.data.find(a=>a.id===legacy.id).needs_update,true);assert.equal(result.data.find(a=>a.id===saved.id).needs_update,false);
});
