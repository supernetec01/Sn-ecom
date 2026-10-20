# Một sản phẩm có nhiều màu và SKU

Ví dụ: **Cốc sứ 350 ml** là một sản phẩm, gồm `COC-XANH`, `COC-DO`, `COC-TRANG`. Mỗi SKU có tên màu/phiên bản, ảnh, giá và số lượng riêng. Khách chọn màu trước khi thêm giỏ; đơn lưu đúng SKU đã mua.

## Thêm sản phẩm

1. Mở **Quản trị → Sản phẩm → Thêm sản phẩm**, điền tên và danh mục, chọn trạng thái ẩn/đang bán.
2. Tải **ảnh chính sản phẩm** dùng cho thẻ giới thiệu. Ảnh này cũng điền vào SKU đầu tiên để không phải tải hai lần.
3. Phần **SKU & màu sắc** mặc định có **một SKU**. Nhập mã SKU, tên màu/phiên bản, giá và tồn ban đầu.
4. Bấm **+ Thêm SKU / màu** cho từng màu tiếp theo. Mỗi SKU mới cần mã riêng và một ảnh mô tả; tải PNG/JPG/WebP tối đa 5 MB hoặc nhập đường dẫn ảnh HTTPS/tệp có sẵn. Ví dụ nhập thêm Đỏ và Trắng để có ba dòng SKU.
5. Có thể xóa dòng SKU chưa lưu nếu thêm nhầm; luôn giữ ít nhất một dòng. Dòng đã lưu dùng trạng thái **Ngừng bán**, giữ mã và lịch sử thay vì xóa vĩnh viễn.
6. Nhấn **Lưu sản phẩm** một lần để lưu cả nội dung và các SKU. Nút lưu khóa trong lúc còn ảnh đang tải. Tải ảnh xong nhưng chưa lưu chưa thay đổi dữ liệu sản phẩm.

Mã SKU không được trùng trong cùng sản phẩm hoặc với SKU sản phẩm/phiên bản khác. Khoảng trắng ở đầu/cuối được bỏ; không tự đổi hoa/thường. Mỗi sản phẩm tối đa 50 dòng SKU trong form; API vẫn có giới hạn tổng dung lượng yêu cầu.

## Chỉnh sửa và tồn kho

Mở **Sửa** ở sản phẩm để xem/sửa trực tiếp tất cả SKU, gồm mã, tên màu, ảnh, giá và trạng thái. Không cần sang mục Kho chỉ để thêm màu hoặc ảnh.

Nếu đang ở **Kho & biến thể**, mở tên sản phẩm rồi chọn **Quản lý SKU / thêm màu**. Nút này mở cùng form sản phẩm; khi chuyển từ một SKU sang nhiều màu, tồn hiện có được giữ ở dòng đầu. Mục kho không còn form thêm phiên bản riêng dễ bỏ qua SKU gốc.

- Tồn ban đầu nhập cho SKU mới. Với SKU đã lưu, form chỉ hiển thị tồn lúc mở; vào **Kho & biến thể** để điều chỉnh tăng/giảm và ghi lý do.
- Khách mua trong lúc admin sửa ảnh hoặc tên màu: lưu nội dung không khôi phục số tồn cũ.
- Nếu người khác đã sửa cùng SKU hoặc thay danh sách SKU khi bạn đang mở form, API trả xung đột để đối chiếu lại, không tự ghi đè.
- Một dòng sai, SKU trùng, ảnh không hợp lệ hoặc lỗi ghi nhật ký sẽ hủy toàn bộ lần lưu, gồm sản phẩm, SKU, chuyển tồn và audit.
- Ẩn một SKU để ngừng bán màu đó. Khi mọi SKU ngừng bán/hết hàng, hệ thống không quay về bán tồn gốc của sản phẩm.

Giá hiển thị ngoài danh sách là giá thấp nhất trong các SKU đang bán; tồn tổng là tổng tồn các SKU đang bán. Cảnh báo tồn thấp của sản phẩm dùng cùng nguồn tồn, không dựa vào ô tồn gốc đã ngừng sử dụng.

