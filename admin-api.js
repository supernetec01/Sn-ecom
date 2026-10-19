import { roles, publicUser, audit, transaction } from './access.js';
import { hashPassword } from './store.js';

const text = (value, max = 200) => typeof value === 'string' && value.length <= max;
const emailValid = value => text(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === [...keys].sort().join();
export const configSections = {
  brand: ['brand', 'tagline', 'logo', 'phone', 'email', 'address', 'footerText', 'colors', 'searchPlaceholder'],
  home: ['announcement', 'heroEyebrow', 'heroTitle', 'heroText', 'heroButton', 'heroImage', 'collectionTitle', 'collectionText', 'productsTitle', 'benefits', 'editorial'],
  navigation: ['navigation'],
  policies: ['policies'],
  wording: ['labels', 'ui'],
  sales: ['shippingFee', 'freeShipping', 'bankName', 'bankAccount', 'bankHolder'],
};

export function installAdminApi(app, { db, auth, csrf, permit, settings, validateSettings, passwordLimit }) {
  const fail = (res, error, status = 400) => res.status(status).json({ error });
  const reject = (message, status = 400) => { const error = new Error(message); error.httpStatus = status; throw error; };
  const safely = handler => (req, res, next) => { try { if (req.method !== 'GET' && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return fail(res, 'Dữ liệu gửi lên không hợp lệ.'); handler(req, res); } catch (error) { if (error.httpStatus) return fail(res, error.message, error.httpStatus); if (error.code?.includes('CONSTRAINT') || (error.errcode & 255) === 19) return fail(res, 'Email đã được sử dụng hoặc dữ liệu không hợp lệ.'); next(error); } };
  const configAccess = permit('content.manage', 'settings.manage');
  const saveConfig = (req, mutate, action, id) => transaction(db, () => {
    const row = db.prepare('SELECT value,revision FROM settings WHERE id=1').get();
    if (req.body.revision !== undefined && req.body.revision !== row.revision) reject('Dữ liệu đã được người khác cập nhật. Hãy tải lại mục này trước khi lưu.', 409);
    const old = JSON.parse(row.value), updated = mutate(structuredClone(old));
    const error = validateSettings(updated, old); if (error) reject(error);
    db.prepare('UPDATE settings SET value=?,revision=revision+1 WHERE id=1').run(JSON.stringify(updated));
    audit(db, req.session.user_id, action, 'settings', id);
    return { ok: true, revision: row.revision + 1 };
  });

  app.patch('/api/admin/products/:id/visibility', csrf, permit('products.manage'), safely((req, res) => {
    if (!validId(req.params.id) || !exact(req.body, ['active']) || ![0, 1].includes(req.body.active)) return fail(res, 'Trạng thái hiển thị không hợp lệ.');
    transaction(db, () => {
      const result = db.prepare('UPDATE products SET active=? WHERE id=?').run(req.body.active, Number(req.params.id));
      if (!result.changes) reject('Không tìm thấy sản phẩm.', 404);
      audit(db, req.session.user_id, 'product.visibility', 'product', req.params.id, { active: req.body.active });
    }); res.json({ ok: true });
  }));
  app.get('/api/admin/dashboard', permit('dashboard.read'), (req, res) => {
    const product = db.prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN stock<=5 THEN 1 ELSE 0 END) AS lowStock FROM products').get();
    const order = db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END),0) AS revenue FROM orders").get();
    res.json({ products: product.total, lowStock: product.lowStock || 0, orders: order.total, pending: order.pending || 0, revenue: order.revenue, recentOrders: db.prepare('SELECT id,recipient,total,status,created FROM orders ORDER BY id DESC LIMIT 5').all() });
  });
  app.get('/api/admin/config', configAccess, (req, res) => res.json({ settings: settings(), revision: db.prepare('SELECT revision FROM settings WHERE id=1').get().revision }));
  app.patch('/api/admin/settings', csrf, configAccess, safely((req, res) => {
    const { section, values, revision } = req.body;
    if (!Object.hasOwn(configSections, section) || !exact(values, configSections[section]) || !Number.isSafeInteger(revision) || revision < 0) return fail(res, 'Mục cấu hình hoặc dữ liệu gửi lên không hợp lệ.');
    const permission = section === 'sales' ? 'settings.manage' : 'content.manage';
    if (!req.session.permissions.includes(permission)) return fail(res, 'Bạn không có quyền thay đổi mục này.', 403);
    res.json(saveConfig(req, old => ({ ...old, ...values }), 'settings.update', section));
  }));

  app.get('/api/admin/categories', permit('products.manage'), (req, res) => res.json({ items: settings().categories.map(name => ({ name, ...db.prepare('SELECT COUNT(*) AS total,COALESCE(SUM(active),0) AS visible FROM products WHERE category=?').get(name) })), revision: db.prepare('SELECT revision FROM settings WHERE id=1').get().revision }));
  app.post('/api/admin/categories', csrf, permit('products.manage'), safely((req, res) => {
    const name = req.body.name;
    if (!text(name, 100) || !name.trim()) return fail(res, 'Nhập tên danh mục từ 1–100 ký tự.');
    res.status(201).json(saveConfig(req, old => {
      if (old.categories.some(value => value.toLocaleLowerCase('vi') === name.trim().toLocaleLowerCase('vi'))) reject('Danh mục đã tồn tại.');
      old.categories.push(name.trim()); return old;
    }, 'category.create', name.trim()));
  }));
  app.patch('/api/admin/categories', csrf, permit('products.manage'), safely((req, res) => {
    const { name, newName } = req.body;
    if (!text(name, 100) || !text(newName, 100) || !newName.trim()) return fail(res, 'Tên danh mục không hợp lệ.');
    res.json(saveConfig(req, old => {
      if (!old.categories.includes(name)) reject('Không tìm thấy danh mục.', 404);
      if (old.categories.some(value => value !== name && value.toLocaleLowerCase('vi') === newName.trim().toLocaleLowerCase('vi'))) reject('Tên danh mục đã tồn tại.');
      old.categories = old.categories.map(value => value === name ? newName.trim() : value);
      old.editorial.categoryImages = old.editorial.categoryImages.map(value => ({ ...value, category: value.category === name ? newName.trim() : value.category }));
      db.prepare('UPDATE products SET category=? WHERE category=?').run(newName.trim(), name); return old;
    }, 'category.rename', name));
  }));
  app.delete('/api/admin/categories', csrf, permit('products.manage'), safely((req, res) => {
    const name = req.body.name;
    if (!text(name, 100)) return fail(res, 'Tên danh mục không hợp lệ.');
    res.json(saveConfig(req, old => {
      if (!old.categories.includes(name)) reject('Không tìm thấy danh mục.', 404);
      if (old.categories.length <= 1) reject('Cửa hàng cần giữ ít nhất một danh mục.', 409);
      if (db.prepare('SELECT id FROM products WHERE category=? LIMIT 1').get(name)) reject('Danh mục còn sản phẩm. Chuyển sản phẩm sang danh mục khác trước khi xóa.', 409);
      old.categories = old.categories.filter(value => value !== name);
      old.editorial.categoryImages = old.editorial.categoryImages.filter(value => value.category !== name); return old;
    }, 'category.delete', name));
  }));

  app.get('/api/admin/users', permit('users.manage'), (req, res) => {
    const q = String(req.query.q || '').slice(0, 200), role = String(req.query.role || ''), status = String(req.query.status || '');
    const page = Math.min(100000, Math.max(1, Number.parseInt(req.query.page, 10) || 1)), pageSize = 20;
    const where = ["role!='guest'"], args = [];
    if (q) { where.push('(name LIKE ? ESCAPE \'\\\' OR email LIKE ? ESCAPE \'\\\')'); const pattern = '%' + q.replace(/[\\%_]/g, value => '\\' + value) + '%'; args.push(pattern, pattern); }
    if (Object.hasOwn(roles, role)) { where.push('role=?'); args.push(role); }
    if (['active', 'disabled'].includes(status)) { where.push('disabled=?'); args.push(status === 'disabled' ? 1 : 0); }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS count FROM users' + clause).get(...args).count;
    const items = db.prepare('SELECT id,name,email,role,disabled FROM users' + clause + ' ORDER BY id DESC LIMIT ? OFFSET ?').all(...args, pageSize, (page - 1) * pageSize);
    res.json({ items, total, page, pageSize, roles });
  });
  app.post('/api/admin/users', csrf, permit('users.manage'), safely((req, res) => {
    const { name, email, password, role } = req.body;
    if (!exact(req.body, ['name', 'email', 'password', 'role']) || !text(name, 100) || !name.trim() || !emailValid(email) || !text(password, 128) || password.length < 12 || !Object.hasOwn(roles, role)) return fail(res, 'Nhập họ tên, email hợp lệ, mật khẩu 12–128 ký tự và vai trò.');
    const user = transaction(db, () => {
      const id = Number(db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run(name.trim(), email.trim().toLowerCase(), hashPassword(password), role).lastInsertRowid);
      audit(db, req.session.user_id, 'user.create', 'user', id, { role });
      return publicUser(db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(id));
    }); res.status(201).json(user);
  }));
  app.patch('/api/admin/users/:id', csrf, permit('users.manage'), safely((req, res) => {
    const { name, email, role, disabled } = req.body;
    if (!validId(req.params.id) || !exact(req.body, ['name', 'email', 'role', 'disabled']) || !text(name, 100) || !name.trim() || !emailValid(email) || !Object.hasOwn(roles, role) || typeof disabled !== 'boolean') return fail(res, 'Thông tin tài khoản không hợp lệ.');
    const id = Number(req.params.id);
    transaction(db, () => {
      const old = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!old || old.role === 'guest') reject('Không tìm thấy tài khoản.', 404);
      if (id === req.session.user_id && (role !== old.role || disabled)) reject('Bạn không thể tự khóa hoặc thay đổi vai trò của chính mình.', 409);
      if (old.role === 'admin' && !old.disabled && (role !== 'admin' || disabled) && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND disabled=0").get().count <= 1) reject('Phải giữ ít nhất một quản trị viên hoạt động.', 409);
      db.prepare('UPDATE users SET name=?,email=?,role=?,disabled=? WHERE id=?').run(name.trim(), email.trim().toLowerCase(), role, disabled ? 1 : 0, id);
      if (role !== old.role || disabled !== Boolean(old.disabled) || email.trim().toLowerCase() !== old.email) {
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
        db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(id);
      }
      if (email.trim().toLowerCase() !== old.email) db.prepare('UPDATE users SET verified=0 WHERE id=?').run(id);
      audit(db, req.session.user_id, 'user.update', 'user', id, { fromRole: old.role, role, disabled });
    }); res.json({ ok: true });
  }));
  app.post('/api/admin/users/:id/password', csrf, permit('users.manage'), passwordLimit, safely((req, res) => {
    const { password } = req.body;
    if (!validId(req.params.id) || !exact(req.body, ['password']) || !text(password, 128) || password.length < 12) return fail(res, 'Mật khẩu cần từ 12–128 ký tự.');
    const id = Number(req.params.id);
    if (id === req.session.user_id) return fail(res, 'Dùng mục Đổi mật khẩu để xác nhận mật khẩu hiện tại của bạn.');
    transaction(db, () => {
      if (!db.prepare("SELECT id FROM users WHERE id=? AND role!='guest'").get(id)) reject('Không tìm thấy tài khoản.', 404);
      db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(password), id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
      db.prepare("DELETE FROM account_tokens WHERE user_id=? AND kind='reset'").run(id);
      audit(db, req.session.user_id, 'user.password_reset', 'user', id);
    }); res.json({ ok: true });
  }));
  app.get('/api/admin/audit', permit('audit.read'), (req, res) => res.json(db.prepare('SELECT a.*,u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100').all().map(row => {
    let data = {}; try { const parsed = JSON.parse(row.note); if (parsed && typeof parsed === 'object') data = parsed; } catch {}
    return { id: row.id, action: row.action, actor: row.actor_name, created: row.created, entity: data.entity || 'Dữ liệu', entity_id: data.entity_id || row.target, details: data.details || {} };
  })));
}
