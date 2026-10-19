# Demo miễn phí trên Windows bằng Cloudflare Tunnel

Chạy website trên máy Windows của bạn, rồi chia sẻ đường dẫn HTTPS do Cloudflare cấp. Không cần mua hosting, tên miền, tài khoản Cloudflare hoặc thẻ thanh toán. Máy phải bật, có Internet và giữ cửa sổ demo mở; đường dẫn thường thay đổi mỗi lần chạy. Đây là bản demo, chưa phải dịch vụ hoạt động liên tục.

## Chuẩn bị một lần

Cần Node.js 24 trở lên và Git. Mở PowerShell, chạy riêng từng dòng:

```powershell
cd D:\AI\Sn-ecom
git pull --ff-only origin main
npm.cmd ci
winget install --id Cloudflare.cloudflared --exact --source winget
```

Thay `D:\AI\Sn-ecom` bằng thư mục repo trên máy bạn. Nếu cloudflared đã được cài thì bỏ qua dòng winget. Sau khi cài xong, **đóng PowerShell và mở cửa sổ PowerShell mới** để nhận PATH mới. Không cần thay đổi ExecutionPolicy; dùng `npm.cmd` tránh lỗi chặn `npm.ps1`.

Kiểm tra:

```powershell
node --version
cloudflared --version
```

Nếu máy không có winget, dùng [bản cloudflared chính thức](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/), đặt `cloudflared.exe` vào thư mục có trong PATH, rồi mở lại PowerShell. Không cần chạy `cloudflared tunnel login`.

## Tạo admin cho demo

Trong cửa sổ PowerShell mới:

```powershell
cd D:\AI\Sn-ecom
npm.cmd run demo:admin
```

Nhập email và mật khẩu từ 12 ký tự. Mật khẩu không hiện ký tự khi gõ; nhập xong nhấn Enter. Không có tài khoản/mật khẩu mặc định. Chỉ cần tạo một lần; nếu email đã tồn tại thì công cụ giữ nguyên tài khoản.

Demo dùng DB và ảnh riêng ở **`data/demo/`**, được Git bỏ qua. Tài khoản admin trong website cũ ở `data/` không tự chuyển sang demo. Dữ liệu ban đầu có 16 sản phẩm mẫu; bạn có thể biên tập ở trang quản trị demo. Mỗi lần dừng/chạy lại vẫn giữ dữ liệu demo, không đặt lại mật khẩu hoặc đơn hàng.

## Mở demo và lấy link chia sẻ

```powershell
npm.cmd run demo
```

Công cụ tự:

1. Kiểm tra cổng 3030 và tìm cloudflared.
2. Yêu cầu Cloudflare cấp đường dẫn HTTPS ngẫu nhiên.
3. Khởi động website với `APP_ORIGIN` chính xác, cookie Secure, bind localhost và chỉ tin proxy loopback.
4. Kiểm tra website nội bộ và `/healthz` qua đường dẫn công khai.
5. In **Link demo** và đường dẫn **Quản trị** khi kiểm tra thành công.

**Mở link vừa in bằng trình duyệt**, hoặc gửi cho tester. Không dán riêng URL vào PowerShell như một lệnh. Để đăng nhập admin, mở link demo → **Tài khoản**, đăng nhập bằng tài khoản vừa tạo → **Quản trị** (`/#admin`). Người xem không cần biết tài khoản admin để duyệt sản phẩm hoặc đặt đơn thử.

Giữ PowerShell mở trong lúc demo. Nhấn **Ctrl+C** để dừng cả website và tunnel. Lần chạy sau dùng lại `npm.cmd run demo`, rồi chia sẻ link mới. Link cũ không phải địa chỉ cố định.

Không cần chạy thêm `npm run dev` hay đặt thủ công `APP_ORIGIN`. Website đang chạy cổng 3000 có thể tiếp tục dùng riêng. Nếu cổng 3030 đang bị dùng:

```powershell
npm.cmd run demo -- --port 3031
```

## Những gì dùng được trong bản miễn phí

- Danh mục, tìm kiếm, tài khoản, giỏ hàng, đặt đơn COD, quản trị, tồn kho và ảnh tải lên dùng DB demo thật.
- Bộ chọn vi/en/zh-TW dùng nhãn dịch có sẵn. Khi chưa có dịch vụ dịch, nội dung sản phẩm giữ ngôn ngữ gốc.
- Lệnh demo không dùng khóa email, AI, dịch tự động, VNPay hoặc token tunnel có sẵn trong môi trường; các dịch vụ tính phí không tự kích hoạt. Email khôi phục/xác minh chưa được gửi; trợ lý dùng tra cứu danh mục. Không chạy worker email cho DB demo.
- Các đơn dùng để kiểm thử; không nhập thông tin chuyển khoản nhận tiền thật vào bản demo. Không chia sẻ mật khẩu admin với người chỉ cần xem website.

## Khi gặp lỗi

- **Không tìm thấy cloudflared:** cài bằng winget và mở PowerShell mới; kiểm tra `cloudflared --version`.
- **Không cấp được link / timeout:** kiểm tra Internet, VPN hoặc mạng cơ quan có chặn Cloudflare không. Công cụ đóng các tiến trình nó đã mở khi lỗi; không tự tắt chương trình khác.
- **Link cũ không truy cập được:** đảm bảo máy không ngủ và cửa sổ demo còn chạy; dùng đúng link của lần chạy hiện tại.
- **Email admin đã tồn tại:** dùng tài khoản demo đã tạo; không xóa `data` để làm lại.
- **Đổi máy:** chuyển bản sao lưu nhất quán của `data/demo/store.sqlite` và `data/demo/uploads/`, không chỉ sao chép DB đang chạy ở chế độ WAL. Xem hướng dẫn backup trong README.

## Kiểm tra bản triển khai này

`npm test` bao gồm kiểm tra lệnh demo với website/SQLite thật và tunnel mô phỏng: Origin đúng/sai, cookie Secure/HttpOnly, phân quyền admin, đặt đơn COD, trừ tồn, giữ dữ liệu sau chạy lại, cổng đang dùng, lỗi khởi động, lỗi đường dẫn công khai và tunnel dừng giữa chừng. Không công khai site trong test tự động. Kết quả tại bản bổ sung công cụ demo: **60/60 test đạt**, Chromium mua hàng và admin đạt; mã băm nội dung 30 bảng của DB gốc không thay đổi.

Môi trường Codex hiện chặn truy cập dịch vụ cấp tunnel của Cloudflare (`403` từ proxy), nên chưa tạo được link Internet tại đây. PowerShell và binary cloudflared trên Windows cần chạy trên máy bạn; kết quả kiểm thử mô phỏng không thay thế bước mở link thật từ một thiết bị khác.
