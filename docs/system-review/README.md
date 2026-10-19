# Đối chiếu hệ thống Super Net với ba tài liệu yêu cầu

> Đây là báo cáo lịch sử tại commit `282d1b2`. Nhiều phát hiện đã được sửa ở các commit sau. Xem [rà soát chức năng hiện tại](../feature-audit.md), [hướng dẫn admin](../admin-guide.md) và [sửa nhất quán dữ liệu](../admin-qa-fixes-2026-10-19.md) trước khi dùng báo cáo này để đánh giá bản đang chạy.

Ngày rà soát: 19/10/2026. Mã nguồn: `282d1b2c1b01fdbfec126e9432ba1396cfb26ddc`.

Ba tệp dán được đọc theo thứ tự người dùng gửi: (1) danh sách chức năng website chuyên nghiệp, (2) 228 use case, (3) thiết kế dữ liệu và bảo mật. Tài liệu 3 nhắc đến SQL 46 bảng nhưng tệp SQL đó không nằm trong các tệp đính kèm; schema mới trong repository được xây dựng từ yêu cầu và mã thực tế.

## Kết luận và phạm vi

Hệ thống là cửa hàng B2C một doanh nghiệp, có frontend khách hàng, admin, API Express và **27 bảng SQLite thực sự**. Tài khoản, đơn hàng, sản phẩm, kho, giao dịch và quyền được lưu trên máy chủ. Giỏ hàng dùng localStorage chỉ chứa ID/số lượng/biến thể; API tính lại giá trước khi tạo đơn. Đây đã là luồng người dùng → hệ thống → dữ liệu, không phải giao diện giả lập.

Nền tảng bán hàng cơ bản đã có; vận hành nhiều kho/đa kênh, phân quyền chi tiết, CSKH và tích hợp đối tác còn thiếu. Chọn **PostgreSQL** làm thiết kế đích khi triển khai các phần này. Schema mới đã được chạy trong PostgreSQL riêng; ứng dụng hiện tại vẫn chạy SQLite. Chưa chuyển dữ liệu hoặc thay adapter của ứng dụng.

Tệp bàn giao:

- [Đối chiếu đủ 228 use case](use-case-matrix.csv): mở được bằng Excel, UTF-8 có BOM.
- [Kiến trúc và luồng nghiệp vụ](architecture.md): luồng hiện tại, cấu trúc module đích, transaction, quyền và thứ tự triển khai.
- [Thiết kế dữ liệu, lựa chọn dịch vụ và kế hoạch chuyển đổi](database.md).
- [Schema SQLite hiện có](../../database/sqlite/current-schema.sql): chỉ cấu trúc, không chứa dữ liệu người dùng.
- [Schema PostgreSQL 51 bảng](../../database/postgresql/001_initial.sql), [kiểm tra ràng buộc](../../database/postgresql/verify.sql), [kiểm tra bằng Docker](../../database/postgresql/verify.sh).

## Cách hiểu trạng thái

Ma trận use case có **57 Có, 81 Một phần, 90 Chưa**. Mỗi mã có bằng chứng và giới hạn riêng. Các con số là độ phủ danh mục rộng 228 use case, không phải phần trăm sẵn sàng mở bán; không cần triển khai đồng loạt tất cả.

- **Có**: đã tìm thấy luồng tương ứng trong mã; những luồng chính được bộ test hiện có thực thi. Không có nghĩa mỗi dòng có một test độc lập hoặc đã kiểm toán bảo mật.
- **Một phần**: có thành phần nhưng thiếu một yêu cầu con, cấu hình, kiểm chứng nhà cung cấp, hoặc mức vận hành tương ứng.
- **Chưa**: chưa tìm thấy triển khai chuyên dụng trong checkout này. Không kết luận về công cụ mà công ty có thể đang dùng bên ngoài.

Schema đích có bảng `support_tickets`, `warehouses`... không biến các chức năng này thành “đã có” trong ứng dụng. Trạng thái ma trận luôn dựa trên mã ứng dụng hiện tại.

## Đối chiếu tài liệu 1