## Sản phẩm cũ đang có một SKU

Mở sản phẩm cũ và bấm **Thêm SKU / màu**. Hệ thống giữ màu/SKU hiện có thành dòng đầu, lấy **tồn thực tế lúc lưu**, rồi thêm các màu mới. Tồn gốc được chuyển sang dòng đầu trong cùng transaction; không nhân đôi tồn.

Đơn đã đặt trước khi chuyển đổi giữ nguyên snapshot mã, giá và ảnh cũ. Nếu hủy/hoàn hàng đủ điều kiện sau chuyển đổi, hàng cũ được nhập lại vào SKU đầu tiên đúng một lần. Không sửa lại đơn cũ để gắn mã màu mới.

Nếu sản phẩm đã có biến thể từ phiên bản cũ, giao diện nạp các dòng đó. Khi nâng cấp, ảnh chung hiện có được dùng làm ảnh dự phòng cho các SKU cũ; admin thay bằng ảnh đúng màu trong form. Không tự phân bổ lại tồn hoặc đoán màu của dữ liệu cũ.

## Khi khách mua

- Sản phẩm có nhiều màu: khách chọn từ danh sách hoặc các nút ảnh màu. Ảnh lớn, mã SKU, giá và tồn cập nhật theo lựa chọn.
- Ô tìm kiếm cửa hàng nhận cả mã SKU và tên màu đang bán, không phân biệt dấu tiếng Việt. Nhiều màu khớp vẫn chỉ hiện một sản phẩm; bộ lọc giá/danh mục tiếp tục áp dụng.
- Nút thêm giỏ trên thẻ sản phẩm có nhiều SKU mở đúng trang sản phẩm để chọn màu, kể cả ở phần gợi ý dưới một sản phẩm khác. Lựa chọn màu của sản phẩm đang xem không được dùng cho thẻ khác.
- Sản phẩm chỉ có một biến thể đang bán: biến thể được chọn sẵn; khách vẫn có thể đổi lựa chọn nếu có thêm màu.
- Màu hết hàng vẫn xem được ảnh, nút thêm giỏ bị khóa. SKU ngừng bán không xuất hiện như lựa chọn mua.
- Giỏ hiển thị ảnh và tên màu/SKU đã chọn. Máy chủ tự lấy giá, ảnh và tồn; dữ liệu giả mạo từ trình duyệt không quyết định đơn.
- Đơn lưu snapshot SKU/tên màu/ảnh/giá. Sửa thông tin SKU sau đó không thay snapshot đơn trước.

## Tương thích và kiểm tra

Website vẫn chạy SQLite. Migration chỉ thêm `product_variants.image`, `products.legacy_variant_id` và cập nhật trigger revision, không xóa/tạo lại dữ liệu. Ảnh SKU tham gia kiểm tra revision nội dung; checkout chỉ đổi revision tồn kho. `legacy_variant_id` phục vụ hoàn tồn của đơn một SKU cũ sau khi chuyển đổi, không phải trường cần nhập trên giao diện.

API sản phẩm nhận thêm `skus` để lưu nhiều dòng trong một transaction. Khi PATCH danh sách SKU đã có, giữ toàn bộ ID/revision từ API admin và chỉ gửi metadata; không gửi tồn cũ. Dòng chuyển từ SKU đơn dùng `base:true`, không gửi tồn. API biến thể cũ nhận thêm `image`, kế thừa ảnh sản phẩm khi tạo qua client cũ không gửi trường này. CSV hiện có vẫn là CSV sản phẩm, chưa phải công cụ nhập nhiều dòng SKU/ảnh.

- `npm test`: kiểm tra ba ảnh/SKU, chống trùng/ảnh nguy hiểm, rollback, phân quyền, bán hàng đồng thời, hủy đơn cũ sau chuyển đổi và migration không ghi đè ảnh đã sửa.
- `npm run test:skus`: trình duyệt kiểm tra một SKU mặc định, thêm/xóa dòng mới, tải nhiều ảnh đồng thời, lưu/sửa sản phẩm, chuyển SKU cũ, chọn màu hết hàng, ảnh giỏ hàng và checkout.
