// Exercise real links from canonical product URLs, using an isolated HTTP/SQLite shop.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createApp } from '../server.js';
import { openStore, hashPassword } from '../store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

const dir=mkdtempSync(join(tmpdir(),'sn-navigation-browser-')),db=openStore(dir),password=randomBytes(20).toString('hex');
db.prepare("INSERT INTO users(email,name,password,role) VALUES('navigation-customer@example.test','Navigation customer',?,'customer')").run(hashPassword(password));
const settings=JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
const tables=['products','product_variants','orders','payment_intents','payment_transactions','inventory_movements','audit_log'];
const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
const server=createApp(db,{translation:{apiKey:()=>''}}).listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],serverErrors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()===429||response.status()>=500)serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);});
  await page.goto(base+'/#account');await page.locator('#auth').waitFor();
  await page.locator('#auth [name=email]').fill('navigation-customer@example.test');await page.locator('#auth [name=password]').fill(password);await page.locator('#auth button.primary').click();await page.locator('#logout').waitFor();
  await page.locator('.footer-explore').click();await page.locator('.catalog-page').waitFor();
  const productPath=await page.locator('.product-image').first().getAttribute('href');
  assert.ok(productPath.startsWith('/san-pham/'));
  await page.evaluate(()=>window.navigationMarker='same-document');
  await page.locator('.product-image').first().click();await page.locator('.detail-copy').waitFor();
  const productURL=page.url(),productName=await page.locator('.detail-copy h1').innerText();
  assert.equal(new URL(productURL).hash,'');
  await page.locator('#detail-add').click();
  assert.equal(await page.locator('.cart-count').innerText(),'1');
  const savedCart=await page.evaluate(()=>localStorage.getItem('sn-cart'));
  // A click on the icon must work too; changing location.hash in a test hides this regression.
  await page.locator('.cart-link svg').click();await page.locator('#checkout').waitFor();
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#cart');
  assert.equal(await page.locator('.cart-item strong').innerText(),productName);
  assert.equal(await page.locator('[data-cart-quantity]').inputValue(),'1');
  assert.equal(await page.evaluate(()=>window.navigationMarker),'same-document');
  console.log('PASS canonical product -> add to cart -> real header cart click, with cart and document preserved');

  await page.goBack();await page.locator('.detail-copy').waitFor();assert.equal(page.url(),productURL);
  await page.goForward();await page.locator('#checkout').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sn-cart')),savedCart);
  await page.reload();await page.locator('#checkout').waitFor();
  assert.equal(await page.locator('#checkout [name=recipient]').inputValue(),'Navigation customer');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sn-cart')),savedCart);
  await page.evaluate(()=>window.navigationMarker='same-document');
  console.log('PASS browser Back, Forward and reload preserve the destination, login and cart');

  async function openProduct() {
    await page.locator('.footer-explore').click();await page.locator('.catalog-page').waitFor();
    await page.locator('.product-image').first().click();await page.locator('.detail-copy').waitFor();
  }
  for(const [hash,heading,ready] of [
    ['wishlist','Sản phẩm yêu thích','main h1'],
    ['support','Hỗ trợ mua hàng','#chat-form'],
    ['account','Navigation customer','#logout'],
    ['order/0','Tra cứu đơn','#order-lookup'],
    ...settings.navigation.items.filter(item=>item.enabled).map(item=>[
      (['bestsellers','new','promotions'].includes(item.id)?'collection/':'page/')+item.id,item.title,'.navigation-page',
    ]),
  ]) {
    await openProduct();
    const link=page.locator(`.storefront-header a[href="#${hash}"]`);
    // Enter uses the same browser activation path as a mouse click.
    if(hash==='support'){await link.focus();await link.press('Enter');}else await link.click();
    await page.locator(ready).waitFor();await page.getByRole('heading',{name:heading,exact:true,level:1}).waitFor();
    assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#'+hash);
    assert.equal(await page.locator('main h1').innerText(),heading);
    assert.equal(await page.evaluate(()=>window.navigationMarker),'same-document');
  }
  console.log('PASS all header destinations and seven navigation tabs from canonical product pages, including keyboard activation');

  await openProduct();const productCategory=await page.locator('.detail-copy > .eyebrow').innerText();
  await page.locator('.product-page .breadcrumb a[href="#products"]').click();await page.locator('.catalog-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#products');
  assert.equal((await page.locator('.catalog-intro h1').innerText()).toLocaleUpperCase('vi'),productCategory.toLocaleUpperCase('vi'));
  assert.ok(await page.locator('.product').count());
  await page.goBack();await page.locator('.detail-copy').waitFor();
  await openProduct();await page.locator('#category-toggle').click();await page.locator('#category-panel [data-category=""]').click();await page.locator('.catalog-page').waitFor();
  assert.equal(await page.locator('[data-filter=""].active').count(),1);
  await page.goBack();await page.locator('.detail-copy').waitFor();
  await openProduct();await page.locator('.product-page .breadcrumb a[href="#"]').click();await page.locator('.hero').waitFor();
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'');
  await openProduct();await page.locator('.footer-brand a').click();await page.locator('.hero').waitFor();
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'');
  console.log('PASS product category breadcrumb, category dropdown and both empty-fragment home links');

  for(const language of ['en','zh-TW']) {
    await openProduct();await page.selectOption('[data-language-select]',language);
    assert.equal(new URL(page.url()).searchParams.get('lang'),language);
    const localizedProductURL=page.url();
    await page.locator('.cart-link').click();await page.locator('#checkout').waitFor();
    assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#cart');
    assert.equal(new URL(page.url()).searchParams.get('lang'),language);
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.evaluate(()=>localStorage.getItem('sn-cart')),savedCart);
    await page.goBack();await page.locator('.detail-copy').waitFor();assert.equal(page.url(),localizedProductURL);
  }
  console.log('PASS English and Traditional Chinese keep the URL language, cart and product history');

  // Direct links and reloads use the server-rendered canonical product entry point.
  await page.reload();await page.locator('.detail-copy').waitFor();
  assert.equal(await page.locator('.cart-count').innerText(),'1');
  await page.evaluate(()=>window.navigationMarker='same-document');
  await page.setViewportSize({width:375,height:900});
  await page.locator('.cart-link').click();await page.locator('#checkout').waitFor();
  assert.equal(new URL(page.url()).hash,'#cart');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>window.navigationMarker),'same-document');
  if(process.env.NAVIGATION_SCREENSHOT)await page.screenshot({path:process.env.NAVIGATION_SCREENSHOT,fullPage:true});
  console.log('PASS mobile product -> cart navigation without horizontal overflow');

  for(const table of tables)assert.deepEqual(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),before[table],`${table} must not change while browsing`);
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.deepEqual(errors,[]);assert.deepEqual(serverErrors,[]);
  console.log('PASS navigation leaves prices, stock, orders, payments and audit records unchanged; no JavaScript/server errors');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