| Nhóm yêu cầu | Đã có | Còn thiếu / giới hạn |
| --- | --- | --- |
| Trang chủ, sản phẩm, responsive | Banner/hero, nội dung quản trị, gallery, thông số, biến thể; kiểm tra 375/768/1440 px | Video; slider; thương hiệu; danh mục nhiều cấp |
| Tìm kiếm, bộ lọc | Tìm không dấu trên máy chủ; danh mục, giá; phân trang và sắp xếp | Lọc thương hiệu/thuộc tính/tồn; autocomplete; SKU biến thể chưa nằm trong truy vấn tìm kiếm |
| Giỏ hàng, đặt hàng | Thêm/sửa/xóa, checkout guest/tài khoản, địa chỉ Việt Nam hai cấp, quote máy chủ, snapshot đơn | Giỏ đồng bộ nhiều thiết bị; lịch sử đổi giá hiển thị cho khách; chấp thuận điều khoản có phiên bản |
| Minh bạch tiền hàng | Quote hiển thị tiền hàng, mã giảm giá, điểm, phí giao và tổng | Chưa có mô hình thuế/VAT và hóa đơn; cần xác định giá đã gồm thuế theo nghiệp vụ thực tế, không mặc định thuế bằng 0 là đúng |
| Thanh toán | COD; chuyển khoản có điều kiện cấu hình; ledger receipt/refund; VNPay adapter có xác minh IPN | Bank hiện trống; chưa VietQR; chưa merchant và sandbox thật; không có MoMo/ZaloPay; hoàn tiền không tự chuyển tiền |
| Xác nhận đơn | Trang mã đơn, guest token riêng, lịch sử trong DB; email outbox | Chưa cấu hình Resend/from/origin hoặc chạy worker gửi email thật; chưa SMS |
| Admin đơn hàng | Tìm mã/tên/điện thoại, lọc trạng thái, chuyển trạng thái, CSV, thu/hoàn, lịch sử, return | Lọc ngày/kênh; phân công; ghi chú nội bộ riêng; tạo đơn hộ khách; in phiếu/tem; tách kiện/đơn |
| Sản phẩm, SKU | CRUD/ẩn, biến thể, SKU kiểm tra ở API, import/export CSV | SKU cha trong JSON; chưa một ràng buộc UNIQUE chung; chưa giá vốn/lịch giá khuyến mãi/mã vạch |
| Kho | Trừ tồn trong transaction đặt hàng, chống âm, hoàn tồn một lần, lịch sử delta; cảnh báo dưới 5 | Tồn vật lý/giữ chỗ tách riêng; đa kho; phiếu nhập/xuất/kiểm kê; phê duyệt điều chỉnh; lô/serial; ngưỡng tùy SKU |
| Nhân viên và quyền | Tài khoản riêng; admin/sales/inventory/editor; đổi quyền thu hồi phiên; TOTP/recovery tùy chọn | Khóa nhân viên; owner/manager/accounting/support riêng; quyền thu tiền tách hoàn tiền; hạn mức/phê duyệt; bắt buộc MFA |
| CRM, CSKH | Tài khoản, hồ sơ, địa chỉ, lịch sử mua; yêu thích; chatbot danh mục; trả hàng toàn đơn | CRM tìm kiếm/tổng chi tiêu/phân nhóm; ticket, khiếu nại, bảo hành; người phụ trách/SLA; livechat; consent marketing |
| Vận chuyển | Phí theo vùng/ngưỡng miễn phí; nhập mã/link/trạng thái vận đơn | API hãng giao, báo giá thật, tem, webhook, giao lại, nhiều kiện, đối soát COD và phí |
| BigSeller/Shopee/TikTok | Chưa có | Adapter, quyền API đối tác, mapping SKU, cơ chế nguồn tồn chính, quota tồn website, inbox/outbox và đối soát |
| Marketing, SEO | Banner, nội dung bài viết, coupon có điều kiện; SEO/JSON-LD/canonical/sitemap; ledger Rewards mặc định tắt | GA4, Meta/TikTok Pixel; social link chuyên dụng Zalo/Facebook; consent; affiliate; email marketing; flash sale/giá theo lịch |
| Dashboard | Đã thu/hoàn/thu ròng từ ledger; số đơn theo trạng thái, tồn thấp; đếm event 30 ngày; collection bán chạy | Lọc ngày/tháng/kênh/sản phẩm; lợi nhuận/giá vốn/phí quảng cáo; khách mới/cũ; conversion theo phiên; tồn lâu |
| Chính sách, pháp lý | Nội dung liên hệ/chính sách chỉnh được | Thông tin mặc định còn là mẫu; chưa version điều khoản/consent. Thủ tục, quyền sở hữu hạ tầng và tính hợp lệ nội dung cần chứng từ bên ngoài mã nguồn |
| Bảo mật, vận hành | scrypt, session hash/cookie HttpOnly, Origin/CSRF, giới hạn request, Helmet, ảnh tái mã hóa, script backup, healthz | Xem các phát hiện dưới đây; chưa xác minh HTTPS/WAF/giám sát/backup offsite/restore định kỳ/CI staging |

Không dùng các số doanh thu mẫu trong tài liệu làm dữ liệu thật. Số thu ròng hiện tại không đồng nghĩa lợi nhuận. Tổng tiền đơn `completed` cũng không thay thế chứng cứ đã thu tiền.

## Những vấn đề kỹ thuật nên xử lý trước

