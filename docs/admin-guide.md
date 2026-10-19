# Sử dụng trang quản trị Super Net

Đăng nhập ở **Tài khoản**, chọn **Quản trị** hoặc mở `/#admin`. Tài khoản admin cũ giữ toàn quyền; không cần tạo lại hoặc xóa dữ liệu. Các địa chỉ `#manage/...` cũ mở trong cùng bố cục quản trị.

## Chọn đúng mục công việc

Thanh bên chia thành Bán hàng, Nội dung và Thiết lập & nhân sự. Mỗi người chỉ thấy các mục được cấp quyền.

- **Tổng quan**: sản phẩm, hàng sắp hết, đơn chờ xác nhận, giá trị đơn hoàn tất; số đã thu, đã hoàn và thu ròng lấy từ sổ giao dịch. Giá trị đơn hoàn tất không đồng nghĩa với tiền đã thu.
- **Sản phẩm**: tìm tên/SKU, lọc danh mục và trạng thái/tồn thấp, phân trang và xuất CSV theo bộ lọc. Chọn **Thêm sản phẩm** hoặc **Sửa**; thông tin cơ bản, ảnh và mô tả nằm thành nhóm, thông số bổ sung được thu gọn. Tải ảnh xong phải lưu. Sản phẩm mới mặc định ẩn để chuẩn bị nội dung. Dùng **Ẩn/Hiện** để ngừng/mở bán và giữ lịch sử; thao tác này không ghi đè giá/tồn kho.
- **Danh mục**: thêm, đổi tên, xóa danh mục trống. Đổi tên tự cập nhật sản phẩm và ảnh danh mục trong một giao dịch. Phải chuyển sản phẩm đi trước khi xóa danh mục có hàng.
- **Đơn hàng**: tìm mã đơn/tên người nhận/điện thoại, lọc trạng thái, xuất CSV. Bấm mã đơn để xem hàng, địa chỉ, lịch sử, ghi nhận thu/hoàn tiền và vận đơn. Chỉ ghi nhận tiền sau khi đã kiểm tra thực tế; phần mềm không tự chuyển tiền. Trạng thái đơn và thanh toán độc lập. Hủy trước khi giao và khi chưa thu hoặc đã hoàn tiền; tồn kho được hoàn một lần.
- **Kho & biến thể**: chọn tên sản phẩm và phiên bản khi điều chỉnh kho, ghi lý do. Mở tên sản phẩm để sửa/thêm phiên bản. Giá/tồn cửa hàng của hàng có biến thể lấy theo phiên bản. Thao tác hàng loạt chọn bằng hộp kiểm; nhập CSV cần xem trước và xác nhận, lỗi một dòng hủy cả lô.
- **Mã giảm giá / Duyệt đánh giá / Đổi trả**: quản lý chương trình, phản hồi người mua và quy trình trả hàng. Chọn sản phẩm áp dụng bằng hộp kiểm; bỏ trống phạm vi mã giảm giá nghĩa là áp dụng mọi sản phẩm.
- **Nội dung website**: chọn Thương hiệu & liên hệ, Trang chủ, Menu & các trang, Chính sách hoặc Nhãn giao diện. Các ô nhập có tên rõ ràng; chính sách/bài viết dùng nút thêm/xóa, không cần sửa JSON. Nhấn **Lưu** ở cuối mục đang sửa. Có thông báo thay đổi chưa lưu và xác nhận khi chuyển mục qua menu.
- **Giao hàng & thanh toán**: phí mặc định, ngưỡng miễn phí và ba trường nhận chuyển khoản. **Quy tắc bán hàng** quản lý phí theo vùng, thời hạn giữ đơn và Rewards. Chỉ admin được thay đổi các mục này.
- **Email thông báo**: xem hàng đợi và thử lại email lỗi; cần cấu hình dịch vụ và chạy worker theo hướng dẫn vận hành.
- **Nhật ký hoạt động**: 100 thao tác gần nhất, thời gian và người thực hiện. Giữ lại lịch sử đã có; không lưu mật khẩu mới trong nhật ký.

Khi có thông báo dữ liệu cấu hình đã được người khác cập nhật, hệ thống từ chối lưu bản cũ. Sao chép phần đang biên tập nếu cần, chọn **Tải lại**, rồi sửa trên dữ liệu mới nhất. Lưu một mục không ghi đè các mục cấu hình khác.

## Vai trò và tài khoản

