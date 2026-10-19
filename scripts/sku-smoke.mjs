import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { openStore,hashPassword } from '../store.js';
import { createApp } from '../server.js';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
const dir=mkdtempSync(join(tmpdir(),'sn-sku-browser-')),db=openStore(dir),password=randomBytes(20).toString('hex');
db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('SKU Admin','sku-admin@example.test',hashPassword(password));
const server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',error=>errors.push(error.message));
 await p.goto(base+'/#account');await p.locator('#auth [name=email]').fill('sku-admin@example.test');await p.locator('#auth [name=password]').fill(password);await p.locator('#auth button.primary').click();await p.locator('#logout').waitFor();
 await p.goto(base+'/#admin/products');await p.locator('[data-product-new]').click();assert.equal(await p.locator('[data-sku-row]').count(),1);
 const imageFile=name=>fileURLToPath(new URL('../public/images/products/'+name,import.meta.url));
 const row=index=>p.locator('[data-sku-row]').nth(index),field=(index,key)=>row(index).locator('[data-sku-field="'+key+'"]');
 await p.locator('#product-form [name=name]').fill('Cốc ba màu QA');await p.locator('#product-form [name=active]').selectOption('1');
 await field(0,'sku').fill('QA-CUP-GREEN');await field(0,'label').fill('Xanh lá');await field(0,'price').fill('100000');await field(0,'stock').fill('10');
 await p.locator('#product-form [data-upload=image]').setInputFiles(imageFile('coc-su-morning.webp'));await p.waitForFunction(()=>document.querySelector('[data-sku-field=image]')?.value.startsWith('/uploads/'));
 await p.locator('[data-sku-add]').click();await row(1).locator('[data-sku-remove]').click();assert.equal(await p.locator('[data-sku-row]').count(),1);
 await p.locator('[data-sku-add]').click();await p.locator('[data-sku-add]').click();assert.equal(await p.locator('[data-sku-row]').count(),3);
 for(const [index,sku,label,price,stock] of [[1,'QA-CUP-RED','Đỏ',110000,3],[2,'QA-CUP-WHITE','Trắng',120000,0]]){await field(index,'sku').fill(sku);await field(index,'label').fill(label);await field(index,'price').fill(String(price));await field(index,'stock').fill(String(stock));}
 // Both uploads pause together; Save must stay disabled until all have finished.
 let release;const paused=new Promise(resolve=>release=resolve);await p.route('**/api/admin/upload',route=>paused.then(()=>route.continue()));
 await row(1).locator('[data-sku-upload]').setInputFiles(imageFile('binh-giu-nhiet-everyday.webp'));await row(2).locator('[data-sku-upload]').setInputFiles(imageFile('binh-nuoc-active.webp'));
 assert.equal(await p.locator('#product-form button[type=submit]').isDisabled(),true);release();
 await p.waitForFunction(()=>[...document.querySelectorAll('[data-sku-field=image]')].every(input=>input.value.startsWith('/uploads/')));await p.unroute('**/api/admin/upload');
 await p.locator('#product-form button[type=submit]').click();await p.getByText('Cốc ba màu QA',{exact:true}).waitFor();
 const product=db.prepare('SELECT * FROM products WHERE name=?').get('Cốc ba màu QA'),variants=()=>db.prepare('SELECT * FROM product_variants WHERE product_id=? ORDER BY id').all(product.id);
 assert.equal(variants().length,3);assert.equal(new Set(variants().map(v=>v.image)).size,3);assert.deepEqual(variants().map(v=>v.stock),[10,3,0]);
 await p.locator('#admin-query').fill('QA-CUP-RED');await p.locator('#admin-search button[type=submit]').click();await p.waitForFunction(()=>document.querySelectorAll('.admin-table tbody tr').length===1);assert.match(await p.locator('.admin-table tbody').innerText(),/3 SKU/);await p.locator('[data-clear-filters]').click();await p.locator('[data-product-edit="'+product.id+'"]').click();assert.equal(await p.locator('[data-sku-row]').count(),3);assert.equal(await p.locator('#product-form [name=stock]').count(),0);await field(1,'label').fill('Đỏ san hô');await field(0,'price').fill('101000');
 // A real sale while the edit form is open must survive a SKU-image/label save.
 const purchase=await p.evaluate(async({id,variant})=>{const me=await (await fetch('/api/me')).json();const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({country:'VN',province_code:'01',ward_code:'00004',recipient:'Buyer',phone:'0901234567',address:'123 QA street',payment:'cod',items:[{id,variant_id:variant,quantity:1}]})});return r.status;},{id:product.id,variant:variants()[0].id});assert.equal(purchase,201);
 const update=p.waitForResponse(r=>r.url().endsWith('/api/admin/products/'+product.id)&&r.request().method()==='PATCH');await p.locator('#product-form button[type=submit]').click();assert.equal((await update).status(),200);await p.locator('#product-form').waitFor({state:'hidden'});assert.equal(variants()[0].stock,9);assert.equal(variants()[0].price,101000);assert.equal(db.prepare('SELECT price FROM products WHERE id=?').get(product.id).price,product.price);
 // Convert an existing single SKU using the same editor; it must retain its SKU and live stock.
 const old=db.prepare('SELECT * FROM products WHERE id=1').get();await p.locator('[data-product-edit="1"]').click();assert.equal(await p.locator('[data-sku-row]').count(),1);await field(0,'label').fill('Màu gốc QA');const singleSave=p.waitForResponse(r=>r.url().endsWith('/api/admin/products/1')&&r.request().method()==='PATCH');await p.locator('#product-form button[type=submit]').click();assert.equal((await singleSave).status(),200);await p.locator('#product-form').waitFor({state:'hidden'});await p.locator('[data-product-edit="1"]').click();assert.equal(await field(0,'label').inputValue(),'Màu gốc QA');await p.locator('[data-sku-add]').click();await field(1,'sku').fill('QA-LEGACY-YELLOW');await field(1,'label').fill('Vàng');await field(1,'stock').fill('4');await field(1,'image').fill('/logo.png');
 const conversion=p.waitForResponse(r=>r.url().endsWith('/api/admin/products/1')&&r.request().method()==='PATCH');await p.locator('#product-form button[type=submit]').click();assert.equal((await conversion).status(),200);await p.locator('#product-form').waitFor({state:'hidden'});assert.equal(db.prepare('SELECT stock FROM product_variants WHERE product_id=1 ORDER BY id LIMIT 1').get().stock,old.stock);
 const buyer=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});buyer.on('pageerror',error=>errors.push(error.message));const publicProduct=await (await fetch(base+'/api/products/'+product.id)).json();await buyer.goto(base+publicProduct.url);
 const vs=variants();await buyer.locator('[data-variant-choice="'+vs[2].id+'"]').click();assert.equal(await buyer.locator('#detail-add').isDisabled(),true);assert.equal(await buyer.locator('#gallery-main-image').getAttribute('src'),vs[2].image);
 await buyer.locator('[data-variant-choice="'+vs[1].id+'"]').click();assert.equal(await buyer.locator('#gallery-main-image').getAttribute('src'),vs[1].image);assert.match(await buyer.locator('#selected-sku').innerText(),/QA-CUP-RED/);assert.match(await buyer.locator('.detail-price').innerText(),/110[.,]000/);assert.equal(await buyer.locator('#detail-add').isDisabled(),false);assert.equal(await buyer.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.SKU_SCREENSHOT)await buyer.screenshot({path:process.env.SKU_SCREENSHOT,fullPage:true});await buyer.locator('#detail-add').click();await buyer.locator('.cart-link').click();await buyer.locator('#checkout').waitFor();assert.equal(await buyer.locator('.cart-item>img').getAttribute('src'),vs[1].image);assert.match(await buyer.locator('.cart-item').innerText(),/Đỏ san hô/);
 const form=buyer.locator('#checkout');await form.locator('[name=recipient]').fill('Color Buyer');await form.locator('[name=email]').fill('color@example.test');await form.locator('[name=phone]').fill('0901234567');await form.locator('[name=address]').fill('123 Nguyen Trai');await form.locator('[name=province_code]').selectOption('01');await form.locator('[name=ward_code] option[value="00004"]').waitFor({state:'attached'});await form.locator('[name=ward_code]').selectOption('00004');await form.locator('button.primary').click();await buyer.locator('[data-cancel-order]').waitFor();
 const placed=db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get(),line=JSON.parse(placed.items)[0];assert.equal(line.sku,'QA-CUP-RED');assert.equal(line.image,vs[1].image);assert.equal(line.variant,'Đỏ san hô');assert.deepEqual(variants().map(v=>v.stock),[9,2,0]);assert.match(await buyer.locator('.order').innerText(),/QA-CUP-RED/);
 assert.deepEqual(errors,[]);console.log('PASS default one SKU, adding/removing unsaved colors, three photo uploads, atomic save, concurrent sales, legacy conversion, color photo/price/SKU selection, out-of-stock blocking, cart image and checkout snapshot.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
