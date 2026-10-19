# Sửa lỗi kẹt điều hướng ở trang sản phẩm

Bản gốc: `ec4d3f1`. Lỗi tái hiện được bằng HTTP/SQLite/Chromium nội bộ, không cần Cloudflare Tunnel.

## Nguyên nhân và cách sửa

1. Mở một sản phẩm bằng đường dẫn `/san-pham/<id>-<ten-san-pham>`.
2. Thêm sản phẩm vào giỏ rồi bấm **Giỏ hàng**, **Tài khoản** hoặc một tab menu.
3. Link `#cart` được trình duyệt ghép thành `/san-pham/<id>-<ten-san-pham>#cart`. Bộ chặn liên kết coi đó là link sản phẩm và gọi `pushState` chỉ với pathname/query, bỏ mất `#cart`. Website lại render chính sản phẩm đang xem, tạo cảm giác bị đơ. Test trước sửa dừng vì không mở được checkout.

Bản sửa đưa các liên kết fragment xuất phát từ trang sản phẩm về đường dẫn gốc, ví dụ `/#cart`, đồng thời giữ query ngôn ngữ và fragment đích. Link `#` về trang chủ đúng nghĩa. Link sản phẩm vẫn mở trong cùng tài liệu, đóng hộp thoại và cuộn lên đầu như các route khác. Các thao tác mở tab mới, tải xuống, liên kết ngoài và click đã được xử lý vẫn theo hành vi trình duyệt.

Link danh mục chỉ cập nhật bộ lọc; việc chuyển trang do href/bộ điều hướng thực hiện. Trước đây handler danh mục đổi hash rồi handler link tiếp tục pushState, tạo hai bước lịch sử cho một lần bấm. Đã tái hiện bằng test Back từ danh mục và sửa để một lần Back trở về sản phẩm.

## Kiểm chứng

- `npm run test:navigation`: **7 nhóm đạt**, dùng bấm chuột/Enter thật từ URL sản phẩm chuẩn. Bao phủ giỏ có hàng, phiên khách hàng đã đăng nhập, cả 7 tab menu, yêu thích/tư vấn/tài khoản/tra cứu đơn, dropdown/danh mục/trang chủ, Back/Forward, reload, vi/en/zh-TW và điện thoại 375 px. Test không gán hash thay cho thao tác bấm gây lỗi.
- `npm test`: **60/60 đạt**.
- Các bộ `test:browser` (**14 nhóm**), `test:storefront` (**4 nhóm**), `test:languages` (**5 nhóm**) và `test:admin` đều đạt.
- Fixture điều hướng có DB riêng: toàn bộ bản ghi sản phẩm/biến thể, đơn hàng, yêu cầu và giao dịch thanh toán, chuyển động kho, nhật ký không đổi sau khi duyệt trang; integrity và khóa ngoại hợp lệ. Không có lỗi JavaScript, HTTP 429 hoặc HTTP 5xx trong bộ điều hướng.
- Đối chiếu DB gốc ở chế độ chỉ đọc: mã băm nội dung **30 bảng không đổi**, `integrity_check=ok`, không có lỗi khóa ngoại. Không sửa schema hoặc dữ liệu cửa hàng.
- Thêm bộ điều hướng vào CI để chạy mỗi push/PR. Ảnh checkout trên điện thoại được lưu cùng artifact của job.

## Áp dụng cho demo Windows

Dừng demo đang chạy bằng **Ctrl+C**, rồi chạy từng dòng trong PowerShell tại thư mục repo:

```powershell
git pull --ff-only origin main
npm.cmd run demo
```

Mở **Link demo mới** mà chương trình in ra và nhấn **Ctrl+F5**. Dữ liệu demo trong `data/demo/` được giữ khi cập nhật và chạy lại; link Cloudflare có thể đổi. Bản sửa đã được kiểm thử nội bộ; cần áp dụng trên máy đang chạy tunnel để website demo nhận mã mới.
