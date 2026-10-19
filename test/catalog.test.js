import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { openStore, seedDemoCatalog, readProduct, hashPassword } from '../store.js';
import { sampleCatalog, legacySamples } from '../sample-catalog.js';
import { createApp } from '../server.js';

function legacyDatabase(dir, products = legacySamples) {
  const db = new DatabaseSync(join(dir, 'store.sqlite'));
  db.exec(`
    CREATE TABLE settings(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL,
      image TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  `);
  db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({
    categories: ['Nhà bếp', 'Đồ gia dụng', 'Phong cách sống'],
    heroTitle: 'Nội dung riêng của cửa hàng',
    shippingFee: 47000,
    bankAccount: 'public-bank-account',
    ui: { 'Tạm tính': 'Giá trị giỏ hàng của tôi', 'Nhãn riêng': 'Giữ nguyên nhãn riêng' },
  }));
  for (const product of products) db.prepare('INSERT INTO products(name,category,description,price,stock,image) VALUES(?,?,?,?,?,?)').run(...product);
  db.close();
}

test('A new database has sixteen editable demo products; reopening does not reset or resurrect them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-catalog-'));
  let db;
  try {
    db = openStore(dir);
    const products = db.prepare('SELECT * FROM products').all().map(readProduct);
    assert.equal(products.length, sampleCatalog.length);
    assert.equal(new Set(products.map(p => p.details.sku)).size, sampleCatalog.length);
    for (const product of products) {
      assert.equal(product.details.is_sample, true);
      assert.ok(product.details.summary && product.details.care && product.details.material);
      assert.ok(product.details.features.length >= 3);
      assert.ok(product.details.specifications.length >= 3);
      assert.ok(product.image.startsWith('/images/products/'));
    }
    db.prepare('UPDATE products SET name=?,price=?,stock=? WHERE id=?').run('Sản phẩm đã sửa', 78900, 2, products[0].id);
    db.prepare('DELETE FROM products WHERE id=?').run(products[1].id);
    db.close();
    db = openStore(dir);
    const result = seedDemoCatalog(db);
    assert.equal(result.added, 0);
    assert.equal(result.enriched, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products').get().count, sampleCatalog.length - 1);
    const changed = db.prepare('SELECT * FROM products WHERE id=?').get(products[0].id);
    assert.equal(changed.name, 'Sản phẩm đã sửa');
    assert.equal(changed.price, 78900);
    assert.equal(changed.stock, 2);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Legacy migration preserves all records and settings; explicit seeding enriches only untouched originals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-legacy-'));
  let db;
  try {
    legacyDatabase(dir);
    db = new DatabaseSync(join(dir, 'store.sqlite'));
    db.prepare('UPDATE products SET price=123000,stock=7 WHERE id=1').run();
    db.prepare('UPDATE products SET active=0,image=?,category=? WHERE id=3').run('/my-edited-image.webp', 'Danh mục riêng');
    db.prepare('INSERT INTO products(name,category,description,price,stock,image) VALUES(?,?,?,?,?,?)').run('Sản phẩm của tôi', 'Nhà bếp', 'Mô tả riêng', 90000, 6, '/custom.webp');
    const before = db.prepare('SELECT * FROM products ORDER BY id').all().map(row => ({ ...row }));
    db.close();
    db = openStore(dir);
    assert.deepEqual(db.prepare('SELECT * FROM products ORDER BY id').all().map(({ details, revision, stock_revision, legacy_variant_id, ...row }) => row), before);
    let settings = JSON.parse(db.prepare('SELECT value FROM settings').get().value);
    assert.equal(settings.heroTitle, 'Nội dung riêng của cửa hàng');
    assert.equal(settings.shippingFee, 47000);
    assert.equal(settings.ui['Tạm tính'], 'Giá trị giỏ hàng của tôi');
    assert.equal(settings.ui['Nhãn riêng'], 'Giữ nguyên nhãn riêng');
    assert.equal(settings.ui['Mẫu tham khảo'], 'Mẫu tham khảo');
    assert.equal(settings.ui['Chất liệu'], 'Chất liệu');
    assert.ok(settings.editorial.story.title);
    settings.editorial.story.title = 'Câu chuyện đã biên tập';
    db.prepare('UPDATE settings SET value=?').run(JSON.stringify(settings));
    assert.deepEqual(seedDemoCatalog(db), { added: sampleCatalog.length - legacySamples.length, enriched: 2, preserved: 2, skipped: 0 });
    assert.deepEqual({ ...db.prepare('SELECT * FROM products WHERE id=1').get() }, { ...before[0], details: '{}', revision: 0, stock_revision: 0, legacy_variant_id: null });
    assert.deepEqual({ ...db.prepare('SELECT * FROM products WHERE id=3').get() }, { ...before[2], details: '{}', revision: 0, stock_revision: 0, legacy_variant_id: null });
    const upgraded = readProduct(db.prepare('SELECT * FROM products WHERE id=2').get());
    assert.equal(upgraded.details.sku, 'SN-KT-001');
    assert.equal(upgraded.price, before[1].price);
    assert.equal(upgraded.stock, before[1].stock);
    assert.equal(upgraded.description, sampleCatalog[1].description);
    db.close();
    db = openStore(dir);
    assert.equal(JSON.parse(db.prepare('SELECT value FROM settings').get().value).editorial.story.title, 'Câu chuyện đã biên tập');
    assert.equal(JSON.parse(db.prepare('SELECT value FROM settings').get().value).ui['Tạm tính'], 'Giá trị giỏ hàng của tôi');
    assert.deepEqual(seedDemoCatalog(db), { added: 0, enriched: 0, preserved: 0, skipped: sampleCatalog.length });
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Demo seeding is transactional and respects custom categories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-seed-'));
  let db;
  try {
    legacyDatabase(dir, []);
    db = openStore(dir);
    db.exec(`CREATE TRIGGER reject_demo BEFORE INSERT ON products
      WHEN NEW.name='Hũ thủy tinh Pantry' BEGIN SELECT RAISE(ABORT,'test failure'); END;`);
    assert.throws(() => seedDemoCatalog(db), /test failure/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM demo_catalog_seed').get().count, 0);
    db.exec('DROP TRIGGER reject_demo');
    const settings = JSON.parse(db.prepare('SELECT value FROM settings').get().value);
    settings.categories = ['Danh mục riêng'];
    db.prepare('UPDATE settings SET value=?').run(JSON.stringify(settings));
    assert.equal(seedDemoCatalog(db).added, 0);
    assert.deepEqual(JSON.parse(db.prepare('SELECT value FROM settings').get().value).categories, ['Danh mục riêng']);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Admin can persist rich product and editorial content; nested invalid input is rejected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-details-'));
  const db = openStore(dir);
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, csrf;
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    db.prepare("INSERT INTO users(email,name,password,role) VALUES(?,?,?,'admin')").run('catalog@example.com', 'Admin', hashPassword('catalog-password-123'));
    const login = await request('/login', 'POST', { email: 'catalog@example.com', password: 'catalog-password-123' });
    cookie = login.cookie;
    csrf = login.data.csrf;
    const product = (await request('/products')).data[0];
    assert.equal((await request('/products/' + product.id)).data.details.sku, product.details.sku);
    const edited = { ...product, details: { ...product.details, summary: 'Nội dung đã sửa', is_sample: false, gallery: ['/images/hero-home.webp', 'https://example.com/photo.webp'] } };
    assert.equal((await request('/admin/products/' + product.id, 'PUT', edited)).status, 200);
    assert.deepEqual((await request('/products/' + product.id)).data.details, edited.details);
    const { details, ...oldClientProduct } = (await request('/products/' + product.id)).data;
    assert.equal((await request('/admin/products/' + product.id, 'PUT', { ...oldClientProduct, price: 123000 })).status, 200);
    assert.deepEqual((await request('/products/' + product.id)).data.details, edited.details);
    const invalid = [null, [], { gallery: ['javascript:alert(1)'] }, { features: ['x'.repeat(501)] }, { is_sample: 'true' }, { specifications: [{ label: 'A', value: 'B', html: 'C' }] }, { unknown: 'value' }];
    for (const details of invalid) assert.equal((await request('/admin/products/' + product.id, 'PUT', { ...edited, details })).status, 400);
    const created = await request('/admin/products', 'POST', oldClientProduct);
    assert.equal(created.status, 201);
    assert.deepEqual((await request('/products/' + created.data.id)).data.details, {});
    const settings = (await request('/settings')).data;
    settings.editorial.journal.articles[0].body = 'Nội dung bài viết đã sửa.';
    settings.editorial.story.title = 'Câu chuyện mới';
    assert.equal((await request('/admin/settings', 'PUT', { ...settings, revision: (await request('/admin/config')).data.revision })).status, 200);
    assert.equal((await request('/settings')).data.editorial.journal.articles[0].body, 'Nội dung bài viết đã sửa.');
    settings.editorial.journal.articles[0].image = 'data:text/html,unsafe';
    assert.equal((await request('/admin/settings', 'PUT', { ...settings, revision: (await request('/admin/config')).data.revision })).status, 400);
    settings.editorial.story = null;
    assert.equal((await request('/admin/settings', 'PUT', { ...settings, revision: (await request('/admin/config')).data.revision })).status, 400);
    await request('/admin/products/' + product.id, 'PUT', { ...(await request('/products/' + product.id)).data, active: 0 });
    assert.equal((await request('/products/' + product.id)).status, 404);
    assert.equal((await request('/products')).data.some(p => p.id === product.id), false);
    assert.equal((await request('/admin/products')).data.find(p => p.id === product.id).active, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
