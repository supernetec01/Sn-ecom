import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { openStore, hashPassword, checkPassword } from '../store.js';
import { configSections } from '../admin-api.js';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sn-admin-')), db = openStore(dir);
  const password = randomBytes(20).toString('hex');
  const ids = {};
  for (const role of ['admin', 'manager', 'editor', 'customer']) ids[role] = Number(db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(role, `${role}@example.test`, hashPassword(password), role).lastInsertRowid);
  const server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', body, cookie, csrf } = {}) {
    const r = await fetch(base + '/api' + path, { method, headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  async function login(role, pass = password) { const r = await request('/login', { method: 'POST', body: { email: `${role}@example.test`, password: pass } }); assert.equal(r.status, 200); return { cookie: r.cookie, csrf: r.data.csrf }; }
  return { db, request, login, password, ids, async close() { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const sectionValues = (settings, section) => Object.fromEntries(configSections[section].map(key => [key, settings[key]]));

test('RBAC denies direct API access and cross-section writes, not just hidden menu links', async () => {
  const f = await fixture(); const { request, login } = f;
  try {
    assert.equal((await request('/admin/users')).status, 401);
    const admin = await login('admin'), manager = await login('manager'), editor = await login('editor'), customer = await login('customer');
    for (const path of ['/admin/dashboard', '/admin/products', '/admin/orders', '/admin/categories']) assert.equal((await request(path, manager)).status, 200, path);
    for (const path of ['/admin/users', '/admin/audit', '/admin/settings', '/admin/config']) assert.equal((await request(path, manager)).status, 403, path);
    assert.equal((await request('/admin/config', editor)).status, 200);
    for (const path of ['/admin/products', '/admin/orders', '/admin/users', '/admin/audit', '/admin/dashboard', '/admin/categories']) assert.equal((await request(path, editor)).status, 403, path);
    for (const path of ['/admin/products', '/admin/config', '/admin/users']) assert.equal((await request(path, customer)).status, 403);
    const c = (await request('/admin/config', admin)).data;
    assert.equal((await request('/admin/settings', { ...editor, method: 'PATCH', body: { section: 'sales', revision: c.revision, values: sectionValues(c.settings, 'sales') } })).status, 403);
    assert.equal((await request('/admin/settings', { ...editor, method: 'PUT', body: c.settings })).status, 403);
    assert.equal((await request('/admin/settings', { ...editor, method: 'PATCH', body: { section: 'brand', revision: c.revision, values: { ...sectionValues(c.settings, 'brand'), bankAccount: 'forged' } } })).status, 400);
    assert.equal((await request('/admin/users', { ...manager, method: 'POST', body: { name: 'Elevated', email: 'attack@example.test', password: f.password, role: 'admin' } })).status, 403);
    assert.equal((await request('/admin/users', { cookie: admin.cookie, method: 'POST', body: {} })).status, 403);
    const me = (await request('/me', manager)).data.user;
    assert.ok(me.permissions.includes('products.manage')); assert.ok(!('password' in me));
  } finally { await f.close(); }
});

test('Section saves preserve unrelated fields, reject stale edits and audit without sensitive values', async () => {
  const f = await fixture(); const { request, login, db } = f;
  try {
    const admin = await login('admin'), editor = await login('editor');
    const old = (await request('/admin/config', admin)).data;
    const values = { ...sectionValues(old.settings, 'sales'), bankName: 'Configured bank', bankAccount: '12345678', bankHolder: 'Store' };
    assert.equal((await request('/admin/settings', { ...admin, method: 'PATCH', body: { section: 'sales', values, revision: old.revision } })).status, 200);
    const stale = await request('/admin/settings', { ...editor, method: 'PATCH', body: { section: 'brand', revision: old.revision, values: { ...sectionValues(old.settings, 'brand'), brand: 'Stale title' } } });
    assert.equal(stale.status, 409);
    const fresh = (await request('/admin/config', editor)).data;
    assert.equal((await request('/admin/settings', { ...editor, method: 'PATCH', body: { section: 'policies', revision: fresh.revision, values: { policies: [{ title: 'New policy', body: 'New content' }] } } })).status, 200);
    const saved = (await request('/settings')).data;
    assert.equal(saved.brand, old.settings.brand); assert.equal(saved.bankAccount, values.bankAccount); assert.equal(saved.policies[0].title, 'New policy');
    const before = db.prepare('SELECT COUNT(*) AS count FROM audit_log').get().count;
    assert.equal((await request('/admin/settings', { ...editor, method: 'PATCH', body: { section: 'policies', revision: fresh.revision + 1, values: { policies: [{ title: 123, body: 'Invalid' }] } } })).status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_log').get().count, before);
    const audits = (await request('/admin/audit', admin)).data;
    assert.ok(audits.some(item => item.entity_id === 'sales')); assert.ok(!JSON.stringify(audits).includes('12345678'));
  } finally { await f.close(); }
});

test('Categories rename atomically with products and images, refusing duplicate or nonempty deletion', async () => {
  const f = await fixture(); const { request, login, db } = f;
  try {
    const manager = await login('manager');
    const original = (await request('/settings')).data;
    const name = original.categories[0], newName = 'Danh mục mới';
    const ids = db.prepare('SELECT id FROM products WHERE category=?').all(name).map(p => p.id);
    const mutate = async (method, body) => request('/admin/categories', { ...manager, method, body: { ...body, revision: (await request('/admin/categories', manager)).data.revision } });
    assert.equal((await mutate('DELETE', { name })).status, 409);
    assert.equal((await mutate('PATCH', { name, newName: original.categories[1] })).status, 400);
    assert.equal((await mutate('PATCH', { name, newName })).status, 200);
    for (const id of ids) assert.equal(db.prepare('SELECT category FROM products WHERE id=?').get(id).category, newName);
    const saved = (await request('/settings')).data;
    assert.ok(!saved.categories.includes(name)); assert.ok(saved.categories.includes(newName));
    for (const item of saved.editorial.categoryImages) assert.notEqual(item.category, name);
    assert.equal((await mutate('POST', { name: newName.toUpperCase() })).status, 400);
    assert.equal((await mutate('POST', { name: 'Temporary' })).status, 201);
    assert.equal((await mutate('DELETE', { name: 'Temporary' })).status, 200);
    // Force validation to fail after product rename: both settings and product writes must roll back.
    const settingsBefore = db.prepare('SELECT value,revision FROM settings').get();
    const malformed = JSON.parse(settingsBefore.value); malformed.benefits = ['x'.repeat(201)];
    db.prepare('UPDATE settings SET value=?').run(JSON.stringify(malformed));
    assert.equal((await mutate('PATCH', { name: newName, newName: 'Rollback' })).status, 400);
    for (const id of ids) assert.equal(db.prepare('SELECT category FROM products WHERE id=?').get(id).category, newName);
  } finally { await f.close(); }
});

test('User management validates roles, protects self, filters safely and revokes changed sessions immediately', async () => {
  const f = await fixture(); const { request, login, ids, password, db } = f;
  try {
    const admin = await login('admin'); let manager = await login('manager');
    assert.equal((await request('/admin/users?q=manager&role=manager&status=active', admin)).data.items.length, 1);
    assert.equal((await request('/admin/users?q=%25', admin)).data.total, 0);
    const edit = (id, values) => request('/admin/users/' + id, { ...admin, method: 'PATCH', body: { name: 'Updated', email: 'manager@example.test', role: 'manager', disabled: false, ...values } });
    assert.equal((await edit(ids.admin, { email: 'admin@example.test', role: 'customer' })).status, 409);
    assert.equal((await edit(ids.admin, { email: 'admin@example.test', role: 'admin', disabled: true })).status, 409);
    assert.equal((await edit(ids.manager, { role: 'superadmin' })).status, 400);
    assert.equal((await edit(ids.manager, { disabled: 'false' })).status, 400);
    assert.equal((await edit(ids.manager, { role: 'editor' })).status, 200);
    assert.equal((await request('/admin/products', manager)).status, 401);
    manager = await login('manager'); assert.equal((await request('/admin/products', manager)).status, 403);
    assert.equal((await edit(ids.manager, { role: 'editor', disabled: true })).status, 200);
    assert.equal((await request('/admin/config', manager)).status, 401);
    assert.equal((await request('/login', { method: 'POST', body: { email: 'manager@example.test', password } })).status, 401);
    const newPass = randomBytes(20).toString('hex');
    const user = await request('/admin/users', { ...admin, method: 'POST', body: { name: 'New staff', email: 'staff@example.test', role: 'manager', password: newPass } });
    assert.equal(user.status, 201); assert.ok(!('password' in user.data));
    assert.ok(checkPassword(newPass, db.prepare('SELECT password FROM users WHERE id=?').get(user.data.id).password));
    assert.equal((await request('/admin/users', { ...admin, method: 'POST', body: { name: 'Duplicate', email: 'staff@example.test', role: 'admin', password: newPass } })).status, 400);
    assert.equal((await request('/admin/users', admin)).data.items.some(user => 'password' in user), false);
  } finally { await f.close(); }
});

test('Admin reset and own password change verify credentials and invalidate all old sessions', async () => {
  const f = await fixture(); const { request, login, password, ids, db } = f;
  try {
    const admin = await login('admin'), buyer = await login('customer'), buyerOther = await login('customer');
    const newPass = randomBytes(20).toString('hex');
    assert.equal((await request('/admin/users/' + ids.admin + '/password', { ...admin, method: 'POST', body: { password: newPass } })).status, 400);
    assert.equal((await request('/admin/users/' + ids.customer + '/password', { ...admin, method: 'POST', body: { password: newPass } })).status, 200);
    for (const ctx of [buyer, buyerOther]) assert.equal((await request('/orders', ctx)).status, 401);
    assert.equal((await request('/login', { method: 'POST', body: { email: 'customer@example.test', password } })).status, 401);
    const fresh = await login('customer', newPass), second = await login('customer', newPass), finalPass = randomBytes(20).toString('hex');
    assert.equal((await request('/account/password', { ...fresh, method: 'POST', body: { currentPassword: 'incorrect', newPassword: finalPass } })).status, 401);
    assert.equal((await request('/orders', fresh)).status, 200);
    assert.equal((await request('/account/password', { ...fresh, method: 'POST', body: { currentPassword: newPass, newPassword: finalPass } })).status, 200);
    for (const ctx of [fresh, second]) assert.equal((await request('/orders', ctx)).status, 401);
    await login('customer', finalPass);
    const audit = JSON.stringify(db.prepare('SELECT * FROM audit_log').all());
    for (const secret of [password, newPass, finalPass]) assert.ok(!audit.includes(secret));
  } finally { await f.close(); }
});

test('Additive admin migration preserves previous accounts, sessions and settings across reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-admin-upgrade-')); let db;
  try {
    db = openStore(dir);
    const password = hashPassword(randomBytes(20).toString('hex'));
    db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('Owner', 'owner@example.test', password);
    const settings = db.prepare('SELECT value FROM settings').get().value;
    const users = db.prepare('SELECT id,name,email,password,role FROM users').all();
    db.close();
    db = new DatabaseSync(join(dir, 'store.sqlite'));
    db.exec('ALTER TABLE users DROP COLUMN disabled; ALTER TABLE users DROP COLUMN password_change_required; ALTER TABLE settings DROP COLUMN revision;'); db.close();
    db = openStore(dir);
    assert.deepEqual(db.prepare('SELECT id,name,email,password,role FROM users').all(), users);
    assert.equal(db.prepare('SELECT disabled FROM users').get().disabled, 0);
    assert.equal(db.prepare('SELECT password_change_required FROM users').get().password_change_required, 0);
    assert.equal(db.prepare('SELECT revision FROM settings').get().revision, 0);
    assert.equal(db.prepare('SELECT value FROM settings').get().value, settings);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_log').get().count, 0);
    db.prepare('UPDATE users SET password_change_required=1').run();db.close();db=openStore(dir);
    assert.equal(db.prepare('SELECT password_change_required FROM users').get().password_change_required, 1);
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('Extended commerce endpoints share the role gate; changing credentials also revokes pending recovery links', async () => {
  const f = await fixture(); const { request, login, db, ids } = f;
  try {
    const admin = await login('admin'), manager = await login('manager'), editor = await login('editor');
    for (const path of ['/admin/inventory', '/admin/returns', '/admin/coupons', '/admin/reviews', '/admin/overview', '/admin/analytics']) {
      assert.equal((await request(path, manager)).status, 200, path);
    }
    for (const path of ['/admin/inventory', '/admin/returns', '/admin/order-list', '/admin/overview', '/admin/commerce', '/admin/outbox']) assert.equal((await request(path, editor)).status, 403, path);
    for (const path of ['/admin/coupons', '/admin/reviews']) assert.equal((await request(path, editor)).status, 200, path);
    for (const role of ['sales', 'inventory']) {
      const id = Number(db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(role, role+'@example.test', hashPassword(f.password), role).lastInsertRowid);
      const ctx = await login(role);
      assert.equal((await request(role === 'sales' ? '/admin/orders' : '/admin/inventory', ctx)).status, 200);
      assert.equal((await request(role === 'sales' ? '/admin/products' : '/admin/orders', ctx)).status, 403);
      assert.equal((await request('/admin/settings', { ...ctx, method: 'PUT', body: {} })).status, 403);
      assert.equal((await request('/admin/users/'+id+'/role', { ...ctx, method: 'PATCH', body: { role: 'admin' } })).status, 403);
    }
    assert.equal((await request('/admin/unknown-new-endpoint', manager)).status, 403);
    db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?)').run('pending-reset', ids.customer, 'reset', Date.now()+60000);
    assert.equal((await request('/admin/users/'+ids.customer+'/password', { ...admin, method: 'POST', body: { password: randomBytes(20).toString('hex') } })).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_tokens WHERE user_id=?').get(ids.customer).count, 0);
    db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?)').run('pending-verify', ids.manager, 'verify', Date.now()+60000);
    db.prepare('UPDATE users SET verified=1 WHERE id=?').run(ids.manager);
    assert.equal((await request('/admin/users/'+ids.manager, { ...admin, method: 'PATCH', body: { name: 'Manager', email: 'changed@example.test', role: 'manager', disabled: false } })).status, 200);
    assert.equal(db.prepare('SELECT verified FROM users WHERE id=?').get(ids.manager).verified, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_tokens WHERE user_id=?').get(ids.manager).count, 0);
    // Existing commerce notes can contain plain text that happens to be valid JSON.
    db.prepare('INSERT INTO audit_log(actor,action,target,note,created) VALUES(?,?,?,?,?)').run(ids.admin,'stock','1','null',new Date().toISOString());
    assert.equal((await request('/admin/audit', admin)).status, 200);
  } finally { await f.close(); }
});

test('New password dialog contract preserves MFA and cannot bypass a second factor', async () => {
  const { totpSecret, totpCode } = await import('../commerce-store.js');
  const f = await fixture(); const { request, login, db, ids, password } = f;
  try {
    const ctx = await login('admin'), secret = totpSecret(), next = randomBytes(20).toString('hex');
    db.prepare('UPDATE users SET totp_secret=?,password_change_required=1 WHERE id=?').run(secret, ids.admin);
    assert.equal((await request('/account/password', { ...ctx, method: 'POST', body: { currentPassword: password, newPassword: next } })).status, 401);
    assert.equal(db.prepare('SELECT password_change_required FROM users WHERE id=?').get(ids.admin).password_change_required,1);
    assert.ok(checkPassword(password, db.prepare('SELECT password FROM users WHERE id=?').get(ids.admin).password));
    assert.equal((await request('/account/password', { ...ctx, method: 'POST', body: { currentPassword: password, newPassword: next, otp: totpCode(secret) } })).status, 200);
    assert.equal((await request('/admin/dashboard', ctx)).status, 401);
    assert.equal(db.prepare('SELECT totp_secret FROM users WHERE id=?').get(ids.admin).totp_secret, secret);
    assert.equal(db.prepare('SELECT password_change_required FROM users WHERE id=?').get(ids.admin).password_change_required,0);
    assert.equal((await request('/login', { method: 'POST', body: { email: 'admin@example.test', password: next } })).status, 401);
  } finally { await f.close(); }
});

test('Admin-issued staff passwords require a private password before any staff or account work', async () => {
  const f = await fixture(); const { request, login, db } = f;
  try {
    const admin = await login('admin'), initial = randomBytes(20).toString('hex'), own = randomBytes(20).toString('hex');
    const created = await request('/admin/users', { ...admin, method:'POST', body:{name:'Issued staff',email:'issued@example.test',password:initial,role:'sales'} });
    assert.equal(created.status,201); assert.equal(created.data.mustChangePassword,true);
    const signIn = async password => request('/login',{method:'POST',body:{email:'issued@example.test',password}});
    let signed = await signIn(initial); assert.equal(signed.status,200); assert.equal(signed.data.user.mustChangePassword,true);
    const staff = { cookie:signed.cookie, csrf:signed.data.csrf };
    for (const [path,method,body] of [
      ['/admin/orders','GET'],['/admin/users','GET'],['/orders','GET'],['/admin/orders/1','PATCH',{status:'confirmed'}],
      ['/account/profile','POST',{name:'Bypass',mustChangePassword:false}],['/addresses','GET'],['/checkout/quote','POST',{}],
    ]) {
      const result = await request(path,{...staff,method,body}); assert.equal(result.status,403,path); assert.equal(result.data.code,'PASSWORD_CHANGE_REQUIRED',path);
    }
    assert.equal((await request('/settings',staff)).status,200);
    assert.equal((await request('/me',staff)).data.user.mustChangePassword,true);
    assert.equal((await request('/account/password',{cookie:staff.cookie,method:'POST',body:{currentPassword:initial,newPassword:own}})).status,403);
    assert.equal((await request('/account/password',{...staff,method:'POST',body:{currentPassword:'wrong',newPassword:own}})).status,401);
    assert.equal((await request('/account/password',{...staff,method:'POST',body:{currentPassword:initial,newPassword:initial}})).status,400);
    assert.equal(db.prepare('SELECT password_change_required FROM users WHERE id=?').get(created.data.id).password_change_required,1);
    assert.equal((await request('/account/password',{...staff,method:'POST',body:{currentPassword:initial,newPassword:own}})).status,200);
    assert.equal((await request('/admin/orders',staff)).status,401);
    assert.equal((await signIn(initial)).status,401);
    signed = await signIn(own); assert.equal(signed.data.user.mustChangePassword,false);
    const active = {cookie:signed.cookie,csrf:signed.data.csrf};
    assert.equal((await request('/admin/orders',active)).status,200);
    assert.equal((await request('/admin/users',active)).status,403);
    const temporary = randomBytes(20).toString('hex');
    assert.equal((await request('/admin/users/'+created.data.id+'/password',{...admin,method:'POST',body:{password:temporary}})).status,200);
    assert.equal((await request('/admin/orders',active)).status,401);
    signed = await signIn(temporary); assert.equal(signed.data.user.mustChangePassword,true);
    assert.equal((await request('/admin/orders',{cookie:signed.cookie})).data.code,'PASSWORD_CHANGE_REQUIRED');
    const rows = (await request('/admin/users?scope=staff',admin)).data.items;
    assert.ok(rows.every(user=>!['customer','guest'].includes(user.role)));
    assert.equal(rows.find(user=>user.id===created.data.id).password_change_required,1);
    assert.ok((await request('/admin/users?scope=customers',admin)).data.items.every(user=>user.role==='customer'));
  } finally { await f.close(); }
});

test('Password recovery clears temporary status and a failed password audit rolls back all changes', async () => {
  const f = await fixture(); const { request, login, db, ids, password } = f;
  const { sha } = await import('../commerce-store.js');
  try {
    db.prepare('UPDATE users SET password_change_required=1 WHERE id=?').run(ids.manager);
    const ctx = await login('manager'), next = randomBytes(20).toString('hex');
    db.exec("CREATE TRIGGER fail_password_audit BEFORE INSERT ON audit_log WHEN NEW.action='password_changed' BEGIN SELECT RAISE(ABORT,'test'); END");
    assert.equal((await request('/account/password',{...ctx,method:'POST',body:{currentPassword:password,newPassword:next}})).status,500);
    const row=db.prepare('SELECT password,password_change_required FROM users WHERE id=?').get(ids.manager);
    assert.ok(checkPassword(password,row.password));assert.equal(row.password_change_required,1);
    assert.ok((await request('/me',ctx)).data.user);
    db.exec('DROP TRIGGER fail_password_audit');
    const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?)').run(sha(token),ids.manager,'reset',Date.now()+60000);
    assert.equal((await request('/account/reset',{method:'POST',body:{token,password}})).status,400);
    assert.equal((await request('/account/reset',{method:'POST',body:{token,password:next}})).status,200);
    assert.equal(db.prepare('SELECT password_change_required FROM users WHERE id=?').get(ids.manager).password_change_required,0);
    assert.equal((await request('/admin/orders',ctx)).status,401);
    const fresh=await login('manager',next);assert.equal((await request('/admin/orders',fresh)).status,200);
  } finally { await f.close(); }
});

test('Feature readiness separates empty data, configuration, disabled programs and missing integrations without exposing secrets', async () => {
  const f = await fixture(); const { request, login, db } = f;
  const { systemStatus } = await import('../system-status.js');
  try {
    assert.equal((await request('/admin/system')).status,401);
    for(const role of ['manager','editor','customer'])assert.equal((await request('/admin/system',await login(role))).status,403);
    const result=await request('/admin/system',await login('admin'));assert.equal(result.status,200);assert.equal(result.data.providerConnectionsChecked,false);
    const snapshot=()=>({users:db.prepare('SELECT * FROM users').all(),settings:db.prepare('SELECT * FROM settings').all(),orders:db.prepare('SELECT * FROM orders').all(),outbox:db.prepare('SELECT * FROM notification_outbox').all()});
    const before=snapshot(),empty=systemStatus(db,{}), byId=Object.fromEntries(empty.features.map(feature=>[feature.id,feature]));
    assert.equal(byId.orders.state,'empty'); assert.equal(byId.reviews.state,'empty'); assert.equal(byId.rewards.state,'disabled');
    assert.equal(byId.pages.state,'content_only');assert.equal(byId.wallets.state,'not_implemented');assert.equal(byId.email.state,'needs_configuration');
    assert.equal(byId.assistant.state,'fallback');assert.equal(byId.translation.state,'fallback');
    const secret=randomBytes(32).toString('hex');
    const configured=systemStatus(db,{EMAIL_API_KEY:secret,EMAIL_FROM:'sender@example.test',APP_ORIGIN:'https://shop.example.test',VNPAY_TMN_CODE:secret,VNPAY_HASH_SECRET:secret,AI_API_KEY:secret,AI_MODEL:'model',TRANSLATION_API_KEY:secret});
    for(const id of ['email','vnpay','assistant','translation'])assert.equal(configured.features.find(f=>f.id===id).state,'configured');
    assert.ok(!JSON.stringify(configured).includes(secret));assert.ok(!JSON.stringify(configured).includes('sender@example.test'));
    assert.deepEqual(snapshot(),before);
  } finally { await f.close(); }
});
