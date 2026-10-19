import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { sampleCatalog, legacySamples } from './sample-catalog.js';
import { defaultNavigation } from './navigation.js';

// Stable keys let the admin change storefront copy while retaining saved wording.
const storefrontCopy = [
 'Theo dõi đơn hàng', 'Góc cảm hứng', 'Khám phá cửa hàng', 'Hỗ trợ đơn hàng',
 'Phương thức thanh toán', 'Chuyển khoản', 'Mọi quyền được bảo lưu.', 'Mẫu tham khảo',
 'CẢM HỨNG SỐNG', 'Đọc tiếp', 'Tìm điều bạn yêu thích', 'Trang chủ', 'Khoảng giá',
 'Tất cả mức giá', 'Dưới 200.000đ', '200.000đ – 500.000đ', 'Trên 500.000đ',
 'Sắp xếp', 'Mới nhất', 'Giá tăng dần', 'Giá giảm dần', 'Tên A – Z', 'sản phẩm', 'cho',
 'Xóa tìm kiếm', 'Xóa bộ lọc', 'Không tìm thấy sản phẩm', 'Mã sản phẩm',
 'Sản phẩm mẫu — hình ảnh, thông số và giá dùng để tham khảo giao diện.',
 'Còn hàng', 'Giao hàng tiêu chuẩn', 'Miễn phí vận chuyển từ', 'TÌM HIỂU SẢN PHẨM',
 'Chi tiết sản phẩm', 'Sử dụng & bảo quản', 'Thông số sản phẩm', 'Thông số đang được cập nhật.',
 'Xem thêm', 'Có thể bạn cũng thích', 'Chất liệu', 'Kích thước', 'Dung tích', 'Màu sắc',
 'Khám phá những lựa chọn dành cho ngôi nhà của bạn.', 'Số lượng', 'Vui lòng xóa khỏi giỏ',
 'Sản phẩm không còn bán', 'Tiếp tục mua sắm', 'để đặt hàng',
 'Một tài khoản.\nThêm nhiều tiện ích.',
 'Đăng nhập để đặt hàng và theo dõi hành trình những món đồ bạn yêu thích.',
 'Đơn', 'Nội dung chuyển khoản', 'Cửa hàng xác nhận thanh toán sau khi đối soát ngân hàng.',
 'TÀI KHOẢN CỦA BẠN',
];

