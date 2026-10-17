# Super Net — storefront & administration

Ứng dụng thương mại điện tử bằng Node.js 24, Express và SQLite. Đây là bản phát triển chạy được, **chưa phải bản đã kiểm toán hoặc sẵn sàng mở bán công khai**.

## Chạy ứng dụng

```sh
cd /workspace/Sn-ecom
npm ci
npm test
npm start
```

Mặc định cổng 3000. Tạo quản trị viên bằng `npm run admin` trong terminal tương tác: email và mật khẩu từ 12 ký tự; mật khẩu không hiển thị khi nhập. Không có tài khoản admin hoặc mật khẩu mặc định. Đăng nhập ở mục Tài khoản, sau đó mở mục Quản trị trên thanh điều hướng (route `#admin`).

Các tác vụ đã ở môi trường tách biệt: dùng checkout hiện có, không cần tạo Git worktree.

## Nội dung quản trị

- Sản phẩm: thêm/sửa/xóa/ẩn, giá, tồn kho, danh mục, mô tả, đường dẫn ảnh hoặc tải PNG/JPEG/WebP lên (5 MB).
- Nội dung & cài đặt: logo, ảnh banner, màu sắc, tiêu đề, mô tả, nút, danh mục, cam kết, thông tin liên hệ, chính sách, nhãn và nội dung giao diện. Chính sách và từ điển nhãn hiện chỉnh bằng JSON có kiểm tra trên máy chủ; văn bản không thực thi HTML.
- Giao hàng mặc định 30.000đ; miễn phí từ 500.000đ. Phí cố định toàn quốc là giả định để phát triển, chưa tích hợp báo giá hãng vận chuyển.
- Chuyển khoản: cấu hình ngân hàng, số tài khoản, chủ tài khoản. Chưa đủ ba mục thì checkout chỉ nhận COD. Thông tin ngân hàng được chụp vào đơn khi đặt; sửa ngân hàng không thay đổi đơn cũ. Chuyển khoản phải đối soát thủ công, không tự đánh dấu đã thanh toán.
- Đơn hàng: chờ xác nhận → xác nhận → đang giao → hoàn tất. Chỉ hủy trước khi giao; hoàn tồn kho một lần.

Bốn sản phẩm và các chính sách ban đầu là **dữ liệu mẫu** cần thay trước khi mở bán. Logo được trích xuất từ PDF do người dùng cung cấp. Chưa đọc được website tham khảo do kết nối bị từ chối; giao diện hiện là thiết kế riêng dựa trên yêu cầu.

## Dữ liệu và cấu hình

- `DATA_DIR` (mặc định `./data`): SQLite và tệp tải lên; phải dùng ổ lưu trữ bền vững, không đưa vào Git.
- `PORT`: mặc định `3000`.
- `APP_ORIGIN`: origin chính xác của website, ví dụ `https://shop.example.vn`. Cần đặt khi chạy sau reverse proxy; không có dấu `/` cuối.
- `NODE_ENV=production`: cookie Secure. Chỉ dùng production qua HTTPS. Chấm dứt TLS tại reverse proxy được quản lý; không công khai cổng Node trực tiếp.
- Trạng thái admin, sản phẩm và nội dung lưu trong SQLite; không phụ thuộc localStorage. localStorage chỉ giữ ID và số lượng giỏ hàng, máy chủ tính lại toàn bộ giá.
- Sao lưu bằng SQLite backup API/`.backup` hoặc snapshot nhất quán khi dừng máy chủ; sao lưu cùng thư mục uploads. Không sao chép riêng tệp SQLite đang chạy ở chế độ WAL. Thử khôi phục trước khi vận hành.

## Kiểm tra và bảo mật

`npm test` chạy kiểm thử HTTP với DB tạm riêng: đăng nhập, phân quyền, CSRF/origin, đơn hàng riêng theo tài khoản, sửa giá phía client, tồn kho, chuyển khoản và thao tác admin. Mật khẩu dùng scrypt + salt; session token ngẫu nhiên lưu dạng hash, cookie HttpOnly/SameSite; SQL dùng tham số; nội dung render dạng text; Helmet/CSP, giới hạn yêu cầu và xác thực dữ liệu đầu vào.

DevTools/Network không thể bị cấm đáng tin cậy. Việc sửa request không được thay đổi giá thật hoặc vượt quyền admin. Các lớp kiểm tra phía máy chủ được kiểm thử, nhưng không phải cam kết hệ thống không thể bị tấn công.

## Còn cần trước khi mở bán

- Tích hợp MoMo/ZaloPay qua tài khoản merchant, sandbox, kiểm tra chữ ký callback, số tiền, mã đơn và tính idempotent. Hiện hai phương thức này **chưa hoạt động**, API từ chối chúng.
- Xác minh email, quên/đổi mật khẩu, MFA cho admin, nhật ký kiểm toán quản trị, quy trình hoàn tiền và vận chuyển thực tế.
- Tên miền/HTTPS, sao lưu/khôi phục, giám sát, email giao dịch và đánh giá bảo mật độc lập; cập nhật thông tin công ty, dữ liệu thật và chính sách hợp lệ.
- Ảnh tải lên hiện kiểm tra định dạng chữ ký tệp và dung lượng; trước khi mở công khai nên thêm giải mã/tái mã hóa ảnh, giới hạn số điểm ảnh và dọn tệp không dùng.
- Phân trang/tìm kiếm máy chủ và DB phục vụ nhiều instance khi quy mô tăng. Bản hiện tại phục vụ một instance Node với SQLite.

Không lưu khóa thanh toán hoặc mật khẩu vào nội dung admin, mã nguồn hoặc chat. Trang cấu hình ngân hàng chỉ chứa thông tin nhận chuyển khoản công khai.
