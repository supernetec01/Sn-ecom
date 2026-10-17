# Font chữ giao diện

Website dùng **Be Vietnam Pro**, được thiết kế hỗ trợ tiếng Việt, với bốn độ đậm 400, 500, 600 và 700. Các tệp WOFF2 được lưu cùng ứng dụng trong `public/fonts/`; trình duyệt không cần kết nối Google Fonts hoặc dịch vụ font bên ngoài.

Nguồn chính thức: [Google Fonts — Be Vietnam Pro](https://github.com/google/fonts/tree/main/ofl/bevietnampro). Bản quyền: © 2021 The Be Vietnam Pro Project Authors. Giấy phép **SIL Open Font License 1.1** được giữ nguyên tại `public/fonts/OFL.txt`.

Các tệp TTF Regular, Medium, SemiBold và Bold được lấy từ thư mục nguồn trên rồi mã hóa sang WOFF2 bằng FontTools, giữ nguyên tập ký tự và thiết kế chữ. Đã kiểm tra các dấu tiếng Việt và ký hiệu đồng `₫` trong cả bốn độ đậm. Chữ đậm không được giả lập bằng CSS.

Font được khai báo bằng `@font-face`, `font-display: swap`, kèm font hệ thống dự phòng; hai độ đậm thường dùng được preload. Khi phân phối lại font, giữ kèm giấy phép OFL.
