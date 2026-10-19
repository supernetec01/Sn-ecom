// Real HTTP/SQLite + Chromium, isolated from shop data and provider services.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createApp } from '../server.js';
import { openStore, hashPassword } from '../store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

const dir=mkdtempSync(join(tmpdir(),'sn-storefront-browser-')),db=openStore(dir),password=randomBytes(20).toString('hex');
db.prepare("INSERT INTO users(email,name,password,role) VALUES('storefront-admin@example.test','Admin',?,'admin')").run(hashPassword(password));
const server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
  const adminContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const shopContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const admin=await adminContext.newPage(),shop=await shopContext.newPage(),errors=[];
  for(const page of [admin,shop])page.on('pageerror',error=>errors.push(error.message));
  await admin.goto(base+'/#account');await admin.locator('#auth').waitFor();
  await admin.locator('#auth [name=email]').fill('storefront-admin@example.test');await admin.locator('#auth [name=password]').fill(password);await admin.locator('#auth button.primary').click();await admin.locator('#logout').waitFor();
  await admin.goto(base+'/#admin/categories');await admin.locator('#category-create').waitFor();
  const oldCategory=db.prepare('SELECT category FROM products LIMIT 1').get().category,newCategory='Danh mục đã đồng bộ';
  await shop.goto(base+'/#products');await shop.getByRole('button',{name:oldCategory,exact:true}).click();
  await shop.locator('.catalog-intro h1').filter({hasText:oldCategory}).waitFor();
  await shop.evaluate(()=>window.storefrontMarker='same-document');
  await admin.bringToFront();
  let row=admin.locator('tr').filter({has:admin.getByText(oldCategory,{exact:true})});
  await row.getByRole('button',{name:'Đổi tên'}).click();await admin.locator('#category-rename input').fill(newCategory);await admin.locator('#category-rename button.primary').click();await admin.getByText(newCategory,{exact:true}).waitFor();
  await shop.bringToFront();await shop.getByRole('button',{name:newCategory,exact:true}).waitFor({timeout:20000});
  assert.equal(await shop.evaluate(()=>window.storefrontMarker),'same-document');
  assert.equal(await shop.getByRole('button',{name:oldCategory,exact:true}).count(),0);
  assert.equal(await shop.locator('[data-filter=""].active').count(),1);
  assert.ok(await shop.locator('.products .product').count());
  assert.equal(db.prepare('SELECT COUNT(*) n FROM products WHERE category=?').get(oldCategory).n,0);
  await shop.locator('#category-toggle').click();
  assert.equal(await shop.locator('#category-panel').getByRole('link',{name:newCategory,exact:true}).count(),1);
  assert.equal(await shop.locator('#category-panel').getByRole('link',{name:oldCategory,exact:true}).count(),0);
  await shop.keyboard.press('Escape');await shop.getByRole('button',{name:newCategory,exact:true}).click();
  assert.ok(await shop.locator('.products .product').count());
  console.log('PASS category rename synchronizes another browser, dropdown and selected filter without reloading');

  // Keep this storefront visible while the other tab submits its category form.
  const sharedShop=await adminContext.newPage();sharedShop.on('pageerror',error=>errors.push(error.message));
  await sharedShop.goto(base+'/#products');await sharedShop.locator('.catalog-page').waitFor();
  await sharedShop.bringToFront();
  await admin.locator('#category-create').evaluate(form=>{form.elements.name.value='Danh mục thêm sau';form.requestSubmit();});
  await sharedShop.getByRole('button',{name:'Danh mục thêm sau',exact:true}).waitFor({timeout:4000});
  await admin.getByText('Danh mục thêm sau',{exact:true}).waitFor();
  console.log('PASS category addition updates an already open tab through the store change notification');

  await shop.bringToFront();await shop.locator('[data-add]').first().click();await shop.goto(base+'/#cart');await shop.locator('#checkout').waitFor();
  await shop.locator('#checkout [name=recipient]').fill('Thông tin chưa gửi');
  await admin.locator('#category-create').evaluate(form=>{form.elements.name.value='Danh mục thay đổi khi thanh toán';form.requestSubmit();});
  await admin.getByText('Danh mục thay đổi khi thanh toán',{exact:true}).waitFor();
  await shop.evaluate(()=>window.dispatchEvent(new Event('focus')));await shop.waitForTimeout(200);
  assert.equal(await shop.locator('#checkout [name=recipient]').inputValue(),'Thông tin chưa gửi');
  await shop.goto(base+'/#products');await shop.getByRole('button',{name:'Danh mục thay đổi khi thanh toán',exact:true}).waitFor();
  console.log('PASS background settings changes preserve checkout drafts and navigation reads current categories');

  await sharedShop.bringToFront();await sharedShop.getByRole('button',{name:'Danh mục thêm sau',exact:true}).click();
  row=admin.locator('tr').filter({has:admin.getByText('Danh mục thêm sau',{exact:true})});
  await row.getByRole('button',{name:'Xóa',exact:true}).click();await admin.locator('#admin-confirm button').click();
  await admin.locator('tr').filter({has:admin.getByText('Danh mục thêm sau',{exact:true})}).waitFor({state:'detached'});
  await sharedShop.bringToFront();await sharedShop.getByRole('button',{name:'Danh mục thêm sau',exact:true}).waitFor({state:'detached'});
  assert.equal(await sharedShop.locator('[data-filter=""].active').count(),1);assert.ok(await sharedShop.locator('.products .product').count());
  console.log('PASS deleted category is removed from filters and cannot leave a stale empty selection');
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.deepEqual(errors,[]);
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
