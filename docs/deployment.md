# Đưa Super Net lên tên miền riêng

Bộ triển khai này dành cho **một VPS Linux Ubuntu 24.04**, Docker Engine + Compose plugin, một instance Node 24 và SQLite. Với ngân sách máy chủ dưới 200.000đ/tháng, tìm gói khởi đầu 1 vCPU, 1 GB RAM, SSD từ 25 GB, IP công khai cố định; ưu tiên 2 GB RAM nếu giá phù hợp. Chọn vị trí Việt Nam hoặc Singapore, kiểm tra giá gồm VAT và giá gia hạn. Khi có nhiều khách đồng thời cần đo tải để nâng gói. Nhà cung cấp và chi phí cần chọn khi mua; mã nguồn không gắn với một nhà cung cấp.

`Dockerfile` đóng gói ứng dụng; `deploy/compose.yaml` chạy ứng dụng cùng Caddy để tự cấp/gia hạn HTTPS. Database và uploads dùng chung volume bền vững; bản sao lưu và chứng chỉ có volume riêng. Ứng dụng chạy bằng user `node`, filesystem hệ thống chỉ đọc. Chưa có tên miền/VPS thì chưa thể xác minh website công khai hay cấp chứng chỉ thật.

## 1. Chuẩn bị tài khoản, DNS và máy chủ

