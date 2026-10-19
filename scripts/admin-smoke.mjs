import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createApp } from '../server.js';
import { openStore, hashPassword } from '../store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'sn-admin-browser-')); process.env.DATA_DIR = dir;
const db = openStore(dir), password = randomBytes(20).toString('hex');
for (const role of ['admin', 'manager', 'editor', 'customer']) db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(role, role + '@example.test', hashPassword(password), role);
const buyer = db.prepare("SELECT id FROM users WHERE role='customer'").get();
const product = db.prepare('SELECT * FROM products LIMIT 1').get();
db.prepare("INSERT INTO orders(user_id,created,status,total,shipping,payment,recipient,phone,address,items,bank) VALUES(?,?,'pending',?,30000,'cod',?,?,?,?,?)").run(buyer.id,new Date().toISOString(),product.price+30000,'Browser Buyer','0901234567','123 Nguyen Trai, Ha Noi',JSON.stringify([{id:product.id,name:product.name,price:product.price,quantity:1}]),'{}');
const server = createApp(db).listen(0,'127.0.0.1'); await once(server,'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({...(process.env.BROWSER_EXECUTABLE ? { executablePath:process.env.BROWSER_EXECUTABLE } : {}),headless:true,args:['--no-sandbox']});
const errors=[];
async function login(role) {
  const context = await browser.newContext({ viewport:{width:1440,height:1000},reducedMotion:'reduce' });
  const p = await context.newPage(); p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/#account'); await p.locator('#auth').waitFor();
  await p.locator('#auth [name=email]').fill(role+'@example.test'); await p.locator('#auth [name=password]').fill(password); await p.locator('#auth button.primary').click();
  await p.locator('#logout').waitFor(); return p;
}
async function tab(p,name) { await p.locator('.admin-sidebar [data-admin-nav="'+name+'"]').click(); await p.waitForURL('**/#admin/'+name); await p.locator('.admin-topbar h1').waitFor(); await p.waitForFunction(t=>document.querySelector('.admin-sidebar a[aria-current=page]')?.dataset.adminNav===t,name); }

async function request(p,path,method='GET',body) {
  return p.evaluate(async ({path,method,body}) => {
    const me = await (await fetch('/api/me')).json();
    const response = await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf,'Idempotency-Key':crypto.randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  },{path,method,body});
}
async function content(p,key){ await p.locator('[data-content-section='+key+']').click(); await p.locator('#admin-config[data-section='+key+']').waitFor(); }
async function field(p,keys) { return p.locator('[data-config]').all().then(async inputs=>{for(const input of inputs)if(JSON.stringify(keys)===await input.getAttribute('data-config'))return input;throw Error('Missing field '+keys);}); }
async function saved(p,click) { const response = p.waitForResponse(r=>r.url().endsWith('/api/admin/settings')&&r.request().method()==='PATCH'); await click(); assert.equal((await response).status(),200); await p.waitForFunction(()=>document.querySelector('[data-save-state]')?.textContent==='Chưa có thay đổi'); }
try {
  const p = await login('admin'); await p.goto(base+'/#admin'); await p.locator('.admin-stats').first().waitFor();
  assert.equal(await p.locator('.admin-sidebar nav a').count(),14);
  await p.screenshot({path:join(dir,'admin-overview.png'),fullPage:true});
  await tab(p,'products'); await p.locator('[data-product-new]').click();
  await p.locator('#product-form [name=name]').fill('Sản phẩm quản trị'); await p.locator('#product-form [name=price]').fill('135000'); await p.locator('#product-form [name=stock]').fill('32'); await p.locator('#product-form [name=active]').selectOption('1');
  await p.locator('#product-form [data-upload]').setInputFiles(fileURLToPath(new URL('../public/logo.png', import.meta.url))); await p.waitForFunction(()=>document.querySelector('#product-form [name=image]').value.startsWith('/uploads/'));
  await p.locator('#product-form button.primary').click(); await p.getByText('Sản phẩm quản trị',{exact:true}).waitFor();
  await p.locator('#admin-query').fill('Sản phẩm quản trị'); await p.locator('#admin-search button[type=submit]').click(); await p.waitForFunction(()=>document.querySelectorAll('.admin-table tbody tr').length===1);
  const itemId=db.prepare('SELECT id FROM products WHERE name=?').get('Sản phẩm quản trị').id;
  await p.locator('[data-product-edit="'+itemId+'"]').click();
  assert.equal(await p.locator('#product-form [name=stock]').count(),0);
  assert.equal(await p.locator('#product-form [name=name]').evaluate(input=>input===document.activeElement),true,'editor should focus its name field rather than the close button');
  const productBeforeEnter=db.prepare('SELECT * FROM products WHERE id=?').get(itemId);
  const auditBeforeEnter=db.prepare('SELECT COUNT(*) n FROM audit_log').get().n;
  await p.locator('#product-form [name=name]').fill('Chưa lưu bằng Enter');
  await p.locator('#product-form [name=name]').press('Enter');await p.waitForTimeout(150);
  assert.equal(await p.locator('#modal').evaluate(dialog=>dialog.open),true);
  assert.deepEqual(db.prepare('SELECT * FROM products WHERE id=?').get(itemId),productBeforeEnter);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_log').get().n,auditBeforeEnter);
  await p.locator('#product-form [name=name]').fill(productBeforeEnter.name);
  await p.locator('#product-form [name=description]').fill('Dòng đầu');
  await p.locator('#product-form [name=description]').press('End');await p.locator('#product-form [name=description]').press('Enter');
  await p.locator('#product-form [name=description]').pressSequentially('Dòng tiếp theo');
  assert.equal(await p.locator('#product-form [name=description]').inputValue(),'Dòng đầu\nDòng tiếp theo');
  assert.equal(await p.locator('#modal').evaluate(dialog=>dialog.open),true);

  const order = await request(p,'/orders','POST',{country:'VN',province_code:'01',ward_code:'00004',recipient:'Concurrent buyer',phone:'0901234567',address:'123 QA street',payment:'cod',items:[{id:itemId,quantity:1}]});
  assert.equal(order.status,201);
  await p.locator('#product-form [name=description]').fill('Description saved after stock changed');
  await p.locator('#product-form [name=price]').fill('136000');
  const productSave=p.waitForResponse(r=>r.url().endsWith('/api/admin/products/'+itemId)&&r.request().method()==='PATCH');
  await p.locator('#product-form button.primary').focus(); await p.locator('#product-form button.primary').press('Enter'); assert.equal((await productSave).status(),200);
  await p.locator('#product-form').waitFor({state:'hidden'});
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(itemId).stock,31);
  assert.equal(db.prepare('SELECT SUM(delta) delta FROM inventory_movements WHERE product_id=? AND order_id IS NOT NULL').get(itemId).delta,-1);
  await tab(p,'audit');
  await p.locator('[data-audit-change=price]').first().waitFor();
  assert.match(await p.locator('[data-audit-change=price]').first().innerText(),/135[.,]000.*136[.,]000/);
  await tab(p,'products'); await p.locator('#admin-query').fill('Sản phẩm quản trị'); await p.locator('#admin-search button[type=submit]').click();
  await p.waitForFunction(()=>document.querySelectorAll('.admin-table tbody tr').length===1);
  // Simulate an order changing stock after table load: the visibility toggle must preserve it.
  db.prepare('UPDATE products SET stock=30 WHERE id=?').run(itemId);
  await p.locator('[data-product-toggle]').click(); await p.locator('.admin-table .admin-badge').filter({hasText:'Đang ẩn'}).first().waitFor();
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(itemId).stock,30);
  await p.locator('[data-clear-filters]').click(); await p.waitForFunction(()=>document.querySelectorAll('.admin-table tbody tr').length===17);
  await p.screenshot({path:join(dir,'admin-products.png'),fullPage:true});
  await tab(p,'categories'); await p.locator('#category-create input').fill('Danh mục test'); await p.locator('#category-create button').click(); await p.getByText('Danh mục test',{exact:true}).waitFor();
  let row=p.locator('tr').filter({hasText:'Danh mục test'}); await row.getByRole('button',{name:'Đổi tên'}).click(); await p.locator('#category-rename input').fill('Danh mục đã đổi'); await p.locator('#category-rename button.primary').click(); await p.getByText('Danh mục đã đổi',{exact:true}).waitFor();
  row=p.locator('tr').filter({hasText:'Danh mục đã đổi'}); await row.getByRole('button',{name:'Xóa',exact:true}).click(); await p.locator('#admin-confirm button').click(); await p.locator('tr').filter({hasText:'Danh mục đã đổi'}).waitFor({state:'detached'});
  await tab(p,'orders'); await p.locator('[data-order-detail]').first().click(); await p.getByRole('heading',{name:/Chi tiết đơn/}).waitFor(); await p.locator('.modal-close').click();
  await p.locator('.admin-order-update select').first().selectOption('confirmed'); await p.locator('.admin-order-update button').first().click(); await p.waitForFunction(()=>document.querySelector('.admin-order-update select')?.value==='confirmed');
  const reviewId=Number(db.prepare("INSERT INTO reviews(user_id,product_id,rating,body,created) VALUES(?,?,5,'Browser review audit failure',?)").run(buyer.id,product.id,new Date().toISOString()).lastInsertRowid);
  await tab(p,'reviews');
  const reviewForm=p.locator('form[data-action="/admin/reviews/'+reviewId+'"]');
  db.exec("CREATE TEMP TRIGGER browser_review_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'browser injected audit failure'); END");
  let reviewResponse=p.waitForResponse(r=>r.url().endsWith('/api/admin/reviews/'+reviewId)&&r.request().method()==='PATCH');
  await reviewForm.locator('button.primary').click(); assert.equal((await reviewResponse).status(),500);
  await reviewForm.locator('.error').filter({hasText:'Lỗi xử lý yêu cầu.'}).waitFor();
  assert.equal(db.prepare('SELECT status FROM reviews WHERE id=?').get(reviewId).status,'pending');
  db.exec('DROP TRIGGER browser_review_audit_failure');
  reviewResponse=p.waitForResponse(r=>r.url().endsWith('/api/admin/reviews/'+reviewId)&&r.request().method()==='PATCH');
  await reviewForm.locator('button.primary').click(); assert.equal((await reviewResponse).status(),200);
  await p.waitForFunction(()=>document.querySelector('form[data-action^="/admin/reviews/"]')?.closest('article')?.textContent.includes('approved'));
  await tab(p,'sales'); await (await field(p,['bankName'])).fill('Ngân hàng mẫu'); await (await field(p,['bankAccount'])).fill('12345678'); await (await field(p,['bankHolder'])).fill('SUPER NET'); await saved(p,()=>p.locator('#admin-config button.primary').click());
  await tab(p,'content'); await content(p,'home'); await (await field(p,['heroTitle'])).fill('Tiêu đề mới từ admin'); await saved(p,()=>p.locator('#admin-config button.primary').click());
  const opened=(await request(p,'/admin/config')).data;
  await (await field(p,['heroTitle'])).fill('Unsaved content must survive conflict');
  assert.equal((await request(p,'/admin/settings','PUT',{...opened.settings,heroTitle:'Concurrent admin title',revision:opened.revision})).status,200);
  const staleSave=p.waitForResponse(r=>r.url().endsWith('/api/admin/settings')&&r.request().method()==='PATCH');
  await p.locator('#admin-config button.primary').click(); assert.equal((await staleSave).status(),409);
  await p.locator('#admin-config .error').filter({hasText:'Dữ liệu đã được thay đổi'}).waitFor();
  assert.equal(await (await field(p,['heroTitle'])).inputValue(),'Unsaved content must survive conflict');
  assert.equal(JSON.parse(db.prepare('SELECT value FROM settings').get().value).heroTitle,'Concurrent admin title');
  p.once('dialog',d=>d.accept()); await p.locator('[data-config-reload]').click();
  await p.waitForFunction(()=>document.querySelector('[data-save-state]')?.textContent==='Chưa có thay đổi');
  await content(p,'policies'); await p.locator('[data-list-add]').click(); await p.locator('[data-list-item]').last().locator('input').fill('Chính sách mẫu'); await p.locator('[data-list-item]').last().locator('textarea').fill('Nội dung mới dễ chỉnh sửa'); await saved(p,()=>p.locator('#admin-config button.primary').click());
  assert.equal(JSON.parse(db.prepare('SELECT value FROM settings').get().value).bankAccount,'12345678');
  await content(p,'navigation'); await p.locator('details').first().locator('summary').click(); await (await field(p,['navigation','items',0,'label'])).fill('Lựa chọn nổi bật'); await p.locator('[data-product-list]').first().locator('input').first().check(); await saved(p,()=>p.locator('#admin-config button.primary').click());
  await content(p,'wording'); await p.locator('#wording-search').fill('Thêm vào giỏ'); await p.locator('[data-wording-row]:visible').first().locator('input').fill('Thêm vào giỏ ngay'); await saved(p,()=>p.locator('#admin-config button.primary').click());
  // Cancellation of unsaved navigation keeps edits.
  await content(p,'brand'); await (await field(p,['brand'])).fill('Chưa lưu'); p.once('dialog',d=>d.dismiss()); await p.locator('[data-admin-nav=users]').click(); assert.equal(await (await field(p,['brand'])).inputValue(),'Chưa lưu');
  p.once('dialog',d=>d.accept()); await tab(p,'users'); await p.locator('[data-user-new]').click(); await p.locator('#user-form [name=name]').fill('Nhân viên kiểm tra'); await p.locator('#user-form [name=email]').fill('new-staff@example.test'); await p.locator('#user-form [name=password]').fill(password); await p.locator('#user-form [name=role]').selectOption('manager'); await p.locator('#user-form button.primary').click(); await p.getByText('new-staff@example.test',{exact:true}).waitFor();
  const staffId=db.prepare('SELECT id FROM users WHERE email=?').get('new-staff@example.test').id;
  await p.locator('[data-user-edit="'+staffId+'"]').click(); await p.locator('#user-form [name=role]').selectOption('editor'); await p.locator('#user-form [name=disabled]').selectOption('true'); await p.locator('#user-form button.primary').click(); await p.getByText('new-staff@example.test',{exact:true}).waitFor();
  await p.locator('[data-user-password="'+staffId+'"]').click(); await p.locator('#reset-password input').fill(randomBytes(20).toString('hex')); await p.locator('#reset-password button').click(); await p.locator('#reset-password').waitFor({state:'hidden'});
  await p.locator('[data-user-edit="'+db.prepare("SELECT id FROM users WHERE role='admin'").get().id+'"]').click(); assert.equal(await p.locator('#user-form [name=role]').isDisabled(),true); assert.equal(await p.locator('#user-form [name=disabled]').isDisabled(),true); await p.locator('.modal-close').click();
  await p.screenshot({path:process.env.ADMIN_SCREENSHOT || join(dir,'admin-users.png'),fullPage:true});
  for (const width of [375,768]) { await p.setViewportSize({width,height:900}); for(const t of ['overview','products','categories','orders','content','sales','users','audit','inventory','coupons','reviews','returns','commerce','outbox']) { await tab(p,t); assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} overflow ${t}`); } }
  await p.screenshot({path:join(dir,'admin-mobile.png'),fullPage:true});
  const manager=await login('manager'); await manager.goto(base+'/#admin'); await manager.locator('.admin-sidebar').waitFor(); assert.equal(await manager.locator('.admin-sidebar nav a').count(),8); await manager.goto(base+'/#admin/users'); await manager.getByRole('heading',{name:'Không có quyền truy cập'}).waitFor();
  const editor=await login('editor'); await editor.goto(base+'/#admin'); await editor.locator('#admin-config').waitFor(); assert.equal(await editor.locator('.admin-sidebar nav a').count(),3); assert.equal(await editor.locator('[data-admin-nav=sales]').count(),0);
  const customer=await login('customer'); await customer.goto(base+'/#admin'); await customer.getByText('Tài khoản này không có quyền quản trị.').waitFor();
  // Account password UI and logout of current session.
  await editor.locator('[data-own-password]').click(); await editor.locator('#change-password [name=currentPassword]').fill(password); const changed=randomBytes(20).toString('hex'); await editor.locator('#change-password [name=newPassword]').fill(changed); await editor.locator('#change-password [name=confirmPassword]').fill(changed); await editor.locator('#change-password button.primary').click(); await editor.locator('#auth').waitFor();
  assert.deepEqual(errors,[]); console.log('Browser passed: admin CRUD, upload, Enter-safe editor, stock-safe content edits and visibility, visible price audit changes, review audit rollback, stale configuration conflict, categories, order transitions, section content saves, user roles/status/reset, self safeguards, unsaved prompt, role menus, password change and responsive widths 375/768/1440.');
} finally { await browser.close(); await new Promise(r=>server.close(r)); db.close(); rmSync(dir,{recursive:true,force:true}); }
