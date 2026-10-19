# Super Net — storefront & administration

Website có bộ chọn **Tiếng Việt / English / 繁體中文**. Nhãn giao diện dùng bản dịch đi kèm; nội dung công khai có thể dịch bằng Google Cloud Translation qua backend với cache và hạn mức. Xem [cấu hình ngôn ngữ và PowerShell](docs/languages.md).

Ứng dụng thương mại điện tử bằng Node.js 24, Express và SQLite. Đây là bản phát triển chạy được, **chưa phải bản đã kiểm toán hoặc sẵn sàng mở bán công khai**.

## Chạy ứng dụng

```sh
cd /workspace/Sn-ecom
npm ci
npm test
npm start
```

Mặc định cổng 3000. Tạo quản trị viên bằng `npm run admin` trong terminal tương tác: email và mật khẩu từ 12 ký tự; mật khẩu không hiển thị khi nhập. Không có tài khoản admin hoặc mật khẩu mặc định. Đăng nhập ở mục Tài khoản, sau đó mở mục Quản trị trên thanh điều hướng (route `#admin`).

Yêu cầu **Node.js 24 trở lên** vì ứng dụng sử dụng module tích hợp `node:sqlite`. Node 18 không chạy được. Trên Windows, sau khi cài Node mới, đóng toàn bộ VS Code và mở lại rồi kiểm tra `node --version`.

## Demo miễn phí để chia sẻ

Chạy trên máy Windows và dùng Cloudflare Quick Tunnel để có link HTTPS miễn phí. Sau khi cài cloudflared, tạo admin riêng bằng `npm.cmd run demo:admin`, rồi chạy **`npm.cmd run demo`**. Công cụ tự cấu hình địa chỉ website, kiểm tra link công khai và in link để chia sẻ; Ctrl+C dừng cả website và tunnel. Dữ liệu nằm riêng trong `data/demo/`, không thay DB website hiện có. Xem [các bước PowerShell và cách xử lý lỗi](docs/free-demo.md).

## Cập nhật website đang sử dụng trên Windows

Dừng website bằng **Ctrl + C**, mở terminal trong thư mục dự án và chạy:

```powershell
cd D:\AI\Sn-ecom
git pull origin main
npm ci
npm run seed:demo
npm run dev
```

Mở `http://localhost:3000`. Thay đường dẫn `D:\AI\Sn-ecom` nếu bạn lưu ở nơi khác. **Không xóa thư mục `data`**: đây là nơi lưu tài khoản, đơn hàng, sản phẩm, cấu hình và ảnh đã tải lên. Sao lưu dữ liệu theo hướng dẫn bên dưới trước khi cập nhật.

Cơ sở dữ liệu mới được tạo sẵn bộ sản phẩm mẫu. Với cơ sở dữ liệu cũ, khởi động chỉ bổ sung cấu trúc trường thông tin và nội dung trang mặc định còn thiếu; không tự thay sản phẩm hiện có. Lệnh `npm run seed:demo` là bước chủ động thêm dữ liệu mẫu:

- Thêm sản phẩm mẫu còn thiếu vào các danh mục hiện có; không sửa danh mục của cửa hàng.
- Chỉ bổ sung mô tả, ảnh và thông tin chi tiết cho bốn sản phẩm cũ khi toàn bộ dữ liệu ban đầu còn nguyên. Không đổi giá hoặc tồn kho của sản phẩm cũ.
- Giữ nguyên sản phẩm đã biên tập. Không tạo thêm bản mẫu trùng tên hoặc ảnh mặc định của sản phẩm cũ.
- Có sổ theo dõi SKU mẫu: chạy lại không ghi đè thay đổi; các mẫu đã xóa sau lần nhập bằng công cụ mới sẽ không được thêm lại. Khởi động bình thường cũng không khôi phục dữ liệu mẫu. Lần nhập đầu tiên không biết lịch sử xóa của phiên bản cũ, nên có thể thêm lại mẫu đã xóa trước khi nâng cấp.

Lệnh này không thay đổi tài khoản, đơn hàng, thông tin ngân hàng hoặc các nội dung cài đặt đã lưu.

