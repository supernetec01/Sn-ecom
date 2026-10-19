import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startDemo } from '../scripts/demo.js';
import { demoEnvironment, demoDataDir, quickTunnelOrigin } from '../scripts/demo-config.js';
import { openStore, hashPassword } from '../store.js';

async function freePort() {
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
function tunnelFixture(t, code="console.error('Visit https://isolated-store-demo.trycloudflare.com');setInterval(()=>{},1000);") {
  const dir=mkdtempSync(path.join(tmpdir(),'sn-demo-test-'));
  const script=path.join(dir,'tunnel.cjs');writeFileSync(script,code);
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return {dir,dataDir:path.join(dir,'data'),cloudflared:{command:process.execPath,args:[script]}};
}
async function isClosed(port) {
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});
  await new Promise(resolve=>probe.close(resolve));
}

test('Demo configuration uses separate persistent data, a strict HTTPS origin and no paid provider credentials',()=>{
  const names=['DATA_DIR','AI_API_KEY','EMAIL_API_KEY','TRANSLATION_API_KEY','VNPAY_TMN_CODE','TUNNEL_TOKEN','TUNNEL_NAME','TUNNEL_ALLOWED_MAIL'];
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try {
    for(const name of names)process.env[name]='test-inherited-value';
    const env=demoEnvironment({origin:'https://isolated-store-demo.trycloudflare.com'});
    assert.equal(env.DATA_DIR,demoDataDir);assert.notEqual(env.DATA_DIR,process.env.DATA_DIR);
    for(const name of names.slice(1).filter(name=>!name.startsWith('TUNNEL_')))assert.equal(env[name],'');
    for(const name of names.filter(name=>name.startsWith('TUNNEL_')))assert.equal(Object.hasOwn(env,name),false);
    assert.equal(env.NODE_ENV,'production');assert.equal(env.HOST,'127.0.0.1');assert.equal(env.TRUST_PROXY,'loopback');
    assert.equal(quickTunnelOrigin('prefix https://isolated-store-demo.trycloudflare.com suffix'),env.APP_ORIGIN);
    for(const input of ['http://example.trycloudflare.com','https://example.com','https://example.trycloudflare.com.evil.test']) {
      assert.equal(quickTunnelOrigin(input),undefined);
    }
  } finally {for(const name of names)if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}
});