export const defaultEditorial = {
 collectionEyebrow: 'MỖI KHÔNG GIAN, MỘT CẢM HỨNG',
 featuredEyebrow: 'NHỮNG LỰA CHỌN CÓ CHỦ ĐÍCH',
 featuredTitle: 'Điều nhỏ bé.\nNiềm vui mỗi ngày.',
 featuredText: 'Một chiếc bình yêu thích, một góc bếp ngăn nắp hay khoảng sáng bên trang sách. Khám phá những món đồ phù hợp với nhịp sống của bạn.',
 featuredButton: 'Khám phá bộ sưu tập',
 catalogEyebrow: 'BỘ SƯU TẬP SUPER NET',
 catalogText: 'Từ căn bếp đến góc làm việc, tìm những lựa chọn thiết thực để chăm chút không gian sống.',
 categoryImages: [
  { category: 'Nhà bếp', image: '/images/products/noi-inox-harmony.webp', caption: 'Cảm hứng từ những bữa cơm nhà' },
  { category: 'Đồ gia dụng', image: '/images/products/den-ban-minimal.webp', caption: 'Chăm chút từng góc nhỏ' },
  { category: 'Phong cách sống', image: '/images/products/binh-giu-nhiet-everyday.webp', caption: 'Đồng hành cùng nhịp sống của bạn' },
 ],
 story: {
  eyebrow: 'CÂU CHUYỆN SUPER NET', title: 'Nhà là nơi\nnhững điều tốt đẹp bắt đầu.',
  text: 'Chúng tôi tin sự tiện nghi đến từ những lựa chọn giản dị và phù hợp. Super Net gợi mở cách sắp xếp, chuẩn bị và chăm sóc không gian để mỗi ngày ở nhà thêm dễ chịu.',
  image: '/images/scene-kitchen.webp', button: 'Tìm cảm hứng cho ngôi nhà',
 },
 journal: {
  eyebrow: 'GÓC CẢM HỨNG', title: 'Chậm lại một chút. Sống trọn hơn.',
  text: 'Những gợi ý nhỏ để chăm chút căn bếp, không gian sống và thói quen hằng ngày.',
  articles: [
   { title: 'Một căn bếp gọn bắt đầu từ ngăn tủ', excerpt: 'Sắp xếp theo thói quen sử dụng để việc nấu ăn nhẹ nhàng hơn.', image: '/images/scene-kitchen.webp', body: 'Bắt đầu bằng việc lấy đồ ra khỏi một ngăn tủ nhỏ. Nhóm dụng cụ theo công việc: sơ chế, nấu và bảo quản. Đặt món dùng thường xuyên ở vị trí dễ lấy, dành phần sâu hơn cho món ít dùng. Với thực phẩm khô, hãy ghi tên và ngày mở gói trên nhãn riêng. Không cần thay toàn bộ đồ dùng để có một căn bếp dễ chịu; một khu vực được sắp xếp phù hợp đã tạo ra khác biệt.' },
   { title: 'Dành một góc nhỏ cho khoảng nghỉ', excerpt: 'Ánh sáng, một chiếc cốc và vài phút dành riêng cho bạn.', image: '/images/scene-living.webp', body: 'Chọn một góc bàn ít đồ, gần nguồn sáng dễ chịu. Đặt một chiếc đèn phù hợp với công việc và giữ mặt bàn vừa đủ trống cho cuốn sách hoặc tách trà. Thử để điện thoại xa tầm tay trong vài phút. Không gian nhỏ này có thể trở thành lời nhắc nhẹ nhàng để bạn nghỉ mắt, uống nước và quay lại công việc với tâm trạng thoải mái hơn.' },
   { title: 'Chuẩn bị bữa trưa theo nhịp sống của bạn', excerpt: 'Lên thực đơn đơn giản, chia phần vừa đủ và chọn hộp phù hợp.', image: '/images/scene-kitchen.webp', body: 'Chọn vài món quen thuộc và chuẩn bị nguyên liệu theo từng bữa. Dùng hộp phù hợp với thực phẩm, để nguội trước khi đóng nắp và cất lạnh sớm theo hướng dẫn an toàn thực phẩm. Khi mang đi, chú ý thời gian và nhiệt độ bảo quản; túi giữ nhiệt không thay thế tủ lạnh. Một bữa trưa vừa đủ, được chuẩn bị gọn gàng có thể giúp ngày làm việc thuận tiện hơn.' },
  ],
 },
 serviceTitle: 'An tâm từ lựa chọn đến trải nghiệm',
 footerHeading: 'Kết nối tiện nghi.\nChăm chút cuộc sống.',
 footerText: 'Khám phá những món đồ thiết thực và cảm hứng dành cho không gian của bạn.',
};

export function readProduct(row) {
 if (!row) return row;
 let details;
 try { details = JSON.parse(row.details || '{}'); } catch { details = {}; }
 return { ...row, details };
}