Các tác vụ đã ở môi trường tách biệt: dùng checkout hiện có, không cần tạo Git worktree.

## Nội dung quản trị

Sản phẩm hỗ trợ nhiều màu/SKU ngay trong form thêm/sửa, mỗi SKU có ảnh, giá và tồn riêng. Khách chọn màu sẽ đổi ảnh; giỏ và đơn giữ đúng SKU. Xem [hướng dẫn nhập SKU và ảnh](docs/product-skus.md).

Mở **Quản trị → Chức năng & thiết lập** để biết các mục đang trống vì thiếu dữ liệu, chưa cấu hình hay chưa tích hợp. Xem [rà soát chức năng và hướng xử lý](docs/feature-audit.md). Admin cấp/đặt lại mật khẩu nhân viên; nhân viên mới nhận mật khẩu phải đặt mật khẩu riêng trước khi làm việc. Nhóm Nhân viên/Khách hàng đã được tách trong quản lý tài khoản.

Trang quản trị mới dùng thanh bên theo nhóm công việc, bảng tìm kiếm/lọc và biểu mẫu từng mục; quản lý tài khoản, khóa tài khoản và sáu vai trò. Xem [hướng dẫn sử dụng và phân quyền](docs/admin-guide.md). `npm run test:admin` kiểm tra trực tiếp giao diện với DB tạm.

- Sản phẩm: thêm/sửa/xóa/ẩn, giá, tồn kho, danh mục, mô tả, ảnh chính hoặc tải PNG/JPEG/WebP lên (5 MB). Thông tin chi tiết gồm SKU, mô tả ngắn, vật liệu, kích thước, dung tích, màu, điểm nổi bật, bảng thông số, cách bảo quản, thư viện ảnh, nhãn và trạng thái sản phẩm mẫu.
- Nội dung & cài đặt: logo, ảnh banner, màu sắc, tiêu đề, mô tả, nút, danh mục, cam kết, thông tin liên hệ, chính sách, nhãn và nội dung giao diện. Mục nội dung mở rộng `editorial` quản lý ảnh danh mục, bộ sưu tập, câu chuyện thương hiệu, bài viết cảm hứng và nội dung chân trang. Các dữ liệu JSON được kiểm tra trên máy chủ; văn bản không thực thi HTML.
- Giao hàng mặc định 30.000đ; miễn phí từ 500.000đ. Phí cố định toàn quốc là giả định để phát triển, chưa tích hợp báo giá hãng vận chuyển.
- Chuyển khoản: cấu hình ngân hàng, số tài khoản, chủ tài khoản. Chưa đủ ba mục thì checkout chỉ nhận COD. Thông tin ngân hàng được chụp vào đơn khi đặt; sửa ngân hàng không thay đổi đơn cũ. Chuyển khoản phải đối soát thủ công, không tự đánh dấu đã thanh toán.
- Đơn hàng: chờ xác nhận → xác nhận → đang giao → hoàn tất. Chỉ hủy trước khi giao; hoàn tồn kho một lần.

Thanh điều hướng gồm **Danh mục**, **Bán chạy**, **Sản phẩm mới**, **Khuyến mãi**, **Sự kiện**, **Cửa hàng**, **Nhượng quyền** và **Super Net Rewards**. Trong **Quản trị → Nội dung website → Menu & các trang**, mục thanh điều hướng cho phép sửa tên, bật/tắt các tab, ảnh và nội dung trang, cùng danh sách sản phẩm giới thiệu. Menu Danh mục lấy các nhóm sản phẩm từ danh mục đã cấu hình. Nếu không chọn sản phẩm riêng, Bán chạy dựa trên số lượng trong đơn hàng **hoàn tất** và Sản phẩm mới hiển thị sản phẩm theo thứ tự thêm gần đây; các trang khác chỉ giới thiệu sản phẩm đã chọn. Chưa có đơn hoàn tất thì Bán chạy không tự tạo số liệu hoặc lượt mua mẫu. Khuyến mãi, sự kiện, nhượng quyền và Rewards hiện là các trang nội dung có thể chỉnh sửa; không tự giảm giá, tích điểm hay kích hoạt chương trình thành viên. Khi cập nhật, cấu hình điều hướng mặc định chỉ được thêm nếu chưa tồn tại; các nhãn và nội dung đã lưu được giữ nguyên.

