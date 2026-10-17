import { openStore, seedDemoCatalog } from '../store.js';

const db = openStore();
try {
  const result = seedDemoCatalog(db);
  console.log(`Dữ liệu mẫu: thêm ${result.added}, bổ sung ${result.enriched}, giữ nguyên ${result.preserved}, bỏ qua ${result.skipped}.`);
  console.log('Không ghi đè sản phẩm đã sửa. Mẫu đã xóa sau lần nhập bằng công cụ này không được thêm lại. Giá, tồn kho, tài khoản, đơn hàng và cấu hình hiện có được giữ nguyên.');
} finally {
  db.close();
}
