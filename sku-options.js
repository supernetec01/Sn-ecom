import { assertRevision } from './concurrency.js';
import { assertSkuAvailable, normalizeSku, productVariants } from './catalog.js';
import { movement, audit } from './commerce-store.js';

export const skuImage = value => typeof value === 'string' && value.length <= 2000 && (value === '' || /^\/(?!\/)[\w./-]+$/.test(value) || /^https:\/\/[^\s]+$/.test(value));
const fail = (message, status=400) => { throw Object.assign(Error(message), {status}); };
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const money = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e9;

// Called inside the product write transaction: one invalid row rolls back the
// product, all SKU rows, stock transfers and audit together.
export function saveSkuOptions(db, productId, rows, actor, {creating=false}={}) {
  if (!Array.isArray(rows) || !rows.length || rows.length>50) fail('Sản phẩm cần từ 1–50 SKU.');
  const product=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if(creating&&product.stock!==0)fail('Nhập tồn ban đầu theo từng SKU, không nhập tồn gộp cho sản phẩm.');
  const existing=productVariants(db,productId), byId=new Map(existing.map(v=>[v.id,v]));
  const ids=rows.filter(row=>row?.id!==undefined).map(row=>row.id);
  if (new Set(ids).size!==ids.length || existing.length!==ids.length || ids.some(id=>!byId.has(id))) fail('Danh sách SKU đã thay đổi. Tải lại sản phẩm trước khi lưu.',409);
  const converting=!creating&&!existing.length;
  if (converting && (rows.length<2 || rows[0]?.base!==true || rows.slice(1).some(row=>row?.base))) fail('Giữ SKU hiện tại khi thêm màu mới.');
  const seen=new Set();
  const normalized=rows.map(row=>{
    if (!record(row)) fail('Thông tin SKU không hợp lệ.');
    const old=byId.get(row.id);
    const allowed=['id','revision','base','sku','label','price','image','active',...(!old&&!row.base?['stock']:[])];
    if (Object.keys(row).some(key=>!allowed.includes(key)) || (row.base!==undefined&&row.base!==true) || (row.base&&!converting)) fail('Không gửi tồn kho cũ khi sửa SKU. Điều chỉnh tại Kho & biến thể.');
    if (old) assertRevision(row.revision,old.revision);
    const sku=normalizeSku(row.sku),image=row.base?(row.image||product.image):row.image;
    if (!sku || sku.length>100 || typeof row.label!=='string' || !row.label.trim() || row.label.length>200 || !money(row.price) || !skuImage(image) || ![0,1].includes(row.active)) fail('Mỗi SKU cần mã, tên màu/phiên bản, giá, ảnh hợp lệ và trạng thái.');
    if (!image && (!old || old.image)) fail('Mỗi SKU mới cần một ảnh mô tả.');
    if (seen.has(sku)) fail('Các SKU trong cùng sản phẩm không được trùng nhau.',409); seen.add(sku);
    if (!old&&!row.base&&(!Number.isSafeInteger(row.stock)||row.stock<0||row.stock>1e6)) fail('Tồn ban đầu của SKU không hợp lệ.');
    return {...row,sku,label:row.label.trim(),image,old};
  });
  // Remove the old parent SKU reservation only when its live stock becomes the
  // first concrete variant. Historical base-SKU order lines keep their snapshot.
  if (!existing.length) {
    const details=JSON.parse(product.details);details.sku='';
    db.prepare('UPDATE products SET details=? WHERE id=?').run(JSON.stringify(details),productId);
  }
  for (const row of normalized) assertSkuAvailable(db,row.sku,{productId,variantId:row.old?.id||0});
  let baseVariant;
  for (const row of normalized) {
    if (row.old) {
      db.prepare('UPDATE product_variants SET sku=?,label=?,price=?,image=?,active=? WHERE id=?').run(row.sku,row.label,row.price,row.image,row.active,row.id);
      audit(db,actor,'variant_updated',row.id,JSON.stringify({before:{sku:row.old.sku,label:row.old.label,price:row.old.price,active:row.old.active,image:row.old.image},after:{sku:row.sku,label:row.label,price:row.price,active:row.active,image:row.image}}));
    } else {
      const stock=row.base?product.stock:row.stock;
      const id=Number(db.prepare('INSERT INTO product_variants(product_id,sku,label,price,stock,image,active) VALUES(?,?,?,?,?,?,?)').run(productId,row.sku,row.label,row.price,stock,row.image,row.active).lastInsertRowid);
      movement(db,productId,id,stock,row.base?'sku_conversion':'variant_created',null,actor);
      audit(db,actor,'variant_created',id,JSON.stringify({after:{sku:row.sku,label:row.label,price:row.price,stock,image:row.image,active:row.active}}));
      if (row.base) baseVariant=id;
    }
  }
  if (baseVariant) {
    movement(db,productId,null,-product.stock,'sku_conversion',null,actor);
    db.prepare('UPDATE products SET stock=0,legacy_variant_id=? WHERE id=?').run(baseVariant,productId);
  }
}
