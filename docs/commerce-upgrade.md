# Super Net: vận hành bản nâng cấp

Đây là bản triển khai phát triển với kiểm thử local, chưa phải xác nhận đủ điều kiện mở bán hoặc tích hợp merchant đã được nhà cung cấp chấp thuận. Dữ liệu mẫu vẫn cần thay bằng thông tin thật. Không triển khai/push tự động trong tác vụ nâng cấp.

## Cài đặt và kiểm thử

Node 24 trở lên. Dùng checkout hiện có, không cần Git worktree:

```sh
cd /workspace/Sn-ecom
npm ci
npm test
# Nếu dùng Chromium có sẵn trên Linux:
BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser
# Hoặc cài trình duyệt của Playwright trên máy phát triển:
npx playwright install chromium
npm run test:browser
npm start
```

Bộ browser smoke tự tạo DB tạm và tài khoản ngẫu nhiên, không dùng cửa hàng thật và không gọi mô hình AI. Trên Windows không cần biến BROWSER_EXECUTABLE nếu đã cài Chromium của Playwright. Các test HTTP dùng DB tạm; upload cũng nằm trong thư mục DB tạm.

## Các khu vực mới

- Tài khoản → Hồ sơ & bảo mật (`#profile`): địa chỉ, đổi mật khẩu, xác minh email, MFA bằng ứng dụng Authenticator và thu hồi phiên khác. Quên mật khẩu ở trang đăng nhập. Khi bật MFA, lưu tám mã khôi phục được hiển thị một lần; mỗi mã dùng một lần, chỉ lưu hash trong DB. Không có chức năng admin bỏ qua MFA qua web.
- Checkout không cần tài khoản: email, điện thoại, địa chỉ; lưu mã tra cứu riêng trong sessionStorage của tab. Khách cần tự giữ mã để tra cứu ở thiết bị khác. `#order/0` cho nhập số đơn + mã riêng; không dùng số điện thoại làm mật khẩu tra đơn. Tài khoản đăng nhập chỉ xem đơn của mình.
- Trang đơn riêng: tổng tiền, thanh toán, lịch sử, vận đơn, hủy đơn chưa giao/chưa thu tiền, yêu cầu đổi trả sau hoàn tất, mua lại với giá/tồn hiện tại. Tạo đơn giữ snapshot tên/giá/SKU/biến thể; retry cùng checkout trả đơn cũ.
- Trang quản trị thống nhất `#admin` (tương thích `#manage`): tổng quan, đối soát thu/hoàn, vận đơn, kho, biến thể, mã giảm giá, đánh giá, đổi trả, quy tắc, nhân sự, nhật ký và email. Nội dung và sản phẩm nằm cùng thanh bên; xem [hướng dẫn admin và quyền hiện tại](admin-guide.md).
- `#wishlist`, `#support`: yêu thích và trợ lý mua hàng. Trợ lý không có khóa AI sẽ ghi rõ là tra cứu danh mục. Cần đăng nhập để dùng chat; tối đa 20 yêu cầu/IP/giờ và ngân sách lượt toàn cửa hàng/ngày, mặc định 200. Chỉ gửi dữ liệu sản phẩm/chính sách cần thiết vào mô hình; không cấp công cụ sửa đơn/hoàn tiền. Phản hồi AI có thể sai và chưa thay thế nhân viên.
- Danh mục truy vấn/lọc/phân trang phía máy chủ, tìm kiếm không dấu. Sản phẩm có URL `/san-pham/<id>-<ten>`, HTML nội dung sản phẩm từ máy chủ, canonical, Open Graph, Product JSON-LD, sitemap và robots. Không tạo đánh giá hoặc doanh số giả.

## Quy tắc tiền, kho và điểm

