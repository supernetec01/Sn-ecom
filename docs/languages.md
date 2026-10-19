# Ngôn ngữ website: Việt, Anh và Trung phồn thể

Thanh đầu trang có bộ chọn **Tiếng Việt / English / 繁體中文**. Tiếng Việt là mặc định, tiếng Trung dùng mã `zh-TW` (Đài Loan). Lựa chọn lưu trong localStorage (`sn-language`) và URL `?lang=en` hoặc `?lang=zh-TW`. Không tự chọn theo quốc gia/IP.

Đổi ngôn ngữ thay nội dung hiển thị tại chỗ, giữ giỏ hàng, bộ lọc, trang hiện tại, nội dung form và mã địa chỉ. Không thay giá VND hoặc quy đổi tiền tệ. Mã SKU, đơn hàng, thông tin người nhận/ngân hàng, review và dữ liệu giao dịch không được gửi đến Google. Hồ sơ đơn lưu snapshot tiếng Việt; trang quản trị chỉnh nội dung gốc bằng tiếng Việt.

## Hai nguồn bản dịch

- **Nhãn giao diện** trong `public/i18n-copy.js`: menu, tìm kiếm, giỏ, checkout, đăng nhập và các thao tác khách hàng dùng bản dịch đi kèm, hoạt động không cần API key. Bổ sung ngôn ngữ/nhãn tại module này, không nhét bản dịch vào từng route nghiệp vụ.
- **Nội dung động công khai**: tên/mô tả/thông số sản phẩm, danh mục, banner, nội dung giới thiệu/bài viết được lấy từ DB ở backend, dịch bằng Google Cloud Translation Basic v2 khi cần. Nội dung gốc vẫn chỉ nhập một lần bằng tiếng Việt. Bản dịch là hỗ trợ đọc; thông số và chính sách quan trọng cần kiểm duyệt.

Khi thiếu khóa, hết hạn mức hoặc dịch vụ lỗi, nhãn giao diện vẫn đổi ngôn ngữ, phần nội dung chưa dịch giữ tiếng Việt; có dòng thông báo tương ứng. Không hiển thị nội dung mẫu như thể đã nhận bản dịch từ Google. Chính sách pháp lý/đổi trả/bảo hành không tự dịch: modal giữ nguyên bản tiếng Việt và có chú thích. Muốn công bố bản dịch chính sách cần bổ sung nội dung đã duyệt riêng.

## Cấu hình trên Windows PowerShell

Không cần key để dùng bộ chọn và nhãn giao diện:

```powershell
cd D:\AI\Sn-ecom
npm.cmd ci
npm.cmd run dev
```

Để dịch tự động nội dung sản phẩm:

1. Trong dự án Google Cloud của công ty, bật **Cloud Translation API** và cấu hình billing/quota theo tài khoản. Tạo API key giới hạn cho Cloud Translation API, thêm giới hạn IP server khi phù hợp. Không dùng giới hạn HTTP referrer của browser cho key backend. Kiểm tra giá/quota hiện hành tại nhà cung cấp.
2. Nếu chưa có `.env`, tạo bằng `Copy-Item .env.example .env`. Không ghi đè `.env` đã có. Mở `.env` trong trình soạn thảo và nhập key vào `TRANSLATION_API_KEY=`. Không gửi key qua chat, không đưa vào JS frontend hoặc Git.
3. Dừng máy chủ cũ bằng Ctrl+C, chạy lệnh đọc `.env`:

```powershell
node --env-file=.env --watch server.js
```

`npm run dev` hiện không tự đọc `.env`; cấu hình đã export trong môi trường process thì được nhận bình thường. Trên Codex cloud, nhập `TRANSLATION_API_KEY` qua Environment settings/Secrets; bản nháp đã khai báo đích `translation.googleapis.com`. Cần review/lưu và publish cấu hình để các tác vụ sau sử dụng. Hệ thống phải cho phép HTTPS tới hostname này; khi sử dụng egress proxy, chạy Node 24 với `--use-env-proxy` hoặc `NODE_USE_ENV_PROXY=1` theo hạ tầng. Trên Windows thông thường không cần proxy.

Biến tùy chọn: `TRANSLATION_DAILY_CHAR_LIMIT=100000`, giới hạn chung toàn cửa hàng mỗi ngày UTC; 0 tắt lượt dịch mới, bản cache vẫn dùng được. Đây là hạn mức ứng dụng theo ký tự gốc, không phải cam kết mức phí hóa đơn chính xác. Bật quota/ngân sách ở Google Cloud. Key chỉ được đọc trên server và gửi trong header HTTPS tới endpoint cố định.

