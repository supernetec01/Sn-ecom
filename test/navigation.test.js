import { decorateProduct } from '../commerce-store.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore, hashPassword, readProduct } from '../store.js';
import { createApp } from '../server.js';
import { defaultNavigation } from '../navigation.js';

test('Navigation migration adds only the missing field and preserves custom labels and pages', () => {
 const dir = mkdtempSync(join(tmpdir(), 'sn-navigation-migration-'));
 let db;
 try {
  db = openStore(dir);
  const existing = JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  existing.labels.products = 'Sản phẩm riêng';
  existing.brand = 'Thương hiệu riêng';
  existing.bankName = 'Ngân hàng đã lưu';
  delete existing.navigation;
  db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(existing));
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  db.close();
  db = openStore(dir);
  const migrated = JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  assert.deepEqual(migrated, { ...existing, navigation: defaultNavigation });
  assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all(), products);
  migrated.navigation.categoryLabel = 'Khám phá danh mục';
  migrated.navigation.items[0].label = 'Bộ sưu tập chọn lọc';
  migrated.navigation.items[0].productIds = [1, 3];
  migrated.navigation.items[6].enabled = false;
  db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(migrated));
  db.close();
  db = openStore(dir);
  assert.deepEqual(JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value), migrated);
 } finally {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
 }
});