- Trạng thái xử lý đơn và thanh toán tách biệt. Đơn cũ chưa có chứng cứ thu tiền được giữ `unpaid`; không suy luận từ `completed`.
- Đối soát thủ công yêu cầu mã giao dịch duy nhất. Nhập lại cùng mã/nội dung trả kết quả cũ. Chức năng này chỉ ghi nhận, không tự chuyển tiền ngân hàng hoặc tự thực hiện hoàn qua VNPay. Xác minh tiền thật trước khi ghi nhận.
- Báo cáo đã thu/đã hoàn/thu ròng dựa trên ledger giao dịch, không cộng mọi đơn vào doanh thu đã thu.
- Đặt đơn trừ kho trong transaction; hủy đủ điều kiện hoàn một lần. `holdHours` mặc định 24 giờ, chỉ tự hết hạn đơn `pending` chưa thu tiền. Xác nhận đơn hoặc ghi nhận tiền sẽ dừng thời hạn. Chạy máy chủ bằng npm start có bộ quét mỗi phút; có lệnh bảo trì riêng.
- Không tự hủy đơn đã thu tiền. Hoàn tiền đã thu trước, sau đó hủy nếu chưa giao. Đơn đã giao dùng quy trình đổi trả.
- Đổi trả: requested → approved/rejected → received → closed. Khi nhận hàng, nhân viên chọn có nhập lại kho hay không; chỉ nhập hàng còn bán được, không nhập lại hai lần. Đóng sau khi không còn tiền cần hoàn. Hiện xử lý đổi trả cả đơn; đổi trả từng phần/đổi sang hàng khác chưa có quy trình riêng.
- Một mã giảm giá/đơn, theo thời hạn, giá trị tối thiểu, mức giảm tối đa, tổng lượt, lượt theo tài khoản và phạm vi sản phẩm. Mã giới hạn riêng từng tài khoản yêu cầu đăng nhập, tránh lách qua email khách vãng lai. Hủy đơn giải phóng lượt. Mã và điểm có thể dùng cùng nhau: giảm mã trước, đổi điểm sau; ngưỡng miễn phí giao tính sau mã, trước điểm.
- Rewards mặc định **tắt** để tránh tự công bố chương trình. Khi bật: mỗi 10.000đ tiền hàng thực trả được 1 điểm sau khi hoàn tất và thu đủ, 1 điểm đổi 1.000đ ở đơn sau; cấu hình được trong Quy tắc. Số tiền/số điểm quy đổi mặc định chỉ là chính sách phát triển, chủ cửa hàng phải xét chi phí trước khi bật. Cần thông báo nếu thay quy tắc. Hoàn tiền bất kỳ sẽ thu hồi toàn bộ điểm đã thưởng cho đơn đó; số dư có thể âm nếu đã dùng điểm. Hoàn toàn bộ/hủy trả lại điểm đã dùng đúng một lần. Chưa có hạng thành viên hoặc tự hết hạn điểm.
- Phí giao theo tên vùng cấu hình (tìm không dấu); không trùng vùng dùng phí mặc định. Chưa gọi API báo giá/tạo vận đơn hãng vận chuyển. Nhân viên nhập mã/link và trạng thái; cần cấu hình phí thật trước mở bán. Checkout và địa chỉ mới dùng danh mục tỉnh/thành → phường/xã/đặc khu Việt Nam được lưu kèm ứng dụng; xem [nguồn dữ liệu địa chỉ](vietnam-addresses.md). Dữ liệu được cập nhật có kiểm soát, không tự tải bản mới mỗi lần khách đặt hàng.

## Phân quyền

Admin toàn quyền; sales xử lý đơn/thu/hoàn/vận đơn/đổi trả/báo cáo; inventory quản lý sản phẩm/biến thể/kho/CSV; editor sửa sản phẩm/nội dung/đánh giá/mã giảm giá. Editor không đổi thông tin ngân hàng và phí giao. Admin cấp vai trò ở Nhân sự; đổi quyền thu hồi phiên cũ, không tự hạ quyền mình. Đây là các nhóm quyền cố định, không phải bộ tạo quyền tùy chỉnh.

Biến thể có SKU duy nhất, giá và tồn riêng; sản phẩm có biến thể bắt buộc khách chọn. Dữ liệu tên/mô tả vẫn ở sản phẩm cha. Nhập CSV sản phẩm không nhập biến thể. CSV tối đa 200 dòng/120 KB, xem trước rồi xác nhận; hỏng một dòng rollback cả lô. Cột id trống tạo mới, có id cập nhật. Xuất CSV tối đa 10.000 đơn mỗi lần. Ẩn sản phẩm/biến thể thay cho xóa vật lý để giữ liên kết và lịch sử. CSV escape công thức khi xuất.

## Email

Sao chép `.env.example` vào `.env` (đã ignore). Không đưa khóa vào chat hoặc Git. Node không tự đọc .env nếu không truyền `--env-file`; tương tự khi chạy worker:

```sh
node --env-file=.env server.js
node --env-file=.env scripts/process-outbox.js
```

Cần `EMAIL_API_KEY` của Resend, `EMAIL_FROM` đã xác minh và `APP_ORIGIN` đúng tên miền. Mạng cần cho phép `api.resend.com`. Không có cấu hình thì email nằm trong hàng đợi, chưa được gửi. Worker đọc tối đa 50/lượt, có timeout, retry, idempotency key và trạng thái failed sau năm lần; admin có thể xếp lại email failed. Chỉ chạy một worker cho mỗi DB, lên lịch khoảng một phút/lần. Nhà cung cấp có thời hạn lưu idempotency riêng; cần đối soát khi xử lý lại email rất cũ. Link reset 30 phút, xác minh 24 giờ, dùng một lần, hash lưu trong bảng token. Nội dung email chờ gửi chứa link để vận chuyển đến người nhận; bảo vệ DB và bản sao lưu.

