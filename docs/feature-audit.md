# Chức năng hiện có, phần trống và hướng xử lý

Ngày rà soát: **19/10/2026** (giờ Việt Nam). Đối chiếu mã nguồn mới nhất trước tác vụ `35b8674` và thay đổi trong bản này. Bảng này mô tả hành vi UI/API thực tế; không suy luận một chức năng đã hoàn chỉnh chỉ vì có tên trên menu hoặc bảng trong schema PostgreSQL tham chiếu.

Admin mở **Quản trị → Chức năng & thiết lập** (`/#admin/system`) để xem trạng thái theo dữ liệu và cấu hình của máy đang chạy. Trang không gọi dịch vụ trả phí, không trả khóa bí mật và không xác nhận kết nối nhà cung cấp thực tế. Chỉ quản trị viên được xem.

## Kết quả rà soát

Các chỗ nhìn như bị bỏ trống có bốn nguyên nhân khác nhau:

1. **Chức năng đã có, chưa có bản ghi:** đơn hàng, đánh giá, đổi trả, mã giảm giá, email hàng đợi.
2. **Có luồng phần mềm nhưng chưa cấu hình/kích hoạt:** nhận chuyển khoản, gửi email, VNPay, Rewards, AI và dịch nội dung động.
3. **Chỉ là trang thông tin:** Sự kiện, Cửa hàng, Nhượng quyền. Nội dung được sửa trong admin; không tự tạo quy trình đăng ký, chi nhánh hay hồ sơ đối tác.
4. **Chưa có module:** MoMo/ZaloPay, kết nối hãng vận chuyển, CRM/ticket, đa kho và đồng bộ sàn. Cần phát triển nghiệp vụ và bộ kết nối tương ứng.

## Đối chiếu chức năng và công việc tiếp theo