Bộ 16 sản phẩm, thông số kỹ thuật, giá, tồn kho, bài viết và chính sách ban đầu là **dữ liệu mẫu**, không phải hàng hóa hoặc cam kết thương mại đã xác minh. Ảnh dùng để minh họa phong cách; có thể không trùng chính xác với tên và thông số mẫu. Cần thay bằng thông tin và ảnh sản phẩm thực trước khi mở bán; đổi trạng thái mẫu trong admin khi đã kiểm tra dữ liệu. Không có đánh giá, lượt mua hoặc chứng nhận giả được tạo. Logo được trích xuất từ PDF do người dùng cung cấp. Giao diện là thiết kế riêng dựa trên yêu cầu.

## Dữ liệu và cấu hình

- `DATA_DIR` (mặc định `./data`): SQLite và tệp tải lên; phải dùng ổ lưu trữ bền vững, không đưa vào Git.
- `PORT`: mặc định `3000`.
- `APP_ORIGIN`: origin chính xác của website, ví dụ `https://shop.example.vn`. Cần đặt khi chạy sau reverse proxy; không có dấu `/` cuối.
- `NODE_ENV=production`: cookie Secure. Chỉ dùng production qua HTTPS. Chấm dứt TLS tại reverse proxy được quản lý; không công khai cổng Node trực tiếp.
- Trạng thái admin, sản phẩm và nội dung lưu trong SQLite; không phụ thuộc localStorage. localStorage chỉ giữ ID và số lượng giỏ hàng, máy chủ tính lại toàn bộ giá.
- Sao lưu bằng SQLite backup API/`.backup` hoặc snapshot nhất quán khi dừng máy chủ; sao lưu cùng thư mục uploads. Không sao chép riêng tệp SQLite đang chạy ở chế độ WAL. Thử khôi phục trước khi vận hành.

## Hiệu ứng tương tác

Giao diện dùng CSS và Web Animations API cho phản hồi nút bấm, menu danh mục, cửa sổ nội dung, giỏ hàng, thông báo và nội dung khi cuộn. Thêm sản phẩm giữ nguyên vị trí cuộn và phần tử đang được chọn. Nút gửi hiển thị trạng thái xử lý và khóa gửi lặp khi yêu cầu đang chạy.

Thiết lập **Giảm chuyển động / Reduce motion** trên thiết bị được tôn trọng ngay khi thay đổi. Nội dung vẫn hiển thị và thao tác hoạt động khi hiệu ứng được giảm; không cần cấu hình database hoặc cài thư viện giao diện bổ sung.

## Kiểm tra và bảo mật

`npm test` chạy kiểm thử HTTP với DB tạm riêng: đăng nhập, phân quyền, CSRF/origin, đơn hàng riêng theo tài khoản, sửa giá phía client, tồn kho, chuyển khoản và thao tác admin. Kiểm thử dữ liệu mẫu bao gồm nâng cấp SQLite cũ, giữ nguyên nội dung đã sửa, không khôi phục mẫu đã xóa, rollback khi lỗi giữa chừng, CRUD thông tin sản phẩm và kiểm tra cấu hình nội dung lồng nhau. Mật khẩu dùng scrypt + salt; session token ngẫu nhiên lưu dạng hash, cookie HttpOnly/SameSite; SQL dùng tham số; nội dung render dạng text; Helmet/CSP, giới hạn yêu cầu và xác thực dữ liệu đầu vào.

DevTools/Network không thể bị cấm đáng tin cậy. Việc sửa request không được thay đổi giá thật hoặc vượt quyền admin. Các lớp kiểm tra phía máy chủ được kiểm thử, nhưng không phải cam kết hệ thống không thể bị tấn công.

## Còn cần trước khi mở bán