### P0 — tính toàn vẹn và quyền nhạy cảm

1. **Cập nhật sản phẩm và audit chưa nguyên tử.** `server.js` ghi sản phẩm, inventory movement, audit bằng các câu lệnh riêng, không bọc transaction chung ở các route tạo/sửa sản phẩm. Đã mô phỏng lỗi INSERT audit trên DB tạm: API trả 500 nhưng giá mới vẫn lưu. Cần một service transaction cho mutation + movement + audit; rollback toàn bộ khi một bước lỗi.
2. **Audit sửa giá thiếu giá trước/sau.** `product_update`/`variant_updated` chỉ lưu actor/action/target, không lưu giá cũ/mới; audit không bất biến và không có request ID. Cần snapshot đã che thông tin nhạy cảm và hạn chế quyền sửa/xóa log.
3. **Chống đơn trùng chưa bắt buộc cho tài khoản.** Frontend gửi Idempotency-Key; API `/api/orders` vẫn chấp nhận tài khoản bỏ header. Đã gửi cùng nội dung hai lần không header trên DB tạm: tạo hai đơn 201 với hai ID. Bắt buộc key và lưu fingerprint/kết quả trong transaction; cùng key khác nội dung trả 409.
4. **Vai trò sales gộp xử lý đơn, thu và hoàn tiền.** Gate dựa vào đường dẫn `/api/admin/orders/...` nên sales được cả route `/payments` với `kind=refund`. Chưa có kế toán riêng, maker/checker hay xác thực lại khi đổi ngân hàng. Cần kiểm quyền ở từng hành động, không chỉ theo tiền tố URL.
5. **MFA chưa bắt buộc; seed TOTP lưu trực tiếp.** Bật/tắt, chống replay và recovery đã có test; cần bắt buộc với staff, mã hóa seed với khóa ngoài DB và xác thực lại thao tác nhạy cảm. Khóa tài khoản phải vô hiệu hóa session ngay.
6. **Kiểm soát SQL chưa đầy đủ.** `inventory_movements`/`audit_log` thiếu FK; SKU cha trong JSON; nhiều status không CHECK. Giữ kiểm tra API và bổ sung DB constraints/migration có kiểm chứng. SQL mới vẫn cần API xác thực chủ đơn/quyền nhân viên.

Các phát hiện trên là kết quả rà mã và thử nghiệm cô lập, chưa sửa mã nghiệp vụ trong tác vụ phân tích này.

### P1 — vận hành đơn kênh

- Ticket/CRM cơ bản, phân công đơn, ghi chú nội bộ riêng, lọc theo kỳ, in phiếu.
- Vận chuyển thật và đối soát COD; không suy diễn `shipment.delivered` = đã nhận tiền.
- Phân biệt on_hand/reserved/available; kiểm kê có phiếu và điều chỉnh có lý do/phê duyệt.
- Chạy email worker có khóa cấu hình, lease/retry an toàn; xác minh thật callback VNPay trong sandbox.
- Kiểm tra phục hồi backup và thu hẹp tài khoản DB; môi trường staging và giám sát lỗi.

### P2 — theo nhu cầu kinh doanh

BigSeller/đa kênh, mua hàng/nhà cung cấp, nhiều chi nhánh, hóa đơn điện tử, dữ liệu giá vốn và lợi nhuận, tracking quảng cáo có consent, tự động hóa marketing, affiliate. Chọn BigSeller hay website làm nguồn tồn chính trước khi xây adapter.

## Bằng chứng kiểm tra

- `npm test`: **24 pass, 0 fail, 0 skipped**.
- `BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser`: **12 nhóm PASS**, gồm guest checkout/retry, quản trị, biến thể/tồn, địa chỉ, tìm kiếm, SEO và responsive; DB tạm.
- Ba probe bổ sung trên DB tạm xác nhận: thiếu before/after audit; lỗi audit không rollback giá; checkout tài khoản không key tạo đơn lặp.
- PostgreSQL: áp schema trên PostgreSQL 17 trong container cô lập, không mở cổng; `verify.sql` kiểm tra ràng buộc và script kiểm tra tranh chấp tồn/thu tiền bằng hai session riêng. Kết quả cụ thể xem [thiết kế DB](database.md).
- Không gửi email thật, không gọi mô hình AI, không giao dịch gateway/shipper/BigSeller thật. Không xác nhận pháp lý, hiệu năng tải lớn hoặc bảo mật toàn diện.

Các viện dẫn luật và số điều trong tài liệu dán chưa được kiểm chứng từ nguồn chính thức trong tác vụ này. Riêng các trang giấy phép/giá PostgreSQL, Supabase và Neon được thử đọc nhưng bị proxy trả 403; không xác nhận hạn mức dịch vụ hiện hành.
