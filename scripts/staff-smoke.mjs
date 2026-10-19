import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createApp } from '../server.js';
import { openStore, hashPassword } from '../store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

const dir=mkdtempSync(join(tmpdir(),'sn-staff-browser-')),db=openStore(dir),initial=randomBytes(20).toString('hex');
db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('Owner','owner@example.test',hashPassword(initial));
const server=createApp(db).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
  const errors=[];
  async function page(width=1440){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
  async function signIn(p,email,password){await p.goto(base+'/#account');await p.locator('#auth [name=email]').fill(email);await p.locator('#auth [name=password]').fill(password);await p.locator('#auth button.primary').click();}
  async function change(p,current,next){const form=p.locator('#required-password');await form.locator('[name=currentPassword]').fill(current);await form.locator('[name=newPassword]').fill(next);await form.locator('[name=confirmPassword]').fill(next);await form.locator('button.primary').click();await p.locator('#auth').waitFor();}
  const owner=await page();await signIn(owner,'owner@example.test',initial);await owner.locator('#logout').waitFor();await owner.goto(base+'/#admin/users');await owner.locator('[data-user-new]').click();
  const form=owner.locator('#user-form');await form.locator('[name=name]').fill('Nhân viên bán hàng');await form.locator('[name=email]').fill('staff@example.test');await form.locator('[name=password]').fill(initial);await form.locator('[name=role]').selectOption('sales');await form.locator('button.primary').click();await owner.getByText('staff@example.test',{exact:true}).waitFor();
  const id=db.prepare('SELECT id FROM users WHERE email=?').get('staff@example.test').id;
  await owner.locator('tr').filter({hasText:'staff@example.test'}).getByText('Cần đổi mật khẩu được cấp').waitFor();
  const staff=await page(390);await signIn(staff,'staff@example.test',initial);await staff.locator('#required-password').waitFor();assert.equal(await staff.locator('.admin-sidebar').count(),0);
  assert.equal(await staff.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const blocked=await staff.evaluate(async()=>{const r=await fetch('/api/admin/orders');return {status:r.status,body:await r.json()};});assert.equal(blocked.status,403);assert.equal(blocked.body.code,'PASSWORD_CHANGE_REQUIRED');
  await staff.goto(base+'/#admin/products');await staff.locator('#required-password').waitFor();assert.equal(new URL(staff.url()).hash,'#change-password');
  const own=randomBytes(20).toString('hex');await change(staff,initial,own);await signIn(staff,'staff@example.test',own);await staff.locator('#logout').waitFor();await staff.goto(base+'/#admin/orders');await staff.locator('.admin-topbar h1').waitFor();assert.equal(await staff.locator('[data-admin-nav=users]').count(),0);
  const reset=randomBytes(20).toString('hex');await owner.locator('[data-user-password="'+id+'"]').click();await owner.locator('#reset-password input').fill(reset);await owner.locator('#reset-password button.primary').click();await owner.locator('#reset-password').waitFor({state:'hidden'});
  await staff.reload();assert.equal(await staff.evaluate(async()=>(await (await fetch('/api/me')).json()).user),null);await signIn(staff,'staff@example.test',reset);await staff.locator('#required-password').waitFor();
  await change(staff,reset,randomBytes(20).toString('hex'));
  await owner.goto(base+'/#admin/system');await owner.locator('[data-feature=wallets]').getByText('Chưa tích hợp',{exact:true}).waitFor();await owner.locator('[data-feature=pages]').getByText('Trang nội dung',{exact:true}).waitFor();
  for(const width of [375,768,1440]){await owner.setViewportSize({width,height:900});assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'system page overflow '+width);}
  assert.deepEqual(errors,[]);
  console.log('PASS admin issues staff account; first login and reset require a private password; direct API cannot bypass; role menus and feature readiness work on mobile/desktop.');
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true}); }
