import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../store.js';
import { createApp } from '../server.js';
import { createTranslationService } from '../translations.js';

function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'sn-translations-')),db=openStore(dir);
  t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
  return db;
}
const body={page_type:'product',page_id:1,source_language:'vi',target_language:'en'};
const resultFor = input => ({ok:true,json:async()=>({data:{translations:JSON.parse(input.body).q.map(q=>({translatedText:'Translated '+q}))}})});

test('Translation reads only public fields, preserves protected terms, caches and invalidates edited source',async t=>{
  const db=fixture(t),requests=[];
  db.prepare('UPDATE products SET name=?,description=?,price=?,details=? WHERE id=1').run('Super Net bình 500 ml','Mô tả riêng cho thử nghiệm',987654321,JSON.stringify({sku:'SECRET-SKU-999',summary:'Sản phẩm Super Net 500 ml'}));
  const settings=JSON.parse(db.prepare('SELECT value FROM settings').get().value);
  settings.bankAccount='PRIVATE-BANK-DATA';settings.policies=[{title:'PRIVATE-POLICY-TITLE',body:'PRIVATE-POLICY-CONTENT'}];
  db.prepare('UPDATE settings SET value=?').run(JSON.stringify(settings));
  const original=db.prepare('SELECT * FROM products WHERE id=1').get();
  const service=createTranslationService(db,{apiKey:()=> 'test-placeholder',fetchImpl:async(url,input)=>{assert.equal(url,'https://translation.googleapis.com/language/translate/v2');requests.push(input);return resultFor(input);}});
  const first=await service.translate(body);assert.equal(first.mode,'translated');
  assert.equal(first.translations.find(x=>x.source===original.name).translated,'Translated Super Net bình 500 ml');
  assert.equal(requests.length,1);
  assert.ok(!requests[0].body.includes('Super Net'));assert.ok(!requests[0].body.includes('987654321'));assert.ok(!requests[0].body.includes('SECRET-SKU-999'));
  const cached=await service.translate(body);assert.deepEqual(cached.translations,first.translations);assert.equal(requests.length,1);
  assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=1').get(),original);
  db.prepare('UPDATE products SET description=? WHERE id=1').run('Nội dung đã sửa');
  const edited=await service.translate(body);assert.equal(requests.length,2);assert.ok(edited.translations.some(x=>x.source==='Nội dung đã sửa'));assert.ok(!edited.translations.some(x=>x.source===original.description));
  await service.translate({page_type:'storefront',target_language:'en'});
  const wire=requests.map(r=>r.body).join('');assert.ok(!wire.includes('PRIVATE-BANK-DATA'));assert.ok(!wire.includes('PRIVATE-POLICY'));
  const log=db.prepare('SELECT * FROM translation_api_usage LIMIT 1').get();assert.ok(!('source' in log));assert.ok(!('api_key' in log));
});

test('Missing key, provider failure and daily budget fall back to source without writing catalog data',async t=>{
  const db=fixture(t);let calls=0;
  const noKey=createTranslationService(db,{apiKey:()=>'',fetchImpl:()=>{calls++;throw Error('unexpected');}});
  assert.equal((await noKey.translate(body)).mode,'unavailable');assert.equal(calls,0);
  const noBudget=createTranslationService(db,{apiKey:()=> 'test-placeholder',dailyLimit:()=>0,fetchImpl:()=>{calls++;throw Error('unexpected');}});
  assert.equal((await noBudget.translate(body)).mode,'limited');assert.equal(calls,0);
  const failed=createTranslationService(db,{apiKey:()=> 'test-placeholder',fetchImpl:async()=>{calls++;throw Error('unavailable');}});
  assert.equal((await failed.translate(body)).mode,'unavailable');assert.equal(calls,1);
  assert.equal((await failed.translate(body)).mode,'unavailable');assert.equal(calls,1);
  assert.equal(db.prepare('SELECT count(*) n FROM translation_cache').get().n,0);
  const source=await failed.translate({...body,target_language:'vi'});assert.equal(source.mode,'source');assert.equal(calls,1);
});

test('Concurrent identical translation requests share provider work; cached text works without credentials',async t=>{
  const db=fixture(t);let calls=0,release;
  const ready=new Promise(resolve=>{release=resolve;});
  const service=createTranslationService(db,{apiKey:()=> 'test-placeholder',fetchImpl:async(_url,input)=>{calls++;await ready;return resultFor(input);}});
  const one=service.translate(body),two=service.translate({...body});assert.equal(calls,1);release();
  assert.deepEqual(await one,await two);
  const offline=createTranslationService(db,{apiKey:()=>'',dailyLimit:()=>0});assert.equal((await offline.translate(body)).mode,'translated');
  db.prepare('UPDATE translation_cache SET expires=0').run();
  assert.equal((await offline.translate(body)).mode,'unavailable');
});

test('Malformed provider output or damaged protected numbers is never cached as a complete translation',async t=>{
  const db=fixture(t);
  db.prepare('UPDATE products SET name=? WHERE id=1').run('Super Net 123');
  const service=createTranslationService(db,{apiKey:()=> 'test-placeholder',fetchImpl:async(_url,input)=>({ok:true,json:async()=>({data:{translations:JSON.parse(input.body).q.map(()=>({translatedText:'Missing placeholders'}))}})})});
  const result=await service.translate(body);assert.equal(result.mode,'partial');assert.ok(!result.translations.some(x=>x.source==='Super Net 123'));
  const malformed=createTranslationService(db,{apiKey:()=> 'test-placeholder',fetchImpl:async()=>({ok:true,json:async()=>({data:{translations:[]}})})});
  assert.ok(['unavailable','partial'].includes((await malformed.translate({...body,target_language:'zh-TW'})).mode));
});

test('Translation endpoint rejects arbitrary text, private page types, unsupported languages, hidden products and invalid origin',async t=>{
  const db=fixture(t);
  const server=createApp(db,{translation:{apiKey:()=>''}}).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(data,origin=base)=>fetch(base+'/api/i18n/translate-page',{method:'POST',headers:{'content-type':'application/json',Origin:origin},body:JSON.stringify(data)});
  assert.equal((await request({...body,texts:['private browser text']})).status,400);
  assert.equal((await request({...body,page_type:'order'})).status,400);
  assert.equal((await request({...body,target_language:'zh-CN'})).status,400);
  assert.equal((await request({...body,source_language:'en'})).status,400);
  assert.equal((await request({...body,page_id:'1'})).status,400);
  assert.equal((await request({...body,page_type:'products',product_ids:Array(25).fill(1)})).status,400);
  assert.equal((await request(body,'https://different.example')).status,403);
  db.prepare('UPDATE products SET active=0 WHERE id=1').run();
  assert.equal((await request(body)).status,404);
  assert.equal((await request({...body,page_id:2})).status,200);
  // The public translation endpoint still requires CSRF when a session is present.
  const register=await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({name:'Test',email:'language@example.test',password:'language-password-123'})});
  const session=await register.json(),cookie=register.headers.get('set-cookie').split(';')[0];
  const logged=async(csrf)=>fetch(base+'/api/i18n/translate-page',{method:'POST',headers:{'content-type':'application/json',Origin:base,Cookie:cookie,...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify({...body,page_id:2})});
  assert.equal((await logged()).status,403);assert.equal((await logged(session.csrf)).status,200);
});