// This permanent ledger records processed demo SKUs, including products later deleted.
// Rerunning the command must never recreate a deleted sample or overwrite an edit.
export function seedDemoCatalog(db) {
 const report = { added: 0, enriched: 0, preserved: 0, skipped: 0 };
 db.exec('BEGIN IMMEDIATE');
 try {
  const categories = JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value).categories;
  const rows = db.prepare('SELECT * FROM products').all().map(readProduct);
  const seen = db.prepare('SELECT sku FROM demo_catalog_seed WHERE sku=?');
  const remember = db.prepare('INSERT INTO demo_catalog_seed(sku,product_id) VALUES(?,?)');
  const insert = db.prepare('INSERT INTO products(name,category,description,price,stock,image,active,details) VALUES(?,?,?,?,?,?,?,?)');
  for (const [index, sample] of sampleCatalog.entries()) {
   const sku = sample.details.sku;
   if (seen.get(sku)) { report.skipped++; continue; }
   const existingSku = rows.find(row => row.details?.sku === sku);
   if (existingSku) { remember.run(sku, existingSku.id); report.preserved++; continue; }
   const legacy = legacySamples[index];
   const original = legacy && rows.find(row => row.name === legacy[0] || row.image === legacy[5]);
   if (original) {
    const keys = ['name', 'category', 'description', 'price', 'stock', 'image'];
    const unchanged = keys.every((key, i) => original[key] === legacy[i]) && original.active === 1 && Object.keys(original.details).length === 0;
    if (unchanged) {
     db.prepare('UPDATE products SET description=?,image=?,details=? WHERE id=?').run(sample.description, sample.image, JSON.stringify(sample.details), original.id);
     report.enriched++;
    } else { report.preserved++; }
    remember.run(sku, original.id);
    continue;
   }
   // An existing shop can have its own categories. Leave those settings untouched.
   if (!categories.includes(sample.category)) { report.skipped++; continue; }
   const result = insert.run(sample.name, sample.category, sample.description, sample.price, sample.stock, sample.image, sample.active, JSON.stringify(sample.details));
   remember.run(sku, result.lastInsertRowid);
   report.added++;
  }
  db.exec('COMMIT');
  return report;
 } catch (error) {
  db.exec('ROLLBACK');
  throw error;
 }
}
export function hashPassword(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function checkPassword(password, hash) { try {const [salt,key]=hash.split(':'); return timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64));}catch{return false;} }
export function openStore(dir=process.env.DATA_DIR || './data') {
 mkdirSync(dir,{recursive:true,mode:0o700}); const db=new DatabaseSync(path.join(dir,'store.sqlite')); db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer');
 CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,actor_id INTEGER REFERENCES users(id),action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,details TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),image TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,details TEXT NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS demo_catalog_seed(sku TEXT PRIMARY KEY,product_id INTEGER);
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL,status TEXT NOT NULL,total INTEGER NOT NULL,shipping INTEGER NOT NULL,payment TEXT NOT NULL,recipient TEXT NOT NULL,address TEXT NOT NULL,phone TEXT NOT NULL,items TEXT NOT NULL,bank TEXT NOT NULL);
 `);
 if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
 if (!db.prepare('PRAGMA table_info(settings)').all().some(column => column.name === 'revision')) db.exec('ALTER TABLE settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
 if (!db.prepare('PRAGMA table_info(products)').all().some(column => column.name === 'details')) db.exec("ALTER TABLE products ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
 const settings={ui:{'Thông tin & chính sách':'Thông tin & chính sách','Liên hệ':'Liên hệ','Thông tin đặt hàng':'Thông tin đặt hàng','Giá và tồn kho sẽ được máy chủ kiểm tra khi đặt hàng.':'Giá và tồn kho sẽ được máy chủ kiểm tra khi đặt hàng.','Tạm tính':'Tạm tính','Phí giao hàng':'Phí giao hàng','Tổng cộng':'Tổng cộng','Người nhận':'Người nhận','Số điện thoại':'Số điện thoại','Địa chỉ giao hàng':'Địa chỉ giao hàng','Thanh toán':'Thanh toán','Họ tên':'Họ tên','Email':'Email','Mật khẩu':'Mật khẩu','Mật khẩu từ 12 ký tự. Không sử dụng mật khẩu của dịch vụ khác.':'Mật khẩu từ 12 ký tự. Không sử dụng mật khẩu của dịch vụ khác.','Chưa có đơn hàng.':'Chưa có đơn hàng.','Không tìm thấy sản phẩm phù hợp.':'Không tìm thấy sản phẩm phù hợp.','MoMo / ZaloPay chưa được kích hoạt.':'MoMo / ZaloPay chưa được kích hoạt.','Chờ xác nhận':'Chờ xác nhận','Đã xác nhận':'Đã xác nhận','Đang giao':'Đang giao','Hoàn tất':'Hoàn tất','Đã hủy':'Đã hủy'},brand:'Super Net',tagline:'Kết nối tiện nghi, nâng tầm cuộc sống',announcement:'Miễn phí giao hàng cho đơn từ 500.000đ',heroEyebrow:'SỐNG TIỆN NGHI CÙNG SUPER NET',heroTitle:'Chọn điều hay.\nSống mỗi ngày tốt hơn.',heroText:'Khám phá những lựa chọn thiết thực cho ngôi nhà và cuộc sống của bạn.',heroButton:'Khám phá sản phẩm',collectionTitle:'Tiện nghi cho mọi không gian',collectionText:'Những món đồ nhỏ, mang đến thay đổi lớn.',productsTitle:'Lựa chọn dành cho bạn',searchPlaceholder:'Bạn đang tìm sản phẩm gì?',logo:'/logo.png',heroImage:'',categories:['Nhà bếp','Đồ gia dụng','Phong cách sống'],shippingFee:30000,freeShipping:500000,bankName:'',bankAccount:'',bankHolder:'',phone:'',email:'',address:'',footerText:'Super Net — Đồng hành cùng cuộc sống tiện nghi.',benefits:['Lựa chọn thiết thực','Thông tin minh bạch','Hỗ trợ tận tâm'],policies:[{title:'Giao hàng',body:'Phí giao hàng tiêu chuẩn 30.000đ, miễn phí cho đơn từ 500.000đ. Cửa hàng xác nhận thời gian giao hàng trước khi gửi.'},{title:'Đổi trả',body:'Vui lòng liên hệ cửa hàng để xác nhận điều kiện đổi trả trước khi đặt hàng.'},{title:'Quyền riêng tư',body:'Thông tin liên hệ được sử dụng để xử lý tài khoản và đơn hàng. Liên hệ cửa hàng để yêu cầu hỗ trợ dữ liệu cá nhân.'}],labels:{products:'Sản phẩm',all:'Tất cả',account:'Tài khoản',cart:'Giỏ hàng',add:'Thêm vào giỏ',buy:'Đặt hàng',login:'Đăng nhập',register:'Đăng ký',orders:'Đơn hàng của tôi',logout:'Đăng xuất',admin:'Quản trị',empty:'Chưa có sản phẩm trong giỏ',cod:'Thanh toán khi nhận hàng (COD)',bank:'Chuyển khoản ngân hàng',outOfStock:'Hết hàng',details:'Chi tiết sản phẩm'},colors:{navy:'#004766',blue:'#44a6c8',green:'#98bf64'}};
 for (const text of storefrontCopy) if (!Object.hasOwn(settings.ui, text)) settings.ui[text] = text;
 settings.editorial = defaultEditorial;
 settings.navigation = defaultNavigation;
 const initialized=db.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(1,?)').run(JSON.stringify(settings));
 const existing=JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
 let changed=false;
 if(!existing.ui){existing.ui=settings.ui;changed=true;}
 for (const [key,value] of Object.entries(settings.ui)) {
  if (!Object.hasOwn(existing.ui,key)) { existing.ui[key]=value; changed=true; }
 }
 if(!Object.hasOwn(existing,'editorial')){existing.editorial=defaultEditorial;changed=true;}
 if(!Object.hasOwn(existing,'navigation')){existing.navigation=defaultNavigation;changed=true;}
 if(changed)db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(existing));
 if(initialized.changes && db.prepare('SELECT COUNT(*) AS count FROM products').get().count===0) seedDemoCatalog(db);
 return db;
}