test('Demo starts a real production server, supports public-origin login and checkout, stops cleanly and retains data',async t=>{
  const fixture=tunnelFixture(t),port=await freePort(),logs=[];
  const local='http://127.0.0.1:'+port;
  // Only the public edge is simulated. All application requests hit a real HTTP
  // server/SQLite database; no Cloudflare site is published by the test.
  const request=(url,options)=>fetch(url.startsWith('https://')?local+new URL(url).pathname:url,options);
  let demo;
  try {
    demo=await startDemo({...fixture,port,request,timeoutMs:8000,log:line=>logs.push(line)});
    assert.equal(demo.origin,'https://isolated-store-demo.trycloudflare.com');
    assert.ok(logs.some(line=>line.includes('Link demo: '+demo.origin)));
    async function api(route,{method='GET',body,ctx={},origin=demo.origin}={}) {
      const response=await fetch(local+'/api'+route,{method,headers:{Origin:origin,'Content-Type':'application/json','X-Forwarded-For':'198.51.100.23','X-Forwarded-Proto':'https',...ctx},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
    }
    assert.equal((await api('/register',{method:'POST',origin:'https://wrong.example',body:{}})).status,403);
    const customer=await api('/register',{method:'POST',body:{name:'Demo buyer',email:'demo-buyer@example.test',password:'demo-customer-password'}});
    assert.equal(customer.status,201);assert.match(customer.cookie,/; Secure/);assert.match(customer.cookie,/; HttpOnly/);
    const ctx={Cookie:customer.cookie.split(';')[0],'X-CSRF-Token':customer.data.csrf};
    const products=(await api('/products')).data;assert.equal(products.length,16);
    const db=openStore(fixture.dataDir);
    db.prepare("INSERT INTO users(email,name,password,role) VALUES('demo-admin@example.test','Demo admin',?,'admin')").run(hashPassword('demo-admin-test-password'));
    db.close();
    const admin=await api('/login',{method:'POST',body:{email:'demo-admin@example.test',password:'demo-admin-test-password'}});
    assert.equal(admin.status,200);
    assert.equal((await api('/admin/products',{ctx:{Cookie:admin.cookie.split(';')[0]}})).status,200);
    assert.equal((await api('/admin/products',{ctx})).status,403);
    const order=await api('/orders',{method:'POST',ctx:{...ctx,'Idempotency-Key':crypto.randomUUID()},body:{country:'VN',province_code:'01',ward_code:'00004',recipient:'Demo buyer',phone:'0901234567',address:'123 Demo street',payment:'cod',items:[{id:products[0].id,quantity:1}]}});
    assert.equal(order.status,201);
    assert.equal((await api('/products/'+products[0].id)).data.stock,products[0].stock-1);
    await demo.stop();await demo.done;await isClosed(port);
    demo=await startDemo({...fixture,port,request,timeoutMs:8000,log:()=>{}});
    const login=await api('/login',{method:'POST',body:{email:'demo-buyer@example.test',password:'demo-customer-password'}});
    assert.equal(login.status,200);
    const orders=await api('/orders',{ctx:{Cookie:login.cookie.split(';')[0]}});
    assert.equal(orders.data.length,1);assert.equal(orders.data[0].id,order.data.id);
    assert.equal((await api('/products/'+products[0].id)).data.stock,products[0].stock-1);
    const reopened=openStore(fixture.dataDir);
    assert.deepEqual(reopened.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);
    assert.deepEqual(reopened.prepare('PRAGMA foreign_key_check').all(),[]);reopened.close();
  } finally {if(demo){await demo.stop();await demo.done;}}
  await isClosed(port);
});

test('Demo never takes over an occupied port or starts the app when the tunnel fails',async t=>{
  const fixture=tunnelFixture(t,"console.error('simulated tunnel unavailable');process.exit(1);");
  const occupied=createServer();await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
  try {await assert.rejects(startDemo({...fixture,port:occupied.address().port,log:()=>{}}),/đang được dùng/);}
  finally {await new Promise(resolve=>occupied.close(resolve));}
  assert.equal(existsSync(fixture.dataDir),false);
  const port=await freePort();
  await assert.rejects(startDemo({...fixture,port,log:()=>{},timeoutMs:2000}),/Cloudflare Tunnel đã dừng/);
  assert.equal(existsSync(fixture.dataDir),false);await isClosed(port);
});

test('A non-working public endpoint fails readiness and releases both server and tunnel',async t=>{
  const fixture=tunnelFixture(t),port=await freePort();
  const request=(url,options)=>url.startsWith('https://')?Promise.resolve({ok:false}):fetch(url,options);
  await assert.rejects(startDemo({...fixture,port,request,log:()=>{},timeoutMs:1200}),/chưa truy cập được link Cloudflare/);
  await isClosed(port);
});

test('A tunnel exiting during a demo closes the application and reports the failure',async t=>{
  const fixture=tunnelFixture(t),port=await freePort(),pidFile=path.join(fixture.dir,'tunnel.pid');
  writeFileSync(fixture.cloudflared.args[0],`require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));console.error('https://isolated-store-demo.trycloudflare.com');setInterval(()=>{},1000);`);
  const local='http://127.0.0.1:'+port;
  const request=(url,options)=>fetch(url.startsWith('https://')?local+new URL(url).pathname:url,options);
  const demo=await startDemo({...fixture,port,request,timeoutMs:8000,log:()=>{}});
  try {
    const {readFileSync}=await import('node:fs');
    const done=assert.rejects(demo.done,/Cloudflare Tunnel đã dừng/);
    process.kill(Number(readFileSync(pidFile,'utf8')),'SIGTERM');
    await done;await demo.stop();await isClosed(port);
  } finally {await demo.stop();}
});