## API, cache và kiểm soát chi phí

`POST /api/i18n/translate-page` nhận định danh, không nhận đoạn văn tự do:

```json
{
  "page_type": "product",
  "page_id": 1,
  "source_language": "vi",
  "target_language": "zh-TW"
}
```

`page_type` là `storefront`, `products` hoặc `product`; `product_ids` tối đa 24 ID cho danh sách. Chỉ đọc sản phẩm active và các trường công khai được whitelist. Từ chối text/URL/provider tùy ý, ngôn ngữ không hỗ trợ, loại trang tài khoản/đơn hàng. Có Origin check và CSRF khi đăng nhập, giới hạn 20 request/IP/phút cùng giới hạn chung API.

Mỗi lượt Google tối đa 100 chuỗi/20.000 ký tự gốc; frontend tải tiếp tối đa bốn lô cho mỗi nhóm nội dung. Trang quá lớn có thể chỉ dịch một phần, phần còn lại hiển thị gốc. Những nhãn có bản dịch đi kèm không gửi Google. Các request giống nhau đang xử lý dùng chung promise; sau lỗi có cooldown 30 giây. Abort ở browser ngăn response cũ đổi ngôn ngữ mới; lượt backend đã bắt đầu có thể tiếp tục và được tính vào quota.

Không cần Redis cho một instance hiện tại. Migration tự thêm ba bảng SQLite, không sửa bản ghi sản phẩm/khách/đơn:

| Bảng | Dữ liệu |
| --- | --- |
| translation_cache | Hash nội dung + brand/protection version, ngôn ngữ, bản dịch, hạn 30 ngày |
| translation_daily_budget | Lượng ký tự đã dành cho lượt gọi trong ngày UTC |
| translation_api_usage | Loại nội dung, ngôn ngữ, số ký tự, cache hit, trạng thái, thời điểm; không lưu text/key/dữ liệu cá nhân |

Khi nội dung được sửa, hash thay đổi nên cache cũ không được dùng cho text mới; bản cũ hết hạn được `npm run maintenance` dọn. Usage giữ 90 ngày, budget cũ 35 ngày khi chạy bảo trì. Lượt đã dành ngân sách không hoàn lại khi provider lỗi để hạn chế retry gây tốn phí. Backup SQLite hiện có bao gồm cache; không cần API key để đọc cache.

Tên thương hiệu, chữ số và token dạng SKU trong nội dung được bảo vệ bằng placeholder; thiếu hoặc lặp placeholder trong kết quả thì bỏ bản dịch chuỗi đó. Đây là danh sách bảo vệ ở ứng dụng, chưa tích hợp Google Advanced Glossary. Render dùng text node/attribute, không đưa HTML từ Google vào innerHTML, không sửa value của form, ID hoặc mã dữ liệu.

## Kiểm thử và giới hạn đã biết

```sh
npm test
npm run test:browser
npm run test:languages
```

Nếu dùng Chromium hệ thống trên Linux: `BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:languages`. Trên Windows có thể cài browser bằng `npx.cmd playwright install chromium` rồi `npm.cmd run test:languages`.

Test HTTP/service kiểm allowlist/quyền, cache và invalidation, budget, đồng thời, dữ liệu bảo vệ và fallback. Browser test dùng provider giả lập có kiểm soát, không gọi dịch vụ Google; kiểm ba ngôn ngữ, giữ form/giỏ, lưu lựa chọn, kết quả cũ, XSS và responsive. Chưa xác nhận bản dịch Google thật khi không có key. UI không cam kết mọi thông báo validation/backend hoặc nội dung tự do đã có bản dịch đi kèm.

SEO hiện vẫn dùng URL/canonical và HTML tiếng Việt. `?lang` hỗ trợ lựa chọn giao diện, chưa phải bộ URL `/en/`, `/zh-tw/` render bản dịch phía server/hreflang. Khi cần index riêng từng thị trường, triển khai và kiểm tra lớp SEO đó cùng bản dịch đã xuất bản; không tạo hreflang giả cho nội dung chưa có. Tính năng này dùng SQLite đang chạy, độc lập với schema PostgreSQL thiết kế trong tác vụ trước; chưa chuyển app sang PostgreSQL.
