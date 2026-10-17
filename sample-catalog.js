// Fictional Super Net products for previewing the storefront. Replace before selling.
const product = (slug, name, category, price, stock, description, details) => {
  const image = `/images/products/${slug}.webp`;
  return {
    name, category, price, stock, description, image, active: 1,
    details: { ...details, gallery: [image], is_sample: true },
  };
};

export const sampleCatalog = [
  product('binh-giu-nhiet-everyday', 'Bình giữ nhiệt Everyday', 'Phong cách sống', 329000, 20,
    'Mang theo thức uống yêu thích từ bàn làm việc đến những buổi dạo phố. Everyday có dáng bình gọn, bề mặt mờ dễ phối cùng đồ dùng hằng ngày và nắp vặn thuận tiện. Miệng bình rộng giúp thêm đá và vệ sinh dễ dàng hơn. Một lựa chọn tinh giản cho nhịp sống năng động.', {
      sku: 'SN-LS-001', summary: 'Một ngụm tươi mới, đồng hành cả ngày.', material: 'Thân inox 304, nắp nhựa PP, gioăng silicone', dimensions: '7 × 7 × 23 cm', capacity: '500 ml', color: 'Xanh biển', badge: 'Bộ sưu tập mới',
      features: ['Thiết kế hai lớp cho thức uống nóng hoặc lạnh', 'Nắp vặn có gioăng silicone tháo rời', 'Miệng bình rộng, dễ thêm đá và làm sạch'],
      specifications: [{ label: 'Kiểu nắp', value: 'Nắp vặn' }, { label: 'Khối lượng tham khảo', value: '310 g' }, { label: 'Bộ sản phẩm', value: '1 bình, 1 nắp' }],
      care: 'Rửa bằng tay với miếng bọt biển mềm; mở nắp để khô hoàn toàn. Không dùng trong lò vi sóng. Không đựng đồ uống có ga trong bình đóng kín.',
    }),
  product('hop-bao-quan-fresh-box', 'Hộp bảo quản Fresh Box', 'Nhà bếp', 159000, 30,
    'Sắp xếp phần rau củ đã sơ chế, trái cây hoặc đồ khô trong một chiếc hộp dễ quan sát. Fresh Box có thân trong suốt và nắp gài bốn phía, phù hợp chuẩn bị bữa ăn cũng như tổ chức lại tủ lạnh. Các cạnh bo tròn giúp thao tác và vệ sinh thuận tiện.', {
      sku: 'SN-KT-001', summary: 'Tủ lạnh ngăn nắp, chuẩn bị bữa ăn nhẹ nhàng hơn.', material: 'Thân nhựa Tritan, nắp PP, gioăng silicone', dimensions: '17 × 12 × 7 cm', capacity: '800 ml', color: 'Trong suốt / xanh', badge: 'Gợi ý cho căn bếp',
      features: ['Thân trong suốt dễ nhận biết thực phẩm', 'Bốn khóa gài và gioăng tháo rời', 'Dáng chữ nhật giúp sắp xếp gọn trong tủ'],
      specifications: [{ label: 'Kiểu hộp', value: 'Chữ nhật, 4 khóa gài' }, { label: 'Bộ sản phẩm', value: '1 hộp, 1 nắp' }, { label: 'Công dụng', value: 'Bảo quản thực phẩm trong ngăn mát hoặc đồ khô' }],
      care: 'Rửa sạch trước lần dùng đầu tiên. Không đặt sát nguồn nhiệt; không dùng trong lò nướng. Để thực phẩm nguội trước khi đóng nắp.',
    }),
  product('dung-cu-bep-essential', 'Bộ dụng cụ nhà bếp Essential', 'Nhà bếp', 249000, 15,
    'Từ đảo rau, múc canh đến trộn sốt, bộ Essential tập hợp những dụng cụ thường dùng trong căn bếp hằng ngày. Đầu silicone mềm kết hợp tay cầm gỗ tạo cảm giác ấm áp và gọn mắt khi treo cạnh bếp. Bộ năm món phù hợp cho một góc bếp mới hoặc làm quà tân gia.', {
      sku: 'SN-KT-002', summary: 'Năm trợ thủ nhỏ cho những bữa cơm nhà.', material: 'Đầu silicone, tay cầm gỗ', dimensions: 'Chiều dài dụng cụ 28–32 cm', capacity: 'Bộ 5 món', color: 'Kem / gỗ tự nhiên', badge: '',
      features: ['Gồm sạn, vá canh, muỗng, phới và cọ quét', 'Đầu dụng cụ mềm phù hợp thao tác nhẹ nhàng', 'Tay cầm có lỗ treo, tiện cất giữ'],
      specifications: [{ label: 'Số lượng', value: '5 dụng cụ' }, { label: 'Kiểu tay cầm', value: 'Gỗ có lỗ treo' }, { label: 'Gợi ý sử dụng', value: 'Nấu ăn, trộn và chia thức ăn' }],
      care: 'Rửa tay và lau khô phần cán gỗ sau mỗi lần dùng. Không ngâm lâu, không để dụng cụ nằm trong nồi đang đun; tránh tiếp xúc trực tiếp với lửa.',
    }),
  product('den-ban-minimal', 'Đèn bàn Minimal', 'Đồ gia dụng', 459000, 10,
    'Một điểm sáng dịu mắt cho bàn làm việc hay chiếc bàn nhỏ cạnh giường. Minimal có chân đế tròn, thân thanh mảnh và chụp đèn hướng xuống, tạo khoảng sáng tập trung cho những trang sách. Màu kem trung tính dễ kết hợp cùng nội thất gỗ và các không gian hiện đại.', {
      sku: 'SN-HM-001', summary: 'Dành một khoảng sáng cho những điều bạn yêu thích.', material: 'Thân và chụp kim loại sơn phủ', dimensions: 'Đế 15 cm, cao 38 cm', capacity: '1 bóng LED E27', color: 'Kem ấm', badge: 'Góc sống mới',
      features: ['Chụp đèn hướng sáng xuống mặt bàn', 'Công tắc trên dây thuận tiện thao tác', 'Chân đế tròn nhỏ gọn cho bàn làm việc'],
      specifications: [{ label: 'Nguồn điện', value: '220 V / 50 Hz' }, { label: 'Đui đèn', value: 'E27, dùng bóng LED tối đa 9 W' }, { label: 'Bộ sản phẩm', value: '1 đèn; bóng đèn không kèm theo' }],
      care: 'Rút điện trước khi vệ sinh hoặc thay bóng. Lau bằng khăn khô mềm, dùng trong nhà và tránh nước. Thông số điện là dữ liệu minh họa, cần xác nhận trước khi mở bán.',
    }),
  product('noi-inox-harmony', 'Nồi inox Harmony 20 cm', 'Nhà bếp', 589000, 18,
    'Một chiếc nồi vừa vặn cho món canh, mì hay phần súp cuối tuần. Harmony có thân inox sáng, vung kính giúp quan sát món ăn và hai quai cầm cân đối. Dáng nồi đơn giản mang lại cảm giác gọn gàng cho gian bếp, từ lúc chuẩn bị đến khi dọn lên bàn.', {
      sku: 'SN-KT-003', summary: 'Vừa vặn cho món ngon của gia đình nhỏ.', material: 'Thân inox 304, vung kính, quai inox', dimensions: 'Đường kính 20 cm, cao 11 cm', capacity: '3 lít', color: 'Inox bạc', badge: '',
      features: ['Vung kính dễ quan sát trong khi nấu', 'Hai quai cầm cân đối', 'Lòng nồi trơn thuận tiện vệ sinh'],
      specifications: [{ label: 'Đường kính', value: '20 cm' }, { label: 'Loại bếp', value: 'Bếp từ, bếp gas, bếp hồng ngoại' }, { label: 'Bộ sản phẩm', value: '1 nồi, 1 vung kính' }],
      care: 'Dùng lửa vừa; tránh đun nồi rỗng. Quai có thể nóng khi nấu, hãy dùng găng tay. Để nguội trước khi rửa và tránh chất tẩy mài mòn.',
    }),
  product('chao-chong-dinh-daily', 'Chảo chống dính Daily 24 cm', 'Nhà bếp', 369000, 24,
    'Chuẩn bị bữa sáng nhanh hay một phần rau xào cho bữa tối với chiếc chảo cỡ vừa Daily. Lòng chảo rộng, thành thoải và tay cầm dài hỗ trợ thao tác quen tay. Tông kem nhẹ nhàng tạo điểm nhấn cho góc bếp hiện đại.', {
      sku: 'SN-KT-004', summary: 'Bữa sáng thong thả bắt đầu từ căn bếp.', material: 'Thân nhôm phủ chống dính, tay cầm nhựa phenolic', dimensions: 'Đường kính 24 cm, cao 5 cm', capacity: 'Phù hợp phần ăn 1–3 người', color: 'Kem', badge: 'Mới',
      features: ['Lòng chảo rộng thuận tiện chiên và áp chảo', 'Tay cầm dài, có lỗ treo', 'Bề mặt phủ chống dính dễ làm sạch'],
      specifications: [{ label: 'Đường kính', value: '24 cm' }, { label: 'Loại bếp', value: 'Bếp từ, bếp gas, bếp hồng ngoại' }, { label: 'Bộ sản phẩm', value: '1 chảo, không kèm nắp' }],
      care: 'Dùng dụng cụ gỗ hoặc silicone. Không đun khô, tránh lửa lớn và không rửa khi chảo còn nóng. Thay mới khi lớp phủ bong tróc.',
    }),
  product('binh-nuoc-active', 'Bình nước Active', 'Phong cách sống', 189000, 35,
    'Đặt bình bên bàn làm việc, mang đến phòng tập hoặc bỏ vào túi đi dạo. Active có thân trong mờ, quai xách liền nắp và dung tích vừa cho thói quen uống nước hằng ngày. Một món đồ đơn giản để nhắc bạn dành thêm chút chăm sóc cho bản thân.', {
      sku: 'SN-LS-002', summary: 'Mang theo một thói quen tốt mỗi ngày.', material: 'Thân nhựa Tritan, nắp PP, gioăng silicone', dimensions: '8 × 8 × 25 cm', capacity: '750 ml', color: 'Xanh sage', badge: '',
      features: ['Quai xách liền nắp tiện mang theo', 'Thân trong mờ dễ quan sát lượng nước', 'Miệng rộng thuận tiện vệ sinh'],
      specifications: [{ label: 'Kiểu nắp', value: 'Nắp vặn có quai' }, { label: 'Khối lượng tham khảo', value: '180 g' }, { label: 'Bộ sản phẩm', value: '1 bình, 1 nắp' }],
      care: 'Dùng cho nước nguội hoặc nhiệt độ phòng. Không dùng trong lò vi sóng; vệ sinh bằng tay và để khô trước khi cất.',
    }),
  product('hop-com-bento', 'Hộp cơm Bento 2 ngăn', 'Nhà bếp', 279000, 22,
    'Một bữa trưa mang theo cũng có thể chỉn chu và đầy màu sắc. Bento chia không gian cho cơm và món ăn kèm trong một chiếc hộp gọn. Dây đai giữ nắp đi cùng tông xanh trầm giúp hộp nằm gọn trong túi xách, sẵn sàng cho ngày làm việc mới.', {
      sku: 'SN-KT-005', summary: 'Mang một chút bếp nhà đến giờ nghỉ trưa.', material: 'Thân và khay nhựa PP, gioăng silicone, dây đai vải', dimensions: '19 × 12 × 7 cm', capacity: '1.000 ml', color: 'Xanh navy', badge: 'Gợi ý mỗi ngày',
      features: ['Hai ngăn tách phần ăn thuận tiện', 'Dây đai vải giúp giữ nắp khi di chuyển', 'Khay tháo rời dễ vệ sinh'],
      specifications: [{ label: 'Số ngăn', value: '2 ngăn' }, { label: 'Bộ sản phẩm', value: '1 hộp, 1 khay chia, 1 nắp, 1 dây đai' }, { label: 'Lưu ý', value: 'Không phù hợp mang canh hoặc chất lỏng' }],
      care: 'Tháo nắp và dây đai trước khi hâm nếu hướng dẫn thực tế của sản phẩm cho phép. Dữ liệu mẫu chưa xác nhận khả năng dùng lò vi sóng. Rửa và làm khô sau sử dụng.',
    }),
  product('hu-thuy-tinh-pantry', 'Hũ thủy tinh Pantry', 'Nhà bếp', 119000, 40,
    'Cho góc bếp thêm sáng thoáng với những nguyên liệu được sắp xếp trong hũ thủy tinh. Pantry phù hợp đựng yến mạch, hạt, trà hoặc mì khô. Nắp gỗ và thân trong tạo cảm giác ấm áp trên kệ mở, đồng thời giúp nhận biết món đồ bạn cần chỉ bằng một ánh nhìn.', {
      sku: 'SN-KT-006', summary: 'Góc nguyên liệu gọn gàng và đẹp mắt.', material: 'Thân thủy tinh, nắp tre, gioăng silicone', dimensions: 'Đường kính 10 cm, cao 16 cm', capacity: '1.000 ml', color: 'Trong suốt / tre tự nhiên', badge: '',
      features: ['Thân trong dễ nhận biết nguyên liệu', 'Nắp tre có gioăng tháo rời', 'Dáng trụ gọn trên kệ và trong ngăn tủ'],
      specifications: [{ label: 'Kiểu nắp', value: 'Nắp đậy bằng tre' }, { label: 'Gợi ý sử dụng', value: 'Đựng đồ khô' }, { label: 'Bộ sản phẩm', value: '1 hũ, 1 nắp' }],
      care: 'Chỉ đựng nguyên liệu khô; làm khô hoàn toàn trước khi sử dụng. Lau nắp tre bằng khăn ẩm và để thoáng, không ngâm trong nước.',
    }),
  product('bo-dao-precision', 'Bộ dao nhà bếp Precision', 'Nhà bếp', 399000, 16,
    'Bộ ba dụng cụ cắt cơ bản cho việc chuẩn bị rau củ, trái cây và món ăn thường ngày. Precision gồm dao bếp, dao gọt và kéo, có tay cầm tối màu và kiểu dáng đồng nhất. Cất gọn trong ngăn riêng để giữ góc chuẩn bị thực phẩm ngăn nắp.', {
      sku: 'SN-KT-007', summary: 'Chuẩn bị nguyên liệu gọn gàng, nấu ăn thêm hứng khởi.', material: 'Lưỡi thép không gỉ, cán nhựa PP', dimensions: 'Dao bếp 30 cm; dao gọt 20 cm; kéo 21 cm', capacity: 'Bộ 3 món', color: 'Đen / inox', badge: '',
      features: ['Gồm dao bếp, dao gọt và kéo nhà bếp', 'Tay cầm có độ cong thuận tiện cầm nắm', 'Thiết kế đồng bộ cho góc chuẩn bị thực phẩm'],
      specifications: [{ label: 'Số lượng', value: '3 dụng cụ' }, { label: 'Phù hợp', value: 'Sơ chế rau củ, trái cây và thực phẩm' }, { label: 'Lưu ý', value: 'Không dùng chặt xương hoặc thực phẩm đông cứng' }],
      care: 'Dụng cụ sắc: để ngoài tầm với trẻ em. Rửa riêng từng món, lau khô ngay và cất ở vị trí an toàn. Dùng cùng thớt phù hợp.',
    }),
  product('am-sieu-toc-pure', 'Ấm siêu tốc Pure', 'Đồ gia dụng', 649000, 12,
    'Bắt đầu buổi sáng với nước nóng cho trà, cà phê hoặc bữa sáng nhanh. Pure có thân màu kem, quai cầm liền mạch và đế nguồn tách rời, mang đến một góc pha chế gọn mắt. Kiểu dáng bo tròn hài hòa với nhiều phong cách bếp.', {
      sku: 'SN-HM-002', summary: 'Ấm áp từ tách trà đầu ngày.', material: 'Ruột inox, vỏ và tay cầm nhựa PP', dimensions: '22 × 16 × 25 cm', capacity: '1,7 lít', color: 'Kem', badge: 'Mới',
      features: ['Đế nguồn tách rời thuận tiện nhấc rót', 'Nắp mở phía trên dễ châm nước', 'Vạch giới hạn lượng nước bên trong'],
      specifications: [{ label: 'Nguồn điện minh họa', value: '220 V / 50 Hz' }, { label: 'Công suất minh họa', value: '1.800 W' }, { label: 'Bộ sản phẩm', value: '1 ấm, 1 đế nguồn' }],
      care: 'Chỉ đun nước; không vượt vạch tối đa hoặc bật khi cạn. Không nhúng đế và dây điện vào nước. Thông số và tính năng an toàn phải được xác minh theo hàng thực tế trước khi mở bán.',
    }),
  product('may-xay-smoothie', 'Máy xay cá nhân Smoothie', 'Đồ gia dụng', 789000, 14,
    'Chuẩn bị một ly trái cây xay theo khẩu vị của riêng bạn với chiếc máy xay cá nhân nhỏ gọn. Cối vừa phần uống, thân máy tông kem và nút điều khiển đơn giản giúp góc pha chế thêm ngăn nắp. Phù hợp trưng bày cùng các món đồ dùng sáng màu.', {
      sku: 'SN-HM-003', summary: 'Thêm sắc màu trái cây vào buổi sáng.', material: 'Thân nhựa ABS, cối nhựa Tritan, lưỡi inox', dimensions: '12 × 12 × 34 cm', capacity: '500 ml', color: 'Kem / trong suốt', badge: '',
      features: ['Cối cá nhân gọn cho một phần uống', 'Cụm cối tháo rời thuận tiện vệ sinh', 'Thân máy nhỏ phù hợp góc pha chế'],
      specifications: [{ label: 'Nguồn điện minh họa', value: '220 V / 50 Hz' }, { label: 'Công suất minh họa', value: '300 W' }, { label: 'Bộ sản phẩm', value: '1 thân máy, 1 cối, 1 cụm lưỡi' }],
      care: 'Rút điện trước khi tháo và vệ sinh; không chạm vào lưỡi. Không xay đồ nóng hoặc đá cứng. Thông số là dữ liệu mẫu và cần xác nhận trước khi bán.',
    }),
  product('khay-sap-xep-modular', 'Bộ khay sắp xếp Modular', 'Đồ gia dụng', 229000, 28,
    'Biến ngăn kéo nhiều món nhỏ thành một góc dễ tìm kiếm. Modular gồm bốn khay với hai kích cỡ để bạn tự sắp xếp đồ dùng bàn làm việc, phụ kiện hay dụng cụ cá nhân. Màu trắng ngà và các góc bo tạo tổng thể sạch sẽ, nhẹ nhàng.', {
      sku: 'SN-HM-004', summary: 'Mỗi món đồ có một chỗ riêng.', material: 'Nhựa PP', dimensions: '2 khay 24 × 8 × 5 cm; 2 khay 12 × 8 × 5 cm', capacity: 'Bộ 4 khay', color: 'Trắng ngà', badge: '',
      features: ['Bốn khay phối linh hoạt theo ngăn kéo', 'Hai kích thước cho nhiều nhóm đồ dùng', 'Thành khay thấp giúp quan sát nhanh'],
      specifications: [{ label: 'Số lượng', value: '4 khay' }, { label: 'Không gian phù hợp', value: 'Ngăn kéo, bàn làm việc, bàn trang điểm' }, { label: 'Lưu ý kích thước', value: 'Đo ngăn kéo trước khi chọn' }],
      care: 'Lau bằng khăn ẩm hoặc rửa với xà phòng nhẹ. Tránh nhiệt cao và vật nặng vượt sức chịu của khay.',
    }),
  product('gio-do-vai-airy', 'Giỏ đồ vải Airy', 'Đồ gia dụng', 299000, 20,
    'Một chỗ cất đồ mềm mại cho phòng ngủ, góc giặt hoặc phòng khách. Airy có tông vải tự nhiên, dáng đứng gọn và hai quai xách. Có thể dùng để gom khăn, quần áo chờ giặt hoặc những chiếc chăn mỏng, giúp không gian trông thoáng hơn.', {
      sku: 'SN-HM-005', summary: 'Thu gọn đồ dùng, trả lại khoảng thở cho căn phòng.', material: 'Vải cotton pha polyester, lớp lót PE', dimensions: '35 × 35 × 45 cm', capacity: 'Khoảng 40 lít', color: 'Be tự nhiên', badge: '',
      features: ['Hai quai xách thuận tiện di chuyển', 'Dáng đứng gọn cho góc phòng', 'Có thể gấp khi không dùng'],
      specifications: [{ label: 'Kiểu dáng', value: 'Giỏ vải mềm' }, { label: 'Gợi ý sử dụng', value: 'Đồ khô, khăn và quần áo' }, { label: 'Bộ sản phẩm', value: '1 giỏ' }],
      care: 'Lau điểm bẩn bằng khăn ẩm và phơi thoáng. Không để đồ ướt lâu trong giỏ; không giặt máy nếu chưa có hướng dẫn từ nhà sản xuất.',
    }),
  product('tui-giu-nhiet-weekend', 'Túi giữ nhiệt Weekend', 'Phong cách sống', 259000, 25,
    'Mang theo bữa trưa, trái cây hay chút đồ ăn cho chuyến đi ngắn. Weekend có khoang chính rộng vừa, quai xách đôi và mặt ngoài màu xanh nhạt. Dáng túi tối giản phù hợp cả ngày làm việc lẫn một buổi dã ngoại nhỏ.', {
      sku: 'SN-LS-003', summary: 'Gói một bữa ngon cho hành trình của bạn.', material: 'Vải polyester, lớp xốp PE, lớp lót bạc', dimensions: '26 × 16 × 22 cm', capacity: 'Khoảng 8 lít', color: 'Xanh sage', badge: 'Cho ngày ngoài trời',
      features: ['Khoang chính có khóa kéo', 'Quai xách đôi và túi phụ phía trước', 'Lớp lót thuận tiện lau sạch'],
      specifications: [{ label: 'Kiểu đóng', value: 'Khóa kéo' }, { label: 'Khối lượng tham khảo', value: '260 g' }, { label: 'Lưu ý', value: 'Không thay thế thiết bị bảo quản lạnh' }],
      care: 'Dùng thêm túi đá phù hợp khi mang thực phẩm dễ hỏng. Lau bên trong sau mỗi lần dùng, phơi mở túi ở nơi thoáng; không ngâm hoặc giặt máy.',
    }),
  product('coc-su-morning', 'Cốc sứ Morning', 'Phong cách sống', 149000, 32,
    'Một chiếc cốc có quai vừa tay cho cà phê sáng hay trà chiều. Morning chọn dáng tròn, lớp men kem và phần đế màu đất làm điểm nhấn. Đặt bên cửa sổ hoặc trên bàn làm việc để tạo nên một khoảng nghỉ thật riêng.', {
      sku: 'SN-LS-004', summary: 'Dành một khoảng chậm cho tách đồ uống yêu thích.', material: 'Gốm sứ phủ men', dimensions: 'Đường kính 9 cm, cao 9 cm', capacity: '350 ml', color: 'Kem / đất nung', badge: '',
      features: ['Quai cầm tròn thuận tiện sử dụng', 'Dáng miệng rộng dễ vệ sinh', 'Tông màu trung tính phù hợp nhiều góc bàn'],
      specifications: [{ label: 'Kiểu cốc', value: 'Có quai' }, { label: 'Bộ sản phẩm', value: '1 cốc, không kèm đĩa' }, { label: 'Lưu ý', value: 'Màu men có thể chênh lệch theo ánh sáng' }],
      care: 'Tránh thay đổi nhiệt độ đột ngột và va đập. Rửa bằng miếng mềm; chỉ dùng máy rửa bát hoặc lò vi sóng khi đã xác nhận hướng dẫn của sản phẩm thực tế.',
    }),
];

// Exact original records are eligible for an opt-in content upgrade only.
export const legacySamples = [
  ['Bình giữ nhiệt Everyday', 'Phong cách sống', 'Sản phẩm minh họa để xem thử giao diện. Thay bằng thông tin thực tế trong quản trị.', 329000, 20, '/product-bottle.svg'],
  ['Hộp bảo quản Fresh Box', 'Nhà bếp', 'Sản phẩm minh họa. Chỉnh sửa mô tả, hình ảnh, giá và tồn kho trong quản trị.', 159000, 30, '/product-box.svg'],
  ['Bộ dụng cụ nhà bếp Essential', 'Nhà bếp', 'Sản phẩm minh họa dành cho không gian bếp tiện nghi.', 249000, 15, '/product-kitchen.svg'],
  ['Đèn bàn Minimal', 'Đồ gia dụng', 'Sản phẩm minh họa dành cho góc làm việc của bạn.', 459000, 10, '/product-lamp.svg'],
];