- Tích hợp MoMo/ZaloPay qua tài khoản merchant, sandbox, kiểm tra chữ ký callback, số tiền, mã đơn và tính idempotent. Hiện hai phương thức này **chưa hoạt động**, API từ chối chúng.
- Cấu hình và vận hành email xác minh/khôi phục, khuyến khích MFA cho admin; kiểm tra quy trình đối soát, hoàn tiền và hãng vận chuyển thực tế. Các luồng phần mềm đã có, cần dịch vụ và quy trình vận hành tương ứng.
- Tên miền/HTTPS, sao lưu/khôi phục, giám sát, email giao dịch và đánh giá bảo mật độc lập; cập nhật thông tin công ty, dữ liệu thật và chính sách hợp lệ.
- Ảnh tải lên đã giải mã/tái mã hóa WebP và giới hạn dung lượng/số điểm ảnh; cần tác vụ dọn tệp không dùng khi vận hành.
- Phân trang/tìm kiếm máy chủ và DB phục vụ nhiều instance khi quy mô tăng. Bản hiện tại phục vụ một instance Node với SQLite.

Không lưu khóa thanh toán hoặc mật khẩu vào nội dung admin, mã nguồn hoặc chat. Trang cấu hình ngân hàng chỉ chứa thông tin nhận chuyển khoản công khai.

## Chống gửi lặp checkout

Giao diện tạo `Idempotency-Key` cho từng nội dung đặt hàng và giữ mã trong sessionStorage khi yêu cầu lỗi để lần thử lại nhận cùng đơn. Máy chủ lưu kết quả trong SQLite cùng transaction trừ tồn kho: cùng tài khoản, mã và nội dung trả lại đơn cũ (HTTP 200); dùng lại mã cho nội dung khác trả HTTP 409. Lần mua mới dùng mã mới. Mọi client API phải gửi header này; request thiếu hoặc sai định dạng mã bị từ chối HTTP 400 cho cả khách vãng lai và tài khoản.

Số điện thoại được bỏ khoảng trắng, dấu ngoặc và dấu gạch ngang, sau đó yêu cầu 9–15 chữ số, có thể có dấu `+` đầu. Đây là kiểm tra định dạng, chưa xác minh chủ sở hữu số điện thoại.

## Bản nâng cấp bán hàng

Đã hợp nhất quản trị bán hàng và nội dung tại `#admin` (giữ tương thích đường dẫn `#manage`), thanh toán/đối soát, vận đơn, đổi trả, lịch sử kho, biến thể, mã giảm giá, Rewards tùy chọn, mua không cần tài khoản, hồ sơ/MFA, đánh giá người mua, CSV, SEO và trợ lý sản phẩm. Xem [hướng dẫn vận hành và cấu hình dịch vụ ngoài](docs/commerce-upgrade.md) để biết tính năng hiện có, quy tắc và phần chưa kết nối.

`npm run test:browser` chạy luồng người dùng bằng Playwright trên DB tạm. `npm run test:storefront` kiểm tra đồng bộ danh mục giữa các tab/trình duyệt và giữ nội dung checkout. `npm run backup -- <thư-mục>` sao lưu SQLite/uploads. Email dùng hàng đợi và cần worker; AI/VNPay chỉ hoạt động sau khi cấu hình khóa/tài khoản phù hợp. Các ghi chú “chưa có” ở phần bản 0.2 phía trên mô tả trước nâng cấp; tài liệu mới là nguồn chi tiết cho bản hiện tại.

Địa chỉ giao hàng chỉ tại Việt Nam, chọn Tỉnh/thành phố → Phường/xã/đặc khu theo bộ dữ liệu mới lưu trong ứng dụng. Xem [nguồn dữ liệu và cách cập nhật](docs/vietnam-addresses.md). Địa chỉ cũ không bị ghi đè; cần chọn lại tỉnh/xã khi dùng cho đơn mới.

## Kiểm thử tự động và sửa lỗi QA

GitHub Actions chạy API/regression, Chromium mua hàng, quản trị, đồng bộ danh mục, điều hướng, đa ngôn ngữ và schema/concurrency PostgreSQL trên mỗi push/PR. `npm run test:navigation` kiểm tra bấm link từ trang sản phẩm sang giỏ hàng/các tab, lịch sử trình duyệt và giữ dữ liệu. Xem [bản sửa lỗi kẹt điều hướng](docs/navigation-fix-2026-10-19.md) và [bản sửa bốn lỗi QA và hợp đồng checkout](docs/qa-fixes-2026-10-19.md).
