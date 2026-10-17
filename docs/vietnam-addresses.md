# Địa chỉ giao hàng Việt Nam theo hai cấp

Website chỉ nhận địa chỉ giao tại Việt Nam. Checkout và sổ địa chỉ dùng **Tỉnh/thành phố → Phường/xã/đặc khu**, không yêu cầu quận/huyện. Đổi tỉnh sẽ xóa lựa chọn xã; dữ liệu trả về chậm của tỉnh cũ không ghi đè danh sách của tỉnh mới.

## Bộ dữ liệu đi kèm

- 34 tỉnh/thành phố, 3.321 đơn vị cấp xã (2.599 xã, 709 phường, 13 đặc khu).
- Phiên bản nguồn: `v5.2.0`, tạo ngày `2026-09-20T13:13:17Z`; metadata nguồn ghi nghị quyết mới nhất `388/NQ-UBTVQH16`.
- Nguồn: [ThangLeQuoc/vietnamese-provinces-database](https://github.com/ThangLeQuoc/vietnamese-provinces-database).
- Commit bất biến đã dùng: `8b78ba5118715e1fa81769286724db79346abf52`.
- Tệp nguồn: `json/full_json_generated_data_vn_units.json`; metadata: `json/vn_provinces_metadata.json` tại commit trên.
- Giấy phép MIT: [bản sao giấy phép](licenses/vietnamese-provinces-database.txt).
- Bản rút gọn lưu tại `public/datasets/vietnam-addresses.json`, gồm mã chuỗi giữ số 0 đầu, tên đầy đủ, quan hệ tỉnh/xã và thông tin nguồn/checksum SHA-256.

Đây là bộ dữ liệu cộng đồng, không phải API chính thức do cửa hàng hay cơ quan nhà nước vận hành. README nguồn cho biết dựa trên danh mục hành chính và văn bản nhà nước, tham chiếu [danhmuchanhchinh.nso.gov.vn](https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx). Môi trường hiện không truy cập được API địa chỉ ngoài danh sách mạng cho phép; đã lấy snapshot qua GitHub, kiểm tra toàn bộ mã và quan hệ. Không khẳng định đã đồng bộ trực tiếp với cổng nhà nước tại thời điểm khách mua hàng. Cần rà soát nguồn khi có thay đổi hành chính sau ngày snapshot.

## Cách phục vụ và kiểm tra

Các danh sách được đọc từ tệp trong ứng dụng, không cần khóa API hay truy cập Internet khi khách chọn địa chỉ:

- `GET /api/locations/provinces`: metadata và danh sách tỉnh/thành phố.
- `GET /api/locations/provinces/:code/wards`: chỉ các đơn vị cấp xã thuộc tỉnh đó.

Máy chủ chỉ nhận cặp `province_code` và `ward_code` hợp lệ. `country` nếu gửi phải là `VN`; mã tỉnh/xã nước ngoài, mã không tồn tại và xã thuộc tỉnh khác bị từ chối ở cả báo phí, đặt đơn và lưu địa chỉ. Tên tỉnh/xã do máy chủ lấy từ dữ liệu, không tin tên hoặc vùng do client gửi. Phí giao theo vùng hiện có được so với tên tỉnh/thành chuẩn (tên ngắn hoặc đầy đủ).

Khách nhập riêng số nhà, tên đường, thôn/ấp (3–400 ký tự). Sổ địa chỉ lưu mã/tên tỉnh/xã, phần địa chỉ chi tiết và phiên bản dữ liệu. Đơn hàng chụp tên và mã tại lúc đặt, đồng thời lưu địa chỉ đầy đủ để nhân viên giao hàng đọc được. Sau này sửa danh mục không tự đổi địa chỉ của đơn đã đặt.

## Địa chỉ cũ

Migration chỉ thêm trường dữ liệu; không xóa địa chỉ hoặc đơn cũ, không tự đoán mã từ chuỗi địa chỉ. Địa chỉ cũ chưa có cặp mã hợp lệ được gắn `needs_update`. Khi khách chọn để đặt đơn mới, website giữ thông tin liên hệ/địa chỉ chi tiết và yêu cầu chọn lại tỉnh/xã. Có thể lưu địa chỉ mới rồi xóa địa chỉ cũ ở Hồ sơ & bảo mật.

API client cũ cần gửi thêm mã tỉnh/xã; các request tạo mới chỉ có `region` dạng chữ không còn được chấp nhận. Đây là thay đổi có chủ ý để áp dụng phạm vi giao hàng Việt Nam. Sửa tên trong trường địa chỉ chi tiết không phải cách đổi tỉnh/xã, phải dùng danh sách.

## Cập nhật snapshot

```sh
npm run addresses:update
npm test
BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser
```

Lệnh hiện tái tạo snapshot từ commit đã ghim, không tải nhánh mới tùy ý. Muốn nâng phiên bản: kiểm tra release/văn bản nguồn, sửa commit và số lượng/phiên bản dự kiến trong `scripts/update-vietnam-addresses.js`, chạy lệnh, review diff, cập nhật kiểm thử/tài liệu rồi triển khai. Script giữ kiểm tra TLS, mã trùng và quan hệ tỉnh/xã. Node `--use-env-proxy` hỗ trợ mạng proxy; runtime ứng dụng vẫn không cần mạng ngoài.
