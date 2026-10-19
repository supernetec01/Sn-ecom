// Isolated browser checks. A deterministic provider stub never calls Google or incurs fees.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { once } = require('node:events');

(async()=>{
  const {openStore}=await import('../store.js');
  const {createApp}=await import('../server.js');
  const dir=mkdtempSync(join(tmpdir(),'sn-language-browser-')),db=openStore(dir);
  db.prepare('UPDATE products SET name=?,description=? WHERE id=1').run('Bình thử ngôn ngữ','Nội dung thử Super Net 500 ml');
  const before=db.prepare('SELECT * FROM products WHERE id=1').get();
  const calls=[];
  const fetchImpl=async(_url,input)=>{
    const b=JSON.parse(input.body);calls.push(b);
    return {ok:true,json:async()=>({data:{translations:b.q.map(q=>({translatedText:q==='Bình thử ngôn ngữ'?(b.target==='en'?'Test bottle':'測試水瓶'):q.startsWith('Nội dung thử')?'<img src=x onerror="globalThis.injected=1"> '+q:b.target+': '+q}))}})};
  };
  const server=createApp(db,{translation:{apiKey:()=> 'test-placeholder',fetchImpl,dailyLimit:()=>1000000}}).listen(0,'127.0.0.1');
  await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  const offlineDb=openStore(join(dir,'offline'));
  const offline=createApp(offlineDb,{translation:{apiKey:()=>''}}).listen(0,'127.0.0.1');await once(offline,'listening');
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.hero').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'vi');
    assert.equal(await page.locator('[data-language-select] option').count(),3);
    await page.evaluate(()=>location.hash='products');await page.locator('.catalog-page').waitFor();
    await page.selectOption('[data-language-select]','en');
    await page.waitForFunction(()=>document.documentElement.lang==='en' && document.querySelector('.cart-link').innerText.includes('Cart'));
    await page.locator('.product h3').filter({hasText:'Test bottle'}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('lang'),'en');
    console.log('PASS three language choices, English interface and backend product translation');

    await page.locator('[data-add="1"]').click();await page.evaluate(()=>location.hash='cart');await page.locator('#checkout').waitFor();
    const form=page.locator('#checkout');
    await form.locator('[name=recipient]').fill('Người nhận giữ nguyên');await form.locator('[name=email]').fill('keep@example.test');
    await form.locator('[name=phone]').fill('0901234567');await form.locator('[name=address]').fill('123 Nguyễn Du');
    await form.locator('[name=province_code]').selectOption('01');await form.locator('[name=ward_code] option[value="00004"]').waitFor({state:'attached'});await form.locator('[name=ward_code]').selectOption('00004');
    await page.waitForFunction(()=>!document.querySelector('#checkout button.primary').disabled);
    const cart=await page.evaluate(()=>localStorage.getItem('sn-cart'));
    await page.selectOption('[data-language-select]','zh-TW');
    await page.waitForFunction(()=>document.querySelector('#checkout button.primary').textContent==='確認下單');
    assert.equal(await form.locator('[name=recipient]').inputValue(),'Người nhận giữ nguyên');
    assert.equal(await form.locator('[name=email]').inputValue(),'keep@example.test');
    assert.equal(await form.locator('[name=address]').inputValue(),'123 Nguyễn Du');
    assert.equal(await form.locator('[name=province_code]').inputValue(),'01');assert.equal(await form.locator('[name=ward_code]').inputValue(),'00004');
    assert.equal(await page.evaluate(()=>localStorage.getItem('sn-cart')),cart);
    assert.ok(page.url().endsWith('#cart'));
    console.log('PASS Traditional Chinese selection preserves cart, route, checkout input and canonical address codes');

    await page.reload();await page.locator('#checkout').waitFor();
    assert.equal(await page.locator('[data-language-select]').inputValue(),'zh-TW');assert.equal(await page.locator('html').getAttribute('lang'),'zh-TW');
    await page.goto(base+'/san-pham/1-test?lang=en');await page.locator('.detail-copy').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('lang'),'en');
    await page.selectOption('[data-language-select]','en');
    await page.locator('.detail-copy h1').filter({hasText:'Test bottle'}).waitFor();
    await page.waitForFunction(()=>document.querySelector('.product-information').textContent.includes('<img src=x'));
    assert.equal(await page.locator('.product-information img').count(),0);assert.equal(await page.evaluate(()=>globalThis.injected),undefined);
    assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=1').get(),before);
    await page.locator('[data-policy]').first().click();await page.locator('#modal[open]').waitFor();
    const policy=JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value).policies[0];
    assert.equal(await page.locator('#modal .policy').innerText(),policy.body);
    assert.equal(await page.locator('#modal [data-original-content]').getAttribute('lang'),'vi');
    await page.locator('#modal .modal-close').click();
    console.log('PASS saved language, original product data and safe text rendering of provider output');

    await page.route('**/api/i18n/translate-page',async route=>{
      const b=route.request().postDataJSON();
      if(b.target_language==='en') await new Promise(resolve=>setTimeout(resolve,250));
      try { await route.continue(); } catch { /* A superseded request can be aborted. */ }
    });
    await page.evaluate(()=>{localStorage.setItem('sn-language','vi');history.replaceState(null,'',location.pathname);});
    await page.reload();await page.locator('.detail-copy').waitFor();
    const pendingEnglish=page.waitForRequest(request=>request.url().endsWith('/api/i18n/translate-page') && request.postDataJSON().target_language==='en');
    await page.selectOption('[data-language-select]','en');await pendingEnglish;await page.selectOption('[data-language-select]','zh-TW');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('html').getAttribute('lang'),'zh-TW');assert.equal(await page.locator('[data-language-select]').inputValue(),'zh-TW');
    for (const width of [375,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('[data-language-select]').isVisible(),true);
    }
    if(process.env.LANGUAGE_SCREENSHOT)await page.screenshot({path:process.env.LANGUAGE_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS rapid language changes and responsive selector at 375, 768 and 1440px');

    const fallback=await browser.newPage();
    await fallback.goto('http://127.0.0.1:'+offline.address().port+'/?lang=en');await fallback.locator('.hero').waitFor();
    await fallback.waitForFunction(()=>document.querySelector('[data-translation-status]').textContent.includes('Some content'));
    assert.equal(await fallback.locator('.cart-link span').innerText(),'Cart');
    await fallback.selectOption('[data-language-select]','vi');
    assert.equal(await fallback.locator('.cart-link span').innerText(),'Giỏ hàng');
    assert.equal(await fallback.locator('[data-translation-status]').isHidden(),true);
    console.log('PASS no-key Vietnamese fallback and restoring the original language');
    assert.ok(calls.length>0);
    assert.ok(!JSON.stringify(calls).includes('keep@example.test'));
    assert.ok(!JSON.stringify(calls).includes('123 Nguyễn Du'));
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>offline.close(resolve));
    db.close();offlineDb.close();rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
