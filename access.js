import { appendAudit } from './audit-log.js';
export const roles = {
  admin: { label: 'Quản trị viên', description: 'Toàn quyền, gồm tài khoản, thanh toán và nhật ký.', permissions: ['dashboard.read', 'products.manage', 'orders.manage', 'content.manage', 'settings.manage', 'users.manage', 'audit.read', 'marketing.manage', 'outbox.manage'] },
  manager: { label: 'Quản lý cửa hàng', description: 'Quản lý sản phẩm, danh mục và xử lý đơn hàng.', permissions: ['dashboard.read', 'products.manage', 'orders.manage', 'marketing.manage'] },
  editor: { label: 'Biên tập nội dung', description: 'Sửa nội dung, menu, chính sách, mã giảm giá và duyệt đánh giá; không đổi thanh toán.', permissions: ['content.manage', 'marketing.manage'] },
  sales: { label: 'Nhân viên bán hàng', description: 'Xử lý đơn, thu/hoàn tiền, vận đơn và đổi trả.', permissions: ['dashboard.read', 'orders.manage'] },
  inventory: { label: 'Nhân viên kho', description: 'Quản lý sản phẩm, danh mục, biến thể và tồn kho.', permissions: ['products.manage'] },
  customer: { label: 'Khách hàng', description: 'Mua hàng và xem đơn của chính mình.', permissions: [] },
};
export const permissionsFor = role => [...(roles[role]?.permissions || [])];
export const publicUser = user => ({ id: user.id ?? user.user_id, name: user.name, email: user.email, role: user.role, permissions: permissionsFor(user.role) });
export function audit(db, actorId, action, entity, entityId, details = {}) {
  appendAudit(db, actorId, action, entity, entityId, details);
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

// One deny-by-default gate covers both the new workspace and commerce routes.
export function adminGate(req, res, next) {
  const route = req.originalUrl.split('?')[0].replace(/^\/api\/admin\/?/, '');
  const rule = [
    [/^(dashboard|overview|analytics)(\/|$)/, ['dashboard.read']],
    [/^(categories|products|variants|inventory)(\/|$)|^export\/products$/, ['products.manage']],
    [/^(orders|order-list|returns|expire-orders)(\/|$)|^export\/orders$/, ['orders.manage']],
    [/^(settings|config)(\/|$)/, req.method === 'PUT' ? ['settings.manage'] : ['content.manage', 'settings.manage']],
    [/^upload$/, ['products.manage', 'content.manage', 'settings.manage']],
    [/^(reviews|coupons)(\/|$)/, ['marketing.manage']],
    [/^commerce$/, ['settings.manage']],
    [/^users(\/|$)/, ['users.manage']],
    [/^audit$/, ['audit.read']],
    [/^outbox(\/|$)/, ['outbox.manage']],
  ].find(([pattern]) => pattern.test(route));
  if (rule && req.session?.permissions?.some(permission => rule[1].includes(permission))) return next();
  return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
}