| Chức năng | Dùng để làm gì / trạng thái thật | Vì sao có thể trống | Hướng xử lý và nơi quản lý |
| --- | --- | --- | --- |
| Cấp tài khoản nhân viên | Admin tạo người dùng với email, mật khẩu ban đầu và vai trò; đã có API/UI | Chưa cấp nhân viên hoặc đang lọc nhầm khách hàng | **Tài khoản & phân quyền → Nhân viên → Cấp tài khoản nhân viên**. Đã tách Nhân viên/Khách hàng/Tất cả trong bản này |
| Đổi/đặt lại mật khẩu | Nhân viên tự đổi bằng mật khẩu hiện tại; admin đặt lại cho tài khoản khác; chỉ lưu hash | Chức năng nằm ở nút Đổi mật khẩu/Đặt lại mật khẩu, không phải xem lại mật khẩu cũ | Bản này bắt buộc nhân viên đổi mật khẩu được admin cấp trước khi làm việc. Sau đổi/đặt lại, phiên cũ bị thu hồi |
| Phân quyền/khóa nhân viên | Sáu nhóm quyền; chặn theo API, khóa tài khoản thu hồi phiên | Chưa chọn đúng vai trò hoặc đang dùng tài khoản customer | Admin chọn vai trò, trạng thái; UI giải thích quyền. Chưa có trình tạo quyền tùy ý, quyền theo chi nhánh hoặc bước phê duyệt hoàn tiền |
| Khôi phục mật khẩu/xác minh email | Token hết hạn, dùng một lần; thư được xếp hàng | Không có cấu hình gửi hoặc worker chưa chạy | Cấu hình Resend, địa chỉ gửi và origin; chạy `npm run outbox` theo lịch. Không gửi mật khẩu nhân viên bằng email tự động. Trong lúc chưa cấu hình, admin có thể đặt lại mật khẩu qua web |
| MFA và phiên đăng nhập | Hồ sơ & bảo mật có TOTP, mã khôi phục và quản lý phiên | Người dùng chưa bật MFA | Người dùng tự bật và cất mã khôi phục. Admin đặt lại mật khẩu không tắt MFA. Chưa bắt buộc MFA cho mọi nhân viên |
| Danh mục, sản phẩm, biến thể | Nội dung, giá, ảnh, tồn, SKU và từng phiên bản đều quản lý được | Hàng bị ẩn hoặc chưa thêm/đủ ảnh | Thêm sản phẩm, danh mục và ảnh; bật Đang bán. Có thể chỉnh dữ liệu mẫu, không dùng thông số mẫu như cam kết hàng thật |
| Nhập/xuất CSV, kho | Import có xem trước, giới hạn lô, transaction; điều chỉnh tồn có lý do | Chưa nhập hàng hoặc chưa có biến động | Dùng tệp CSV mới xuất với revision; thay đổi tồn bằng số lượng tăng/giảm. Đã có bảo vệ ghi đè tồn cũ; chưa đa kho, phiếu kiểm kê và giá vốn |
| Đơn hàng | Đặt hàng có/không tài khoản, địa chỉ Việt Nam, retry chống trùng, xử lý trạng thái | Chưa có đơn thật | Đơn xuất hiện sau checkout. Mở mã đơn trong admin để xử lý; không tạo đơn giả lấp bảng |
| Thu/hoàn tiền | Sổ giao dịch thủ công với số tiền và tham chiếu duy nhất | Chưa có chứng cứ tiền hoặc chưa ghi nhận | Xác minh tiền thực tế rồi ghi nhận trong chi tiết đơn. Nút hoàn tiền không tự chuyển tiền qua ngân hàng |
| COD/chuyển khoản | COD dùng ngay; chuyển khoản chỉ bật khi đủ thông tin | Ba trường nhận tiền chưa đầy đủ | **Giao hàng & thanh toán**: ngân hàng, số tài khoản, chủ tài khoản. Không nhập mật khẩu/OTP ngân hàng |
| VNPay | Tạo link, xác minh chữ ký/số tiền/callback đã có | Thiếu merchant hoặc origin; phương thức bị ẩn | Đăng ký merchant, cấu hình trên server, thử sandbox/callback rồi mới bật live. Có biến cấu hình chưa chứng minh giao dịch thành công |
| MoMo/ZaloPay | **Chưa tích hợp** | Chưa có adapter tạo giao dịch/callback | Cần merchant và sandbox từng ví; triển khai kiểm chữ ký, số tiền, chống callback lặp, trạng thái lỗi/hủy. Chưa tự bật hoặc nhận thanh toán qua hai ví |
| Phí giao/vận đơn | Phí mặc định/theo vùng; nhập hãng, tracking, URL, trạng thái | Chưa điền quy tắc hoặc chưa tạo vận đơn ngoài hệ thống | Thiết lập phí và nhập thông tin vận đơn đã có. Báo giá thật/tạo vận đơn/webhook/đối soát COD cần API hãng vận chuyển |
| Mã giảm giá và trang Khuyến mãi | Coupon thực sự tính ở checkout; trang quảng bá chỉnh riêng | Chưa tạo coupon hoặc trang còn lời giới thiệu mẫu | Tạo mã, thời hạn, hạn mức, sản phẩm áp dụng; cập nhật nội dung chiến dịch. Giới thiệu sản phẩm trên trang không tự hạ giá |
| Rewards | Có ledger tích/đổi/thu hồi điểm, mặc định tắt | Cửa hàng chưa bật chương trình | Thiết lập tỷ lệ, bật ở **Quy tắc bán hàng**, đồng thời sửa trang giới thiệu và điều kiện áp dụng. Chưa hạng thành viên/đổi quà vật lý |
| Đánh giá | Chỉ người mua đã nhận hàng được gửi; chờ admin duyệt | Chưa có đánh giá hợp lệ | Đợi khách gửi và duyệt phản hồi thật. Không seed số sao hoặc đánh giá giả |
| Đổi trả | Yêu cầu từ đơn hoàn tất → duyệt → nhận → đóng; hoàn tồn một lần | Chưa có yêu cầu | Xử lý tại Đổi trả, ghi nhận tiền đã hoàn trước khi đóng. Chưa đổi trả từng dòng/số lượng hoặc đổi sang SKU khác |
| Bán chạy/Sản phẩm mới | Bán chạy từ đơn hoàn tất hoặc bộ sưu tập chọn tay; sản phẩm mới theo lần thêm | Chưa có đơn hoàn tất hoặc chưa chọn sản phẩm | Cấu hình bộ sưu tập bằng checkbox. Không suy diễn chưa có doanh số = chức năng hỏng |
| Sự kiện | **Trang nội dung**, chưa có lịch/đăng ký/check-in | Trang mặc định đang chờ thông tin | Điền sự kiện thực hoặc ẩn tab trong Menu & các trang. Nếu tổ chức đăng ký: phát triển sự kiện, suất chỗ, form đăng ký, xác nhận và quản lý người tham gia |
| Cửa hàng | Trang liên hệ, chưa quản lý danh sách chi nhánh | Địa chỉ/giờ mở cửa còn trống | Điền thông tin thực ở Nội dung website. Danh sách nhiều cửa hàng/bản đồ/giờ theo chi nhánh cần module địa điểm |
| Nhượng quyền | **Trang giới thiệu**, chưa tiếp nhận/duyệt hồ sơ | Chưa có chính sách đối tác | Điền nội dung được phê duyệt hoặc ẩn tab. Muốn nhận hồ sơ: thêm form có consent, chống spam, pipeline xử lý và phân công nhân viên |
| Yêu thích/hồ sơ/địa chỉ | Đã có lưu/xóa yêu thích, hồ sơ và địa chỉ tỉnh-phường | Người dùng chưa đăng nhập hoặc chưa lưu | Dùng tài khoản khách hàng; không cần merchant hoặc AI để hoạt động |
| Trợ lý tư vấn | Có tra cứu danh mục; AI là tùy chọn | Chưa có khóa/mô hình hoặc từ khóa không khớp | Tra cứu vẫn dùng được. Nếu cần AI, cấu hình mô hình và ngân sách; không cấp quyền sửa đơn/hoàn tiền cho chatbot |
| Ba ngôn ngữ | Nhãn đi kèm dùng được không cần khóa; nội dung mới có thể dịch động | Nội dung gốc chưa có bản dịch/khóa dịch | Cấu hình Google Translation cho nội dung công khai. Dữ liệu tài khoản, đơn, chính sách giữ nguyên; không gửi đi dịch |
| Dashboard/audit | Số liệu từ DB, sổ thu/hoàn, tồn và sự kiện; nhật ký trước/sau | Chưa có giao dịch/hoạt động | Tạo dữ liệu qua luồng thật. Chưa báo cáo lợi nhuận/giá vốn/ROI hoặc phân tích đa kênh |
| Sao lưu/tác vụ | Có scripts backup, outbox, maintenance | Chưa đặt lịch; có script không có nghĩa là đã chạy | Đặt lịch trên máy chủ, giám sát kết quả, lưu bản sao ngoài máy và thử phục hồi. Đây là công việc vận hành |
| CRM/ticket, đa kho, đồng bộ sàn | **Chưa có nghiệp vụ/UI/API hoàn chỉnh** | Mới có đề xuất/schema tham chiếu | Chốt quy trình, nguồn tồn và đối tác; triển khai theo module và migration riêng. Không đổi sang PostgreSQL chỉ bằng một biến môi trường |