Vào **Tài khoản & phân quyền → Tạo tài khoản**. Dùng tài khoản riêng cho từng nhân viên. Khi chọn vai trò, biểu mẫu hiển thị mô tả quyền; cuối bảng có phần giải thích tất cả vai trò.

| Vai trò | Quyền chính |
| --- | --- |
| Quản trị viên (`admin`) | Toàn bộ, gồm ngân hàng, phí giao, quy tắc bán hàng, nhân sự, nhật ký và email |
| Quản lý cửa hàng (`manager`) | Tổng quan, sản phẩm/danh mục/kho/biến thể, đơn/thu hoàn tiền/vận đơn/đổi trả, mã giảm giá và đánh giá |
| Nhân viên bán hàng (`sales`) | Tổng quan, đơn/thu hoàn tiền/vận đơn và đổi trả |
| Nhân viên kho (`inventory`) | Sản phẩm, danh mục, kho và biến thể |
| Biên tập nội dung (`editor`) | Nội dung/giao diện/menu/chính sách, mã giảm giá và duyệt đánh giá |
| Khách hàng (`customer`) | Mua hàng, hồ sơ và đơn của chính mình; không vào admin |

Vai trò khách vãng lai nội bộ (`guest`) không hiện trong danh sách nhân sự và không được cấp qua biểu mẫu. Tài khoản hiện có giữ nguyên vai trò. Quyền của `editor` nay tập trung nội dung/marketing, không sửa sản phẩm; nếu nhân viên đang kiêm quản lý hàng, admin cần cấp vai trò phù hợp.

Chọn **Chỉnh sửa** để đổi vai trò, họ tên, email hoặc khóa/mở khóa tài khoản. Khóa không xóa đơn hàng. Đổi quyền, email hoặc trạng thái sẽ kết thúc phiên đăng nhập của tài khoản đó và thu hồi các mã xác minh/khôi phục đang chờ. Email đổi phải xác minh lại. Không thể tự đổi vai trò hoặc tự khóa mình.

**Đặt lại mật khẩu** áp dụng cho tài khoản khác; mật khẩu từ 12–128 ký tự. Không thể xem mật khẩu hiện tại vì chỉ lưu hash. Thông báo mật khẩu ban đầu bằng kênh riêng; nhân viên tự đổi sau khi nhận. Đặt lại mật khẩu kết thúc mọi phiên cũ và vô hiệu hóa liên kết khôi phục cũ, không tắt MFA.

**Đổi mật khẩu** của chính mình yêu cầu mật khẩu hiện tại và mã MFA nếu đã bật. Sau khi đổi phải đăng nhập lại trên mọi thiết bị. Vào **Tài khoản → Hồ sơ & bảo mật** để quản lý MFA và các mã khôi phục.

Quyền được kiểm tra lại tại máy chủ cho từng API, không phụ thuộc menu hoặc trường role phía trình duyệt. Tự gửi request qua Network không được bỏ qua phân quyền, CSRF hoặc trạng thái khóa.

## Cập nhật bản đang chạy

Sao lưu SQLite và uploads nhất quán trước khi nâng cấp theo README. Dừng website bằng Ctrl+C rồi chạy trong PowerShell:

```powershell
cd D:\AI\Sn-ecom
git pull origin main
npm ci
npm run dev
```

Không cần chạy seed hoặc tạo lại admin. Không xóa thư mục `data`. Khởi động sẽ bổ sung cột trạng thái tài khoản và phiên bản cấu hình, giữ sản phẩm/đơn/nội dung/tài khoản cùng nhật ký cũ.

## Kiểm tra và giới hạn

`npm test` kiểm tra vai trò và gọi API trực tiếp, phiên bị thu hồi, MFA, lưu từng mục/chống ghi đè cũ, đổi tên danh mục/rollback và giữ dữ liệu khi nâng cấp. `npm run test:admin` dùng Chromium với DB/tài khoản ngẫu nhiên để kiểm tra các luồng admin và kích thước màn hình; `test:browser` và `test:languages` kiểm tra tính năng bán hàng và ngôn ngữ.

Vai trò là các nhóm quyền cố định, chưa có trình tạo quyền tùy ý hoặc quyền theo chi nhánh. Tìm kiếm người dùng phân trang trên máy chủ; bảng sản phẩm/đơn trong workspace hiện tải danh sách được cấp quyền rồi lọc/phân trang trên trình duyệt. Nhật ký hiện giới hạn hiển thị 100 mục, không phải hệ thống lưu trữ chống sửa độc lập. Cơ sở dữ liệu đang chạy vẫn là SQLite; không tự chuyển sang PostgreSQL.
