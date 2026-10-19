export const roles = {
  admin: { label: 'Quản trị viên', description: 'Toàn quyền, gồm tài khoản, thanh toán và nhật ký.', permissions: ['dashboard.read', 'products.manage', 'orders.manage', 'content.manage', 'settings.manage', 'users.manage', 'audit.read'] },
  manager: { label: 'Quản lý cửa hàng', description: 'Quản lý sản phẩm, danh mục và xử lý đơn hàng.', permissions: ['dashboard.read', 'products.manage', 'orders.manage'] },
  editor: { label: 'Biên tập nội dung', description: 'Sửa giao diện, bài viết, menu và chính sách; không đổi thanh toán.', permissions: ['content.manage'] },
  customer: { label: 'Khách hàng', description: 'Mua hàng và xem đơn của chính mình.', permissions: [] },
};
export const permissionsFor = role => [...(roles[role]?.permissions || [])];
export const publicUser = user => ({ id: user.id ?? user.user_id, name: user.name, email: user.email, role: user.role, permissions: permissionsFor(user.role) });
export function audit(db, actorId, action, entity, entityId, details = {}) {
  db.prepare('INSERT INTO audit_log(actor_id,action,entity,entity_id,details,created) VALUES(?,?,?,?,?,?)').run(actorId, action, entity, String(entityId), JSON.stringify(details), new Date().toISOString());
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
