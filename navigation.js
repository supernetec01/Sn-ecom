// IDs identify the page behavior; all displayed copy is editable in administration.
export const defaultNavigation = {
 categoryLabel: 'Danh mục',
 allLabel: 'Tất cả sản phẩm',
 items: [
  {
   id: 'bestsellers', label: 'Bán chạy', enabled: true,
   title: 'Những lựa chọn được yêu thích', eyebrow: 'BÁN CHẠY',
   description: 'Khám phá sản phẩm từ các đơn hàng đã hoàn tất tại Super Net.',
   image: '/images/scene-kitchen.webp',
   body: 'Danh sách được sắp xếp theo số lượng sản phẩm trong các đơn hàng đã hoàn tất. Khi cửa hàng chưa có lịch sử phù hợp, danh sách sẽ được cập nhật sau. Cửa hàng cũng có thể chọn sản phẩm giới thiệu trong trang quản trị.',
   productIds: [],
  },
  {
   id: 'new', label: 'Sản phẩm mới', enabled: true,
   title: 'Thêm một lựa chọn cho mỗi ngày', eyebrow: 'SẢN PHẨM MỚI',
   description: 'Những sản phẩm được bổ sung gần đây cho căn bếp và không gian sống.',
   image: '/images/products/binh-giu-nhiet-everyday.webp',
   body: 'Tìm hiểu hình ảnh, thông số và hướng dẫn sử dụng trên từng trang sản phẩm để chọn món đồ phù hợp với nhu cầu của bạn.',
   productIds: [],
  },
  {
   id: 'promotions', label: 'Khuyến mãi', enabled: true,
   title: 'Ưu đãi đang được cập nhật', eyebrow: 'KHUYẾN MÃI',
   description: 'Theo dõi thông tin ưu đãi được cửa hàng công bố tại đây.',
   image: '/images/products/hop-bao-quan-fresh-box.webp',
   body: 'Hiện chưa có chương trình khuyến mãi được công bố. Các sản phẩm được giới thiệu tại trang này không tự động được giảm giá; giá và điều kiện mua hàng được hiển thị trên từng sản phẩm và khi đặt hàng.',
   productIds: [],
  },
  {
   id: 'events', label: 'Sự kiện', enabled: true,
   title: 'Hẹn bạn ở những trải nghiệm mới', eyebrow: 'SỰ KIỆN SUPER NET',
   description: 'Không gian cập nhật hoạt động và thông tin mới từ Super Net.',
   image: '/images/scene-living.webp',
   body: 'Lịch sự kiện đang được cập nhật. Thời gian, địa điểm và cách tham gia sẽ được công bố khi có hoạt động chính thức. Bạn có thể liên hệ cửa hàng qua thông tin ở chân trang để được hỗ trợ.',
   productIds: [],
  },
  {
   id: 'stores', label: 'Cửa hàng', enabled: true,
   title: 'Kết nối cùng Super Net', eyebrow: 'THÔNG TIN CỬA HÀNG',
   description: 'Tìm thông tin liên hệ và được hỗ trợ trước khi mua sắm.',
   image: '/images/scene-kitchen.webp',
   body: 'Danh sách địa điểm và giờ mở cửa đang được cập nhật. Vui lòng liên hệ theo thông tin của cửa hàng ở chân trang để xác nhận địa chỉ và thời gian trước khi đến. Bạn cũng có thể đặt hàng trực tiếp trên website.',
   productIds: [],
  },
  {
   id: 'franchise', label: 'Nhượng quyền', enabled: true,
   title: 'Cùng tìm hiểu cơ hội hợp tác', eyebrow: 'HỢP TÁC CÙNG SUPER NET',
   description: 'Thông tin về hợp tác và nhượng quyền sẽ được công bố tại đây.',
   image: '/images/scene-living.webp',
   body: 'Chương trình nhượng quyền chưa được kích hoạt. Chính sách, điều kiện và quy trình hợp tác đang được cập nhật. Vui lòng liên hệ Super Net qua thông tin chính thức ở chân trang nếu bạn muốn trao đổi về hợp tác.',
   productIds: [],
  },
  {
   id: 'rewards', label: 'Super Net Rewards', enabled: true,
   title: 'Gắn kết từ những điều nhỏ', eyebrow: 'SUPER NET REWARDS',
   description: 'Không gian dành cho thông tin chương trình khách hàng thân thiết.',
   image: '/images/products/coc-su-morning.webp',
   body: 'Chương trình Super Net Rewards chưa được kích hoạt. Website hiện chưa tích điểm, xếp hạng thành viên hoặc đổi quà. Quyền lợi và điều kiện tham gia sẽ được công bố khi chương trình chính thức bắt đầu.',
   productIds: [],
  },
 ],
};

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).sort().join() === [...keys].sort().join();
const text = (value, max) => typeof value === 'string' && value.length <= max;
const image = value => text(value, 2000) && (value === '' || /^\/(?!\/)[\w./-]+$/.test(value) || /^https:\/\/[^\s]+$/.test(value));
const itemKeys = ['id', 'label', 'enabled', 'title', 'eyebrow', 'description', 'image', 'body', 'productIds'];
const navigationIds = new Set(defaultNavigation.items.map(item => item.id));

export function navigationValid(value) {
 if (!exactKeys(value, ['categoryLabel', 'allLabel', 'items']) || !text(value.categoryLabel, 100) || !value.categoryLabel.trim() || !text(value.allLabel, 100) || !value.allLabel.trim()) return false;
 if (!Array.isArray(value.items) || value.items.length !== navigationIds.size) return false;
 const seen = new Set();
 return value.items.every(item => {
  if (!exactKeys(item, itemKeys) || !navigationIds.has(item.id) || seen.has(item.id)) return false;
  seen.add(item.id);
  if (typeof item.enabled !== 'boolean' || !text(item.label, 100) || !item.label.trim() || !text(item.title, 300) || !text(item.eyebrow, 200) || !text(item.description, 2000) || !text(item.body, 10000) || !image(item.image)) return false;
  return Array.isArray(item.productIds) && item.productIds.length <= 200 && new Set(item.productIds).size === item.productIds.length && item.productIds.every(id => Number.isSafeInteger(id) && id > 0 && id <= 1e9);
 });
}
