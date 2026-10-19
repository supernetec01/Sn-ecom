# Sửa lỗi nhất quán dữ liệu quản trị — 2026-10-19

Bản gốc được kiểm tra: `845facb`. Phạm vi: bốn lỗi admin do tester báo, cùng các đường ghi tồn tương tự ở biến thể và CSV. File báo cáo gốc không có trong workspace này; đối chiếu dựa trên mô tả tái hiện và mã nguồn.

## Thay đổi

1. **Sửa nội dung không khôi phục tồn cũ.** Form sửa sản phẩm dùng PATCH và chỉ gửi các trường đã đổi; form biến thể không gửi tồn. Điều chỉnh kho dùng số lượng tăng/giảm và lý do. Tồn ban đầu vẫn nhập được khi tạo mới.
2. **Chặn ghi đè bằng API cũ và CSV.** Sản phẩm/biến thể có `revision` nội dung và `stock_revision` riêng. Trigger DB tăng phiên bản trên mọi đường cập nhật thực sự, kể cả mua/hủy đơn, đổi tên danh mục, ẩn/hiện và CSV. PUT đầy đủ cần cả hai phiên bản; CSV cập nhật cần giữ hai cột phiên bản từ tệp xuất. Thiếu phiên bản trả 428; bản cũ trả 409 và hoàn tác toàn bộ lô. Phát hiện cả trường hợp tồn giảm rồi tăng lại về số cũ. Việc khách mua hàng không gây xung đột với PATCH chỉ sửa nội dung.
3. **Duyệt đánh giá nguyên tử.** Đọc trạng thái, cập nhật và ghi nhật ký trong cùng transaction. Lỗi ghi nhật ký trả 500 và không công khai đánh giá. Duyệt lại cùng trạng thái không tạo nhật ký lặp; ID không tồn tại trả 404.
4. **Đọc được chi tiết nhật ký.** Nhật ký cấu trúc của sản phẩm/biến thể/CSV/duyệt đánh giá dùng cùng định dạng với admin mới. API đọc được cả ghi chú `{before,after}` cũ và `{entity,entity_id,details}` mới; giao diện hiển thị các trường thay đổi, gồm giá 0. Chỉ trả các trường cho phép. Không xóa hay viết lại lịch sử cũ; ghi chú văn bản của các nghiệp vụ cũ vẫn được giữ trong DB.
5. **PUT cấu hình có bảo vệ như PATCH.** Dùng chung hàm lưu, kiểm tra phiên bản, xác thực cấu hình và transaction nhật ký. PUT gửi `{...settings,revision}` từ `/api/admin/config`; danh mục cũng bắt buộc phiên bản. Giao diện giữ nội dung chưa lưu khi nhận 409, không tự gửi lại bằng phiên bản mới.

Các thay đổi schema chỉ bổ sung hai cột và hai trigger cho mỗi bảng `products`, `product_variants`. Không đổi loại DB, không seed lại dữ liệu, không cần tạo lại tài khoản.

## Bằng chứng kiểm thử trước commit

- Sáu test hồi quy ban đầu đều thất bại trên bản gốc trước khi sửa.
- `npm test`: **55/55 đạt**, không bỏ qua test. File mới `test/admin-integrity.test.js` gồm 9 test, trong đó có **48 trường hợp gọi API theo vai trò**.
- Kiểm tra tình huống thật: mở tồn 32 → tạo đơn còn 31 → lưu mô tả giữ 31 và không thêm bút toán tăng kho.
- PUT tồn cũ, tồn giảm rồi hoàn lại, metadata cũ và CSV cũ đều bị từ chối; snapshot sản phẩm/biến thể/kho/nhật ký/cấu hình không bị ghi dở.
- Xuất CSV → đọc CSV → nhập lại giữ nguyên dữ liệu sản phẩm. Lô có dòng cũ hoàn tác cả dòng tạo mới trước đó.
- Hai lượt mua và yêu cầu admin cũ chạy đồng thời: không hồi sinh tồn; mua vượt tồn thất bại. Hủy hai đơn khôi phục đúng tồn ban đầu; tổng biến động kho bằng 0.
- Chèn lỗi DB tại bước ghi nhật ký: đánh giá chưa công khai qua API khách hàng; cấu hình và các phiên bản được hoàn tác. Kết nối tiếp tục dùng được khi bỏ lỗi giả lập.
- Migration trên dữ liệu kiểm thử có tài khoản, phiên, đơn, thu tiền, biến thể, đánh giá và nhật ký cũ: giữ nguyên các giá trị có sẵn; chạy lại không đặt lại phiên bản.
- `npm run test:admin` với Chromium: CRUD, upload, 32 → 31 khi đang mở form, giá trước/sau trên màn hình, duyệt đánh giá lỗi/khôi phục, PUT cấu hình xen giữa lúc mở form PATCH, giữ nội dung chưa lưu khi xung đột, menu theo quyền và màn hình 375/768/1440 px.
- `npm run test:browser`: **13 nhóm đạt**; `npm run test:languages`: **5 nhóm đạt**, gồm vi/en/zh-TW và giữ giỏ hàng/địa chỉ khi chuyển ngôn ngữ.
- `bash database/postgresql/verify.sh`: schema tham chiếu và hai tình huống tranh chấp tồn/thu tiền đạt. Website đang dùng SQLite; kết quả PostgreSQL không thay thế kiểm thử SQLite ở trên.

## Kiểm tra dữ liệu hiện có

Đọc DB gốc ở chế độ chỉ đọc, lưu số lượng và SHA-256 của nội dung từng bảng; tạo bản sao nhất quán bằng SQLite backup rồi chạy migration trên bản sao.

- Đối chiếu **30 bảng, 35 bản ghi**, toàn bộ giá trị cũ được giữ nguyên sau migration.
- `PRAGMA integrity_check`: `ok`; `PRAGMA foreign_key_check`: không có lỗi.
- Bốn trigger phiên bản tồn tại; mở lại DB không gây lỗi hoặc đặt lại dữ liệu.
- DB gốc có cùng số lượng và mã băm nội dung như trước khi làm việc. DB này có dữ liệu mẫu, chưa có đơn hoặc tài khoản; các tình huống có đơn/thu tiền/tài khoản được xác minh bằng dữ liệu kiểm thử riêng.
- Không đưa DB, bản sao, ảnh kiểm thử hoặc thông tin xác thực vào Git.

## Cập nhật và tương thích

Xem [hướng dẫn admin](admin-guide.md). Sau khi cập nhật code, khởi động lại server để chạy migration bổ sung, rồi tải lại trình duyệt. Bản giao diện/API cũ không gửi phiên bản sẽ bị từ chối lưu thay vì ghi đè dữ liệu mới. CSV cũ thiếu hai cột phiên bản cần xuất lại và đối chiếu trước khi nhập.

Email, AI và thanh toán qua nhà cung cấp thật không nằm trong kiểm thử này.