## Luồng nhân viên đã hoàn thiện trong bản này

1. Admin vào **Tài khoản & phân quyền → Nhân viên**, cấp tên/email/mật khẩu/vai trò.
2. Nhân viên nhận mật khẩu ban đầu bằng kênh riêng; đăng nhập không cần dịch vụ email hoạt động.
3. Website bắt buộc đến **Đặt mật khẩu riêng**. Máy chủ chỉ cho đọc dữ liệu cửa hàng công khai, thông tin phiên/bảo mật, đổi mật khẩu hoặc đăng xuất; các nghiệp vụ khác bị chặn với `PASSWORD_CHANGE_REQUIRED`.
4. Nhân viên nhập mật khẩu hiện tại, mật khẩu mới khác từ 12–128 ký tự và mã MFA nếu đã bật. Khi thành công, mọi phiên cũ hết hiệu lực; đăng nhập lại bằng mật khẩu riêng để làm việc theo vai trò.
5. Nếu quên, admin dùng **Đặt lại mật khẩu**; nhân viên lại phải đổi trước khi làm việc. Khóa/mở khóa và thay vai trò vẫn được kiểm tra trên server. Reset mật khẩu không bỏ MFA.
6. Khôi phục qua link email hợp lệ cũng đặt lại trạng thái yêu cầu đổi và thu hồi phiên; không cho dùng lại mật khẩu tạm nếu đang có yêu cầu đổi.

