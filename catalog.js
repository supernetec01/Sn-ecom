// Keep SKU identity consistent across JSON product details, variants and CSV.
// Preserve case and internal characters; trim surrounding Unicode whitespace.
export const normalizeSku = value => typeof value === 'string' ? value.trim() : '';

export function registerCatalogFunctions(db) {
  db.function('sn_sku',{deterministic:true},normalizeSku);
}

export function assertSkuAvailable(db, value, {productId=0,variantId=0}={}) {
  const sku=normalizeSku(value);
  if (!sku) return;
  const product=db.prepare("SELECT id FROM products WHERE sn_sku(json_extract(details,'$.sku'))=? AND id!=?").get(sku,productId);
  const variant=db.prepare('SELECT id FROM product_variants WHERE sn_sku(sku)=? AND id!=?').get(sku,variantId);
  if (product || variant) throw Object.assign(Error('SKU đã tồn tại.'),{status:409});
}

export function productVariants(db, productId) {
  return db.prepare('SELECT * FROM product_variants WHERE product_id=? ORDER BY id').all(productId);
}
