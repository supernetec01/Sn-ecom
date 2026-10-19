const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const snapshotFields = ['price', 'stock', 'active', 'sku', 'label', 'status', 'image'];
const detailFields = ['active', 'from', 'status', 'fromRole', 'role', 'disabled'];
const scalar = value => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 500);
function safeDetails(value) {
  if (!record(value)) return {};
  const result = Object.fromEntries(detailFields.filter(key => scalar(value[key])).map(key => [key, value[key]]));
  for (const key of ['before', 'after']) if (record(value[key])) {
    result[key] = Object.fromEntries(snapshotFields.filter(field => scalar(value[key][field])).map(field => [field, value[key][field]]));
  }
  return result;
}
function entityFor(action) {
  if (/^(product[._]|csv_import)/.test(action)) return 'product';
  if (/^variant_/.test(action)) return 'variant';
  if (action === 'review') return 'review';
  if (action === 'stock') return 'product';
  return 'Dữ liệu';
}
export function appendAudit(db, actor, action, entity, target, details = {}) {
  db.prepare('INSERT INTO audit_log(actor,action,target,note,created) VALUES(?,?,?,?,?)').run(actor ?? null, action, String(target), JSON.stringify({ entity, entity_id: String(target), details: safeDetails(details) }), new Date().toISOString());
}
// Read both the original {before,after} notes and the structured admin format.
// Never expose arbitrary note text or unrecognised fields through the API.
export function auditView(row) {
  let data = {};
  try { const parsed = JSON.parse(row.note); if (record(parsed)) data = parsed; } catch {}
  return { id: row.id, action: row.action, actor: row.actor_name, created: row.created,
    entity: typeof data.entity === 'string' ? data.entity : entityFor(row.action),
    entity_id: typeof data.entity_id === 'string' ? data.entity_id : row.target,
    details: safeDetails(record(data.details) ? data.details : data) };
}