Chỉ tài khoản nhân viên mới được cấp hoặc được admin đặt lại mật khẩu sau bản nâng cấp bị yêu cầu đổi. Không ép toàn bộ tài khoản hiện có đổi mật khẩu khi migration. Tài khoản khách hàng tự đăng ký vẫn giữ luồng thông thường. API trả metadata trạng thái, không trả mật khẩu hoặc hash.

## Thứ tự triển khai tiếp

- **Vận hành cửa hàng hiện có:** dữ liệu thật, ngân hàng, phí giao/chính sách, tài khoản và quyền từng người, lịch sao lưu/khôi phục. Admin nay xem các bước này tại Chức năng & thiết lập.
- **Tích hợp ngoài:** gửi email/worker, thử VNPay sandbox, rồi MoMo/ZaloPay và một hãng giao hàng theo đối tác bạn sử dụng. Cần quyền merchant, thông số và tài khoản dịch vụ; chưa kiểm chứng kết nối thật trong tác vụ này.
- **Module mới khi có nhu cầu:** đăng ký sự kiện/hồ sơ nhượng quyền, CRM/ticket, phân quyền phê duyệt thu/hoàn, đa kho/đồng bộ sàn. Trước khi viết cần chọn quy trình và người phụ trách; không tạo form rỗng chỉ để có nút trên menu.

## Bằng chứng và giới hạn

- `npm test`: kiểm tra cấp tài khoản, gọi API trực tiếp khi đang dùng mật khẩu tạm, CSRF, đổi/đặt lại/khôi phục, MFA và rollback khi lỗi nhật ký; kiểm tra trạng thái chức năng không ghi dữ liệu hoặc trả bí mật.
- `npm run test:staff`: trình duyệt kiểm tra admin cấp → nhân viên đổi → đăng nhập làm việc → admin reset → đổi lại, cùng trang trạng thái ở màn hình nhỏ/lớn.
- `test:admin`, `test:browser`, `test:languages`, `test:storefront`, `test:navigation`: các kiểm tra hồi quy quản trị, bán hàng và điều hướng hiện có, chạy với DB tạm riêng.
- Các bài kiểm tra không gửi email thật, không gọi AI/dịch trả phí hoặc tạo giao dịch thanh toán thật. Kiểm tra cấu hình chỉ chứng minh có trường cấu hình cần thiết, không chứng minh tài khoản dịch vụ còn hợp lệ/worker đang chạy.

Các tài liệu trong `docs/system-review/` là bản đối chiếu lịch sử ở commit `282d1b2`; những phát hiện cũ đã có các bản sửa sau đó. Không dùng số chức năng Có/Một phần/Chưa của tài liệu cũ như thống kê hiện trạng của commit này.