async function fixture(prefix) {
 const dir = mkdtempSync(join(tmpdir(), prefix));
 const db = openStore(dir);
 const server = createApp(db).listen(0, '127.0.0.1');
 await once(server, 'listening');
 const base = `http://127.0.0.1:${server.address().port}`;
 async function request(path, { method = 'GET', body, cookie, csrf } = {}) {
  const response = await fetch(base + '/api' + path, {
   method,
   headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
   body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: JSON.parse(text), text, cookie: response.headers.get('set-cookie')?.split(';')[0] };
 }
 return {
  db, request,
  async close() {
   await new Promise(resolve => server.close(resolve));
   db.close();
   rmSync(dir, { recursive: true, force: true });
  },
 };
}

test('Admin can edit navigation content and order; unauthorized or invalid updates cannot persist', async () => {
 const { db, request, close } = await fixture('sn-navigation-api-');
 try {
  assert.equal((await request('/admin/settings')).status, 401);
  const addUser = db.prepare('INSERT INTO users(email,name,password,role) VALUES(?,?,?,?)');
  addUser.run('nav-admin@example.com', 'Admin', hashPassword('navigation-admin-123'), 'admin');
  addUser.run('nav-customer@example.com', 'Customer', hashPassword('navigation-customer-123'), 'customer');
  const customer = await request('/login', { method: 'POST', body: { email: 'nav-customer@example.com', password: 'navigation-customer-123' } });
  assert.equal((await request('/admin/settings', { cookie: customer.cookie })).status, 403);
  const login = await request('/login', { method: 'POST', body: { email: 'nav-admin@example.com', password: 'navigation-admin-123' } });
  const auth = { cookie: login.cookie, csrf: login.data.csrf };
  const settings = (await request('/admin/settings', auth)).data;
  assert.deepEqual(settings.navigation, defaultNavigation);
  const labels = structuredClone(settings.labels);
  settings.navigation.categoryLabel = 'Danh mục của tôi';
  settings.navigation.allLabel = 'Xem toàn bộ';
  settings.navigation.items.reverse();
  Object.assign(settings.navigation.items[0], {
   label: 'Thành viên Super Net', enabled: false, title: 'Tiêu đề của cửa hàng',
   eyebrow: 'Thông tin thành viên', description: 'Mô tả đã chỉnh', body: 'Chưa mở chương trình.\nThông tin sẽ được cập nhật.',
   image: '/images/scene-living.webp', productIds: [2, 1],
  });
  assert.equal((await request('/admin/settings', { method: 'PUT', body: settings, cookie: customer.cookie, csrf: customer.data.csrf })).status, 403);
  assert.equal((await request('/admin/settings', { method: 'PUT', body: settings, cookie: login.cookie })).status, 403);
  assert.equal((await request('/admin/settings', { ...auth, method: 'PUT', body: settings })).status, 200);
  const saved = (await request('/settings')).data;
  assert.deepEqual(saved.navigation, settings.navigation);
  assert.deepEqual(saved.labels, labels);
  const invalidNavigation = [
   null, [],
   { ...settings.navigation, extra: 'unrecognized' },
   { ...settings.navigation, categoryLabel: '' },
   { ...settings.navigation, allLabel: 'x'.repeat(101) },
   { ...settings.navigation, items: settings.navigation.items.slice(1) },
   { ...settings.navigation, items: [...settings.navigation.items, settings.navigation.items[0]] },
  ];
  const invalidItems = [
   { id: 'unknown' }, { id: settings.navigation.items[1].id },
   { enabled: 'true' }, { label: '' }, { title: 'x'.repeat(301) },
   { description: 'x'.repeat(2001) }, { body: 'x'.repeat(10001) },
   { image: 'javascript:alert(1)' }, { image: '//example.com/image.webp' },
   { image: 'data:image/svg+xml,anything' },
   { productIds: [0] }, { productIds: [-1] }, { productIds: [1.5] },
   { productIds: ['1'] }, { productIds: [1, 1] }, { productIds: [1e9 + 1] },
   { productIds: Array.from({ length: 201 }, (_, index) => index + 1) },
   { unknown: 'unrecognized' },
  ];
  for (const patch of invalidItems) {
   const navigation = structuredClone(settings.navigation);
   Object.assign(navigation.items[0], patch);
   invalidNavigation.push(navigation);
  }
  for (const navigation of invalidNavigation) {
   assert.equal((await request('/admin/settings', { ...auth, method: 'PUT', body: { ...settings, navigation } })).status, 400);
  }
  assert.deepEqual((await request('/admin/settings', auth)).data, saved);
 } finally { await close(); }
});

test('Bestsellers ranks only completed quantities of active products and exposes no order information', async () => {
 const { db, request, close } = await fixture('sn-bestsellers-api-');
 try {
  assert.deepEqual((await request('/collections/bestsellers')).data, []);
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  const [first, second, hidden, removed, tied] = products;
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(hidden.id);
  const addUser = db.prepare('INSERT INTO users(email,name,password) VALUES(?,?,?)');
  const buyer = Number(addUser.run('private-buyer@example.com', 'Private buyer', 'not-used-for-login').lastInsertRowid);
  const other = Number(addUser.run('private-other@example.com', 'Private other', 'not-used-for-login').lastInsertRowid);
  const insertOrder = db.prepare('INSERT INTO orders(user_id,created,status,total,shipping,payment,recipient,address,phone,items,bank) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const order = (status, items, userId = buyer) => insertOrder.run(userId, '2026-10-17T00:00:00.000Z', status, 999000, 30000, 'bank', 'Private recipient', 'Private shipping address', '0901234567', JSON.stringify(items.map(([id, quantity]) => ({ id, name: 'Snapshot product', price: 100000, quantity }))), '{"account":"private-bank-account"}');
  order('pending', [[first.id, 99]]);
  order('confirmed', [[first.id, 98]]);
  order('shipped', [[first.id, 97]]);
  order('cancelled', [[first.id, 96]]);
  assert.deepEqual((await request('/collections/bestsellers')).data, []);
  order('completed', [[first.id, 2], [second.id, 1], [hidden.id, 99], [removed.id, 98]]);
  order('completed', [[second.id, 4], [tied.id, 2]], other);
  db.prepare('DELETE FROM products WHERE id=?').run(removed.id);
  const response = await request('/collections/bestsellers');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.map(product => product.id), [second.id, tied.id, first.id]);
  const expected = [second.id, tied.id, first.id].map(id => decorateProduct(db,db.prepare('SELECT * FROM products WHERE id=?').get(id),readProduct));
  assert.deepEqual(response.data, expected);
  assert.equal(typeof response.data[0].details, 'object');
  for (const privateValue of ['private-buyer', 'private-other', 'Private recipient', 'Private shipping address', '0901234567', 'private-bank-account', 'user_id', 'sold_quantity']) assert.equal(response.text.includes(privateValue), false);
 } finally { await close(); }
});