## VNPay

Có adapter VNPay 2.1 với sandbox mặc định: tạo URL ký HMAC-SHA512, kiểm tra chữ ký/merchant/số tiền/order của IPN, ghi nhận giao dịch một lần. Trang return không đánh dấu thanh toán thành công. Cần merchant cung cấp `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `APP_ORIGIN` HTTPS và đăng ký IPN:

```
https://<ten-mien>/api/payments/vnpay/ipn
```

Return URL: `/thanh-toan`. Chỉ bật `VNPAY_LIVE=true` sau khi nhà cung cấp xác nhận và chạy đủ sandbox/end-to-end. Mạng/trình duyệt cần truy cập sandbox.vnpayment.vn (sandbox) hoặc pay.vnpay.vn (live); IPN phải đến được website qua HTTPS. Callback muộn cho đơn đã hủy/giải phóng kho cần nhân viên đối soát, không tự phục hồi đơn. Chưa kết nối MoMo/ZaloPay và chưa tự gọi API hoàn tiền của cổng.

Adapter mới được kiểm tra local bằng chữ ký kiểm thử; **chưa chạy giao dịch sandbox thật** vì chưa có tài khoản merchant. Tài liệu sandbox cũng bị chính sách mạng trả 403 trong môi trường này. Phải đối chiếu thông số với tài liệu merchant hiện hành và xác minh IPN thực tế trước bật thanh toán cho khách thật. Không dùng khóa ví dụ làm khóa merchant.

## AI

Cần `AI_API_KEY`, `AI_MODEL` mà tài khoản được phép dùng và truy cập HTTPS `api.openai.com`. API key chỉ ở máy chủ. Không có key thì dùng tìm kiếm danh mục, không giả nhận đã dùng AI. Có timeout, giới hạn độ dài đầu vào/context/đầu ra, hạn mức lượt; nếu mô hình lỗi thì dùng fallback. Lượt/ngày là giới hạn chi phí tương đối, không phải mức trần tiền chính xác; đặt giới hạn ngân sách ở nhà cung cấp. Chưa kiểm tra phản hồi mô hình thật khi chưa có khóa. Chat không tra cứu đơn bằng AI; khách dùng chức năng tra đơn đã xác thực. Có nút xóa hội thoại; bảo trì xóa dữ liệu chat sau 30 ngày. Chưa tích hợp hệ thống ticket/livechat cho nhân viên, dùng thông tin liên hệ cửa hàng để chuyển hỗ trợ.

## Sao lưu, bảo trì, triển khai

```sh
npm run backup -- /duong-dan-ben-ngoai-data
npm run maintenance
```

Backup dùng SQLite backup API và copy uploads (ảnh mới được giải mã, giới hạn 25 triệu pixels, giảm kích thước tối đa 2400px, mã hóa WebP). Chạy backup định kỳ, copy ra nơi lưu độc lập, bảo vệ quyền truy cập và kiểm tra phục hồi. Không copy riêng SQLite đang WAL. Lệnh tạo backup là công cụ; lịch sao lưu/offsite cần cấu hình trên máy triển khai. Chưa tự xóa ảnh không dùng để tránh xóa nhầm nội dung đang tham chiếu.

Phục hồi: dừng máy chủ/worker, giữ bản hiện tại ở vị trí khác, đưa `store.sqlite` và `uploads/` từ cùng bản backup vào DATA_DIR mới, kiểm tra quyền file, chạy `PRAGMA integrity_check`, đặt DATA_DIR trỏ bản khôi phục rồi khởi động và smoke-test. Không trộn file WAL/SHM cũ với DB khôi phục.

Dùng một instance Node với ổ dữ liệu bền vững; hosting chỉ có filesystem tạm/serverless không phù hợp DB SQLite này. Không bắt buộc chuyển PostgreSQL/Supabase; nếu cần nhiều instance phải có dự án migration và kiểm thử riêng. Chạy production qua reverse proxy HTTPS và đặt NODE_ENV=production, APP_ORIGIN chính xác. Có `/healthz` cho kiểm tra tiến trình/DB cơ bản; cần dịch vụ giám sát bên ngoài, log và quy trình cảnh báo khi triển khai. Rate limit mặc định dùng IP kết nối trực tiếp; cấu hình trusted proxy phải theo hạ tầng thật, không tin tùy ý X-Forwarded-For.

Analytics nội bộ lưu loại sự kiện/sản phẩm/thời điểm, không lưu tên, email, IP hay định danh khách; số lượt có thể bị chặn hoặc trùng, không phải số người duy nhất. Không thay thế thống kê tài chính từ ledger. Kiểm tra nghĩa vụ thông báo quyền riêng tư, lưu trữ, chính sách đổi trả và kinh doanh áp dụng cho cửa hàng trước mở bán.