- Chủ cửa hàng tự đứng tên mua tên miền/VPS và giữ quyền quản lý, thanh toán.
- Trỏ bản ghi **A** của đúng tên miền sử dụng (ví dụ `shop.congty.vn`) đến IPv4 VPS. Chỉ tạo **AAAA** khi IPv6 thực sự hoạt động. Nếu dùng Cloudflare DNS, bắt đầu ở chế độ **DNS only** để kiểm tra trực tiếp.
- Cho phép cổng TCP 80/443 và cổng SSH trong firewall nhà cung cấp/máy chủ. Bộ này dùng mạng host trên Linux; Node chỉ nghe `127.0.0.1:3000`. Không cần mở cổng 3000. VPS chưa chạy dịch vụ khác trên 80/443/3000.
- Cài Docker Engine và Compose plugin theo [hướng dẫn chính thức cho Ubuntu](https://docs.docker.com/engine/install/ubuntu/), kiểm tra `docker version` và `docker compose version`.

## 2. Chuẩn bị cấu hình

Đưa repo vào `/opt/Sn-ecom` (clone hoặc tải mã từ GitHub). Nếu repo riêng tư, dùng SSH deploy key chỉ đọc; không lưu token trong URL hoặc Git. Các lệnh dưới chạy bằng tài khoản có quyền Docker trên VPS; có thể cần `sudo` tùy cách cài.

```sh
cd /opt/Sn-ecom/deploy
cp .env.example .env
chmod 600 .env
nano .env
```

Đổi `SITE_DOMAIN` thành **một hostname thật**, không có `https://`, đường dẫn hoặc dấu `/` cuối. Compose tự đặt `APP_ORIGIN=https://<hostname>`, production và trusted proxy loopback. Các khóa email/tích hợp tùy chọn chỉ đặt trong `.env` trên server. Tệp này được ignore khỏi Git và Docker image.

```sh
docker compose config --quiet
docker compose build app
```

## 3. Chọn dữ liệu trước lần chạy đầu

**Giữ dữ liệu đang nhập trên máy Windows:** dừng website trên Windows, tạo bản sao lưu bằng `npm run backup -- D:\SuperNet-backups`. Chuyển nội dung một bản sao lưu (`store.sqlite` và `uploads/` nếu có) qua SFTP/SSH vào thư mục riêng `/srv/supernet-import` trên VPS. Bảo vệ thư mục này; không đưa DB lên Git hay thư mục website công khai.

Trước khi chạy ứng dụng lần đầu, nhập vào volume mới bằng lệnh sau. Lệnh từ chối nếu volume đã có DB, không ghi đè cửa hàng đang tồn tại:

```sh
docker compose run --rm --no-deps --user root --cap-add CHOWN --cap-add DAC_OVERRIDE \
  --volume /srv/supernet-import:/import:ro app sh -ec '
    test -f /import/store.sqlite
    test ! -e /var/lib/supernet/store.sqlite
    cp /import/store.sqlite /var/lib/supernet/store.sqlite
    if test -d /import/uploads; then cp -r /import/uploads /var/lib/supernet/; fi
    chown -R node:node /var/lib/supernet
  '
```

Sau khi nhập, chạy integrity check trước khi mở website:

```sh
docker compose run --rm --no-deps app node --input-type=module -e "import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync('/var/lib/supernet/store.sqlite');const result=db.prepare('PRAGMA integrity_check').get();db.close();if(result.integrity_check!=='ok')throw Error('Database integrity check failed');console.log('Database integrity: ok');"
```

Tài khoản quản trị, mật khẩu, sản phẩm và cấu hình cũ được giữ nếu nhập đúng bản sao lưu. Không cần tạo lại tài khoản.

**Bắt đầu cửa hàng mới:** bỏ qua bước nhập. Lần khởi động đầu tạo dữ liệu mẫu như bản local; cần thay/ẩn sản phẩm mẫu trước khi nhận đơn thật.

## 4. Mở website và kiểm tra

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=80 app proxy
curl --fail https://TEN-MIEN-CUA-BAN/healthz
```

Thay `TEN-MIEN-CUA-BAN` bằng hostname đã cấu hình. Health trả `{"status":"ok"}` sau khi DNS và HTTPS hoạt động. Caddy tự chuyển HTTP sang HTTPS. Nếu lỗi cấp chứng chỉ, kiểm tra DNS, IPv6, firewall và log proxy; không tắt kiểm tra TLS.

Nếu tạo cửa hàng mới, cấp admin trong terminal tương tác:

```sh
docker compose exec app npm run admin
```

Đăng nhập trên HTTPS → mục Quản trị. Kiểm tra mở ảnh, đăng nhập/đăng xuất, thêm SKU, tạo đơn thử COD và hủy đơn để đối chiếu kho. Kiểm tra ở điện thoại dùng mạng 4G/5G. Cấu hình ngân hàng/địa chỉ/liên hệ/phí giao trong admin. Chuyển khoản đối soát thủ công; MoMo/ZaloPay vẫn chưa tích hợp.

Nếu bật email, đặt `EMAIL_API_KEY` và `EMAIL_FROM` đã xác minh trong `.env`, chạy `docker compose up -d` để nạp lại, rồi thử một thư bằng:

```sh
docker compose exec -T app npm run outbox
```

Chỉ lên lịch worker sau khi đã cấu hình email và kiểm tra nhận thư; không có khóa thì worker không gửi. Có thể đặt cron mỗi phút: `cd /opt/Sn-ecom/deploy && flock -n /var/lock/supernet-outbox.lock docker compose exec -T app npm run outbox`. Chỉ một worker cho DB này. Đặt `npm run maintenance` theo lịch ngày bằng cùng cách gọi; ứng dụng đã xử lý đơn hết hạn mỗi phút.

## 5. Sao lưu, cập nhật và phục hồi

```sh
cd /opt/Sn-ecom/deploy
docker compose exec -T app npm run backup -- /backups
```

Backup tạo thư mục theo thời gian chứa SQLite nhất quán và uploads. Để tải bản sao ra máy khác:

```sh
mkdir -p /srv/supernet-exports
chmod 700 /srv/supernet-exports
docker compose cp app:/backups/. /srv/supernet-exports
```

Tải qua SFTP/SSH về nơi lưu độc lập, đặt lịch sao lưu hằng ngày và theo dõi dung lượng/retention. Volume backup cùng VPS chỉ bảo vệ trước một số lỗi thao tác, không bảo vệ khi mất VPS. Giữ `.env` trong nơi lưu bí mật riêng.

Cập nhật sau khi đã tạo và tải backup:

```sh
cd /opt/Sn-ecom
git pull --ff-only origin main
cd deploy
docker compose up -d --build
docker compose ps
```

Giữ nguyên project name `supernet` và các named volume; **không dùng `docker compose down -v`**, vì tùy chọn `-v` xóa dữ liệu. Không chạy nhiều instance cùng SQLite.

Khi phục hồi: dừng cả app/proxy và tác vụ worker; giữ nguyên volume hiện tại làm bản dự phòng, tạo volume dữ liệu mới và nhập `store.sqlite` + `uploads/` từ cùng một backup bằng bước 3; sửa mount dữ liệu trỏ volume mới. Kiểm tra integrity rồi mới khởi động và thử đơn. Không trộn WAL/SHM cũ với DB backup.

## Kiểm chứng bộ đóng gói

Trên máy phát triển có Docker:

```sh
docker build -t supernet-store:local .
npm run test:deployment
```

Bài smoke tự tạo/xóa container và volume thử, kiểm tra user không phải root, filesystem chỉ đọc, cookie production, Origin, tải ảnh Sharp, giữ tài khoản/sản phẩm/ảnh khi tạo lại container và tạo backup. Không đọc `data/` thật, không gửi email/thanh toán thật. Chứng chỉ công khai và DNS cần kiểm tra riêng trên tên miền thực tế.
