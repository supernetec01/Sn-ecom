import { commerceSettings } from './commerce-store.js';

// Report configuration presence and data counts. Never return credentials or claim
// that a provider/worker was contacted by this read-only endpoint.
export function systemStatus(db, env = process.env) {
  const settings = JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  const commerce = commerceSettings(db);
  const count = (table, where = '1=1') => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get().n;
  const features = [];
  const add = (id, label, state, description, nextStep, target) => features.push({ id, label, state, description, nextStep, target });
  const staff = count('users', "role NOT IN ('customer','guest') AND disabled=0");
  add('staff', 'Tài khoản nhân viên', 'available', `${staff} tài khoản nhân viên hoạt động. Admin cấp tài khoản, vai trò, khóa và đặt lại mật khẩu.`, 'Tạo tài khoản cho từng nhân viên. Mật khẩu do admin cấp phải được đổi trước khi làm việc.', 'users');
  const products = count('products', 'active=1');
  add('catalog', 'Danh mục & sản phẩm', products ? 'available' : 'empty', `${products} sản phẩm đang hiển thị. Giá, tồn, ảnh và biến thể được lưu trên máy chủ.`, 'Thêm sản phẩm, chọn danh mục và bật trạng thái Đang bán. Kiểm tra và thay dữ liệu mẫu trước khi bán thật.', 'products');
  const orders = count('orders');
  add('orders', 'Đơn hàng & thu/hoàn tiền', orders ? 'available' : 'empty', `${orders} đơn hàng. Trạng thái xử lý và trạng thái thanh toán được theo dõi riêng.`, 'Đơn xuất hiện sau khi khách đặt hàng. Mở mã đơn để xác nhận, ghi nhận tiền và vận đơn; xác minh tiền thực tế trước khi ghi nhận.', 'orders');
  const coupons = count('coupons');
  add('coupons', 'Mã giảm giá', coupons ? 'available' : 'empty', `${coupons} mã đã tạo. Trang Khuyến mãi giới thiệu chiến dịch; mã giảm giá được áp dụng ở giỏ hàng.`, 'Tạo mã, thời hạn, hạn mức và sản phẩm áp dụng. Nội dung quảng bá sửa ở Nội dung website → Menu & các trang.', 'coupons');
  const reviews = count('reviews');
  add('reviews', 'Đánh giá người mua', reviews ? 'available' : 'empty', `${reviews} đánh giá. Chỉ người đã nhận sản phẩm được gửi; cửa hàng duyệt trước khi công khai.`, 'Bảng trống khi chưa có đánh giá thật. Không tạo đánh giá hoặc điểm số giả để lấp chỗ trống.', 'reviews');
  const returns = count('return_requests');
  add('returns', 'Đổi trả', returns ? 'available' : 'empty', `${returns} yêu cầu đổi trả. Xử lý cả đơn; chưa hỗ trợ đổi trả từng phần.`, 'Khách gửi yêu cầu từ đơn đã hoàn tất. Duyệt, nhận hàng, kiểm tra hoàn tiền và chọn nhập lại kho nếu còn bán được.', 'returns');
  const bank = Boolean(settings.bankName && settings.bankAccount && settings.bankHolder);
  add('bank', 'COD & chuyển khoản', bank ? 'available' : 'needs_configuration', bank ? 'COD và nhận chuyển khoản đã có thông tin cấu hình.' : 'COD hoạt động. Chuyển khoản chỉ bật khi đủ ba trường nhận tiền.', 'Điền ngân hàng, số tài khoản và chủ tài khoản. Đối soát chuyển khoản thủ công trong chi tiết đơn.', 'sales');
  const email = Boolean(env.EMAIL_API_KEY && env.EMAIL_FROM && env.APP_ORIGIN);
  add('email', 'Email xác minh, khôi phục & thông báo', email ? 'configured' : 'needs_configuration', `${email ? 'Đã có cấu hình gửi email.' : 'Chưa đủ cấu hình gửi email.'} ${count('notification_outbox', "status='queued'")} thư đang chờ, ${count('notification_outbox', "status='failed'")} thư lỗi.`, 'Cấu hình dịch vụ Resend và địa chỉ gửi đã xác minh trên máy chủ; chạy tác vụ hàng đợi. Có cấu hình chưa có nghĩa là email đã gửi thành công.', 'outbox');
  const vnpay = Boolean(env.VNPAY_TMN_CODE && env.VNPAY_HASH_SECRET && env.APP_ORIGIN);
  add('vnpay', 'Thanh toán VNPay', vnpay ? 'configured' : 'needs_configuration', vnpay ? `Đã có cấu hình ${env.VNPAY_LIVE === 'true' ? 'production' : 'sandbox'}. Chưa xác nhận giao dịch thật qua trang này.` : 'Luồng thanh toán và kiểm tra chữ ký callback đã có; phương thức ẩn khi thiếu thông tin merchant.', 'Đăng ký merchant, cấu hình phía máy chủ và kiểm tra giao dịch sandbox/callback trước khi mở bán.', 'sales');
  add('wallets', 'MoMo & ZaloPay', 'not_implemented', 'Chưa có bộ kết nối merchant, tạo giao dịch và xác minh callback cho hai ví.', 'Cần tài khoản merchant và triển khai từng nhà cung cấp; hiện dùng COD, chuyển khoản hoặc VNPay đã cấu hình.', 'sales');
  add('rewards', 'Điểm thành viên Rewards', commerce.rewardsEnabled ? 'available' : 'disabled', commerce.rewardsEnabled ? 'Đã bật tích điểm theo đơn hoàn tất và đã thu đủ tiền; hỗ trợ đổi điểm ở giỏ hàng.' : 'Cơ chế tích/đổi điểm đã có; cửa hàng đang tắt chương trình.', 'Thiết lập tỷ lệ và bật chương trình ở Quy tắc bán hàng. Cập nhật trang giới thiệu Rewards và điều kiện áp dụng trước khi công bố.', 'commerce');
  add('pages', 'Sự kiện, Cửa hàng & Nhượng quyền', 'content_only', 'Đây là các trang thông tin có thể biên tập; chưa có đăng ký sự kiện, quản lý chi nhánh hoặc quy trình hồ sơ nhượng quyền.', 'Điền nội dung thực trong Menu & các trang, hoặc ẩn tab chưa sử dụng. Quy trình đăng ký/duyệt cần được phát triển thành module riêng.', 'content');
  const ai = Boolean(env.AI_API_KEY && env.AI_MODEL);
  add('assistant', 'Trợ lý tư vấn sản phẩm', ai ? 'configured' : 'fallback', ai ? 'Đã có cấu hình mô hình AI; việc kết nối thực tế chưa được kiểm tra ở đây.' : 'Đang dùng tra cứu danh mục, vẫn hoạt động mà không cần AI trả phí.', 'Có thể tiếp tục dùng tra cứu danh mục. Muốn dùng AI, cấu hình nhà cung cấp trên máy chủ và kiểm soát ngân sách.', 'system');
  add('translation', 'Tiếng Việt / English / 繁體中文', env.TRANSLATION_API_KEY ? 'configured' : 'fallback', 'Nhãn giao diện có bản dịch đi kèm. Dịch nội dung sản phẩm động cần dịch vụ dịch; thiếu khóa sẽ giữ nội dung gốc.', 'Bộ chọn ngôn ngữ dùng được ngay. Cấu hình Google Cloud Translation nếu cần dịch nội dung công khai mới nhập.', 'system');
  add('shipping', 'Phí giao & vận đơn', 'manual', 'Có phí mặc định/theo vùng, chọn tỉnh/phường và lưu vận đơn. Chưa tự gọi hãng vận chuyển lấy giá hoặc tạo đơn giao.', 'Thiết lập phí, nhập hãng/mã vận đơn trong đơn hàng. Tích hợp hãng vận chuyển cần hợp đồng và API riêng.', 'sales');
  add('backup', 'Sao lưu dữ liệu', 'manual', 'Đã có lệnh sao lưu SQLite và uploads. Trang này không xác nhận máy chủ đã đặt lịch hoặc thử khôi phục.', 'Đặt lịch chạy tác vụ sao lưu và thử khôi phục định kỳ theo hướng dẫn vận hành; không xóa dữ liệu để cập nhật website.', 'system');
  return { features, providerConnectionsChecked: false };
}
