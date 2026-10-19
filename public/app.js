import { motion } from './motion.js';
import { createAdminUI } from './admin.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  truck: '<path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  leaf: '<path d="M20 3C10 1 3 7 5 15c7 4 15-2 15-12Z"/><path d="M3 22 15 9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  phone: '<path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3c0 3-2 5-5 4A20 20 0 0 1 3 8C2 5 4 3 7 3Z"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
let config, products, me = { user: null }, category = '', query = '', sort = 'newest', priceRange = '';
let cart;
try { cart = JSON.parse(localStorage.getItem('sn-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
cart = cart.filter(item => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99);
const label = key => esc(config.labels[key] || key);
const ui = text => esc(config.ui?.[text] ?? text);
const statusNames = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipped: 'Đang giao', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
const lines = text => String(text || '').split('\n').map(item => item.trim()).filter(Boolean);
function isStaff() { return Boolean(me.user?.permissions?.length); }
function details(product) { return product.details && typeof product.details === 'object' ? product.details : {}; }
function editorial() {
  const source = config.editorial || {};
  return {
    collectionEyebrow: 'KHÔNG GIAN SỐNG CỦA BẠN', featuredEyebrow: 'TỪNG CHI TIẾT, THÊM TIỆN NGHI',
    featuredTitle: config.productsTitle, featuredText: 'Những lựa chọn nhỏ để mỗi ngày thêm ngăn nắp và dễ chịu.', featuredButton: 'Xem tất cả sản phẩm',
    catalogEyebrow: 'BỘ SƯU TẬP SUPER NET', catalogText: 'Tìm một món đồ phù hợp với nhịp sống và không gian của bạn.',
    categoryImages: config.categories.map((name, index) => ({ category: name, image: products.find(product => product.category === name)?.image || '/images/scene-kitchen.webp', caption: ['Cho căn bếp ngăn nắp', 'Chăm chút từng góc nhà', 'Đồng hành mỗi ngày'][index % 3] })),
    story: { eyebrow: 'MỘT CHÚT THAY ĐỔI, NHIỀU ĐIỀU DỄ CHỊU', title: 'Nhà là nơi những điều tốt đẹp bắt đầu.', text: config.tagline, image: '/images/scene-kitchen.webp', button: 'Khám phá cho ngôi nhà' },
    journal: { eyebrow: 'CẢM HỨNG MỖI NGÀY', title: 'Sống gọn hơn. Tận hưởng nhiều hơn.', text: 'Gợi ý nhỏ cho không gian sống của bạn.', articles: [] },
    serviceTitle: 'An tâm từ lựa chọn đến trải nghiệm', footerHeading: 'Cùng bạn chăm chút mỗi ngày.', footerText: config.footerText,
    ...source,
  };
}
function navigation() {
  return config.navigation || { categoryLabel: 'Danh mục', allLabel: 'Tất cả sản phẩm', items: [] };
}
const collectionIds = ['bestsellers', 'new', 'promotions'];
function navigationHref(item) { return `#${collectionIds.includes(item.id) ? 'collection' : 'page'}/${item.id}`; }
function closeCategories(restoreFocus = false) {
  const toggle = $('#category-toggle'), panel = $('#category-panel');
  if (!toggle || !panel) return;
  motion.disclosure(toggle, panel, false, { restoreFocus });
}
async function api(url, options = {}) {
  const response = await fetch('/api' + url, { ...options, headers: { 'Content-Type': 'application/json', ...(me.csrf ? { 'X-CSRF-Token': me.csrf } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && url.startsWith('/admin')) {
      me = { user: null }; motion.closeDialog($('#modal')); location.hash = 'account';
    }
    throw Error(data.error || 'Không thể xử lý yêu cầu.');
  }
  return data;
}
function toast(message) { motion.showToast($('#toast'), message); }
function saveCart() { localStorage.setItem('sn-cart', JSON.stringify(cart)); }
function add(id, quantity = 1, source = null) {
  const product = products.find(item => item.id === id);
  if (!product?.stock) return toast('Sản phẩm đã hết hàng.');
  const item = cart.find(line => line.id === id);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || (item?.quantity || 0) + quantity > Math.min(product.stock, 99)) return toast('Số lượng vượt quá tồn kho hoặc giới hạn 99 sản phẩm.');
  if (item) item.quantity += quantity; else cart.push({ id, quantity });
  saveCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(element => element.textContent = count);
  $('.cart-link')?.setAttribute('aria-label', `${config.labels.cart}: ${count}`);
  toast('Đã thêm vào giỏ hàng');
  motion.addedToCart(source);
}
function applyCopy(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION'].includes(node.parentElement.tagName)) continue;
    const key = node.textContent.trim();
    if (Object.hasOwn(config.ui || {}, key)) node.textContent = node.textContent.replace(key, () => config.ui[key]);
  }
}
function modal(html) {
  $('#modal').innerHTML = `<button class="modal-close" aria-label="Đóng">${icon('close')}</button>` + html;
  motion.openDialog($('#modal'));
  $('#modal .modal-close').onclick = () => motion.closeDialog($('#modal'));
}
function header() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const route = location.hash.slice(1);
  return `<div class="announcement"><div class="wrap"><span>${esc(config.announcement)}</span><a href="#account">${ui('Theo dõi đơn hàng')} ${icon('arrow')}</a></div></div>
    <header class="header"><div class="wrap header-inner">
      <a class="brand-link" href="#" aria-label="${esc(config.brand)}"><img class="logo" src="${esc(config.logo)}" alt="${esc(config.brand)}"></a>
      <form class="search" id="search">${icon('search')}<input aria-label="Tìm sản phẩm" name="q" placeholder="${esc(config.searchPlaceholder)}" value="${esc(query)}"><button aria-label="Tìm kiếm">${icon('arrow')}</button></form>
      <div class="header-actions"><a href="#account">${icon('user')}<span>${me.user ? esc(me.user.name) : label('account')}</span></a><a class="cart-link" href="#cart">${icon('bag')}<span>${label('cart')}</span><b class="cart-count">${count}</b></a></div>
    </div><div class="nav-shell"><div class="wrap nav-frame"><div class="category-menu"><button class="category-toggle ${route === 'products' ? 'active' : ''}" id="category-toggle" aria-expanded="false" aria-controls="category-panel">${icon('menu')}<span>${esc(navigation().categoryLabel)}</span>${icon('down')}</button><div class="category-panel" id="category-panel" hidden><a class="${route === 'products' && !category ? 'active' : ''}" href="#products" data-category="">${esc(navigation().allLabel)}${icon('arrow')}</a>${config.categories.map(name => `<a class="${route === 'products' && category === name ? 'active' : ''}" href="#products" data-category="${esc(name)}">${esc(name)}${icon('chevron')}</a>`).join('')}</div></div><nav class="nav nav-tabs" aria-label="Điều hướng chính">${navigation().items.filter(item => item.enabled).map(item => `<a class="${'#' + route === navigationHref(item) ? 'active' : ''} ${item.id === 'rewards' ? 'rewards-link' : ''}" href="${navigationHref(item)}" ${'#' + route === navigationHref(item) ? 'aria-current="page"' : ''}>${item.id === 'rewards' ? esc(item.label).replace(/Rewards$/i, word => `<span class="rewards-word">${word}</span>`) : esc(item.label)}</a>`).join('')}${isStaff() ? `<a class="admin-link" href="#admin">${label('admin')}</a>` : ''}</nav></div></div></header>`;
}
function footer() {
  const content = editorial();
  return `<footer><div class="wrap"><div class="footer-top"><div><span class="eyebrow">${esc(config.brand)}</span><h2>${esc(content.footerHeading)}</h2><p class="footer-intro">${esc(content.footerText)}</p></div><a class="footer-explore" href="#products">${label('products')} ${icon('arrow')}</a></div><div class="footer-grid"><div class="footer-brand"><a href="#"><img src="${esc(config.logo)}" alt="${esc(config.brand)}"></a><p>${esc(config.footerText)}</p>${config.address ? `<p>${esc(config.address)}</p>` : ''}</div><div class="footer-links"><strong>${ui('Khám phá cửa hàng')}</strong>${config.categories.map(name => `<a href="#products" data-category="${esc(name)}">${esc(name)}</a>`).join('')}<a href="#account">${label('account')}</a></div><div class="footer-links"><strong>${ui('Thông tin & chính sách')}</strong>${config.policies.map((policy, index) => `<button data-policy="${index}">${esc(policy.title)}</button>`).join('')}</div><div class="footer-links"><strong>${ui('Liên hệ')}</strong>${config.phone ? `<a href="tel:${esc(config.phone.replace(/[^+\d]/g, ''))}">${icon('phone')}${esc(config.phone)}</a>` : ''}${config.email ? `<a href="mailto:${esc(config.email)}">${icon('mail')}${esc(config.email)}</a>` : ''}<a href="#account">${ui('Hỗ trợ đơn hàng')} ${icon('arrow')}</a><span class="payment-caption">${ui('Phương thức thanh toán')}</span><div class="payment-badges"><span>COD</span>${config.bankName && config.bankAccount && config.bankHolder ? `<span>${ui('Chuyển khoản')}</span>` : ''}</div></div></div><div class="copyright"><span>© ${new Date().getFullYear()} ${esc(config.brand)}. ${ui('Mọi quyền được bảo lưu.')}</span><span>${esc(config.tagline)}</span></div></div></footer>`;
}
function productCard(product) {
  const info = details(product);
  return `<article class="product"><a class="product-image" href="#product/${product.id}" aria-label="${esc(product.name)}"><img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">${!product.stock ? `<span class="badge sold-out">${label('outOfStock')}</span>` : info.badge ? `<span class="badge">${esc(info.badge)}</span>` : ''}<span class="product-view">${label('details')} ${icon('arrow')}</span></a><div class="product-meta"><span class="category">${esc(product.category)}</span>${info.is_sample ? `<span class="sample-label">${ui('Mẫu tham khảo')}</span>` : ''}</div><h3><a href="#product/${product.id}">${esc(product.name)}</a></h3>${info.summary ? `<p class="product-summary">${esc(info.summary)}</p>` : ''}<div class="product-bottom"><span class="price">${money(product.price)}</span><button class="add" data-add="${product.id}" aria-label="${label('add')} — ${esc(product.name)}" ${!product.stock ? 'disabled' : ''}>${icon('plus')}</button></div></article>`;
}
function sectionHeading(eyebrow, title, text, action = '') {
  return `<div class="section-title"><div>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h2>${esc(title)}</h2>${text ? `<p class="subtitle">${esc(text)}</p>` : ''}</div>${action}</div>`;
}
function categoriesSection() {
  const content = editorial();
  return `<section class="section collections">${sectionHeading(content.collectionEyebrow, config.collectionTitle, config.collectionText)}<div class="category-grid">${config.categories.map((name, index) => {
    const item = content.categoryImages.find(entry => entry.category === name) || {};
    const image = item.image || products.find(product => product.category === name)?.image;
    return `<a href="#products" class="category-card category-tone-${index % 4}" data-category="${esc(name)}">${image ? `<img src="${esc(image)}" alt="${esc(name)}" loading="lazy">` : ''}<div class="category-copy"><span class="category-index">0${index + 1}</span><h3>${esc(name)}</h3>${item.caption ? `<p>${esc(item.caption)}</p>` : ''}<span class="round-arrow">${icon('arrow')}</span></div></a>`;
  }).join('')}</div></section>`;
}
function journalSection() {
  const journal = editorial().journal;
  if (!journal.articles?.length) return '';
  return `<section class="section journal" id="inspiration">${sectionHeading(journal.eyebrow, journal.title, journal.text)}<div class="journal-grid">${journal.articles.map((article, index) => `<article class="journal-card"><button class="journal-image" data-article="${index}" aria-label="${esc(article.title)}"><img src="${esc(article.image)}" alt="${esc(article.title)}" loading="lazy"></button><div class="journal-content"><span class="journal-number">0${index + 1} / ${ui('CẢM HỨNG SỐNG')}</span><h3><button data-article="${index}">${esc(article.title)}</button></h3><p>${esc(article.excerpt)}</p><button class="text-link" data-article="${index}">${ui('Đọc tiếp')} ${icon('arrow')}</button></div></article>`).join('')}</div></section>`;
}
function services() {
  return `<section class="service-section"><div class="wrap"><span class="eyebrow">${esc(config.brand)}</span><h2>${esc(editorial().serviceTitle)}</h2><div class="services">${config.benefits.map((benefit, index) => `<div class="service-item">${icon(['truck', 'shield', 'heart', 'leaf'][index % 4])}<span>${esc(benefit)}</span></div>`).join('')}</div></div></section>`;
}
function home() {
  const content = editorial();
  const story = content.story;
  return `<main><div class="wrap"><section class="hero"><div class="hero-copy"><span class="eyebrow"><span class="eyebrow-line"></span>${esc(config.heroEyebrow)}</span><h1>${esc(config.heroTitle)}</h1><p>${esc(config.heroText)}</p><a class="primary" href="#products" data-category="">${esc(config.heroButton)} ${icon('arrow')}</a><div class="hero-bottom"><span class="hero-dot"></span><span>${esc(config.tagline)}</span></div></div><div class="hero-art"><img class="hero-image" src="${esc(config.heroImage || '/images/hero-home.webp')}" alt="${esc(config.heroTitle)}"><div class="hero-image-mark"><span>${esc(config.brand)}</span><span>${icon('leaf')}</span></div></div></section><div class="welcome-line"><span>${icon('leaf')}${esc(config.collectionText)}</span><a href="#products">${ui('Tìm điều bạn yêu thích')} ${icon('arrow')}</a></div>${categoriesSection()}</div><div class="featured-shell"><section class="wrap section featured">${sectionHeading(content.featuredEyebrow, content.featuredTitle, content.featuredText, `<a class="text-link" href="#products" data-category="">${esc(content.featuredButton)} ${icon('arrow')}</a>`)}<div class="products">${products.slice(0, 8).map(productCard).join('')}</div></section></div><div class="wrap"><section class="story"><div class="story-image"><img src="${esc(story.image)}" alt="${esc(story.title)}" loading="lazy"></div><div class="story-copy"><span class="eyebrow">${esc(story.eyebrow)}</span><h2>${esc(story.title)}</h2><p>${esc(story.text)}</p><a class="primary light" href="#products" data-category="">${esc(story.button)} ${icon('arrow')}</a><span class="story-decoration" aria-hidden="true">${icon('leaf')}</span></div></section>${journalSection()}</div>${services()}</main>`;
}
function catalog() {
  const content = editorial();
  let filtered = products.filter(product => (!category || product.category === category) && (!query || (product.name + ' ' + product.description + ' ' + (details(product).sku || '')).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))) && (!priceRange || (priceRange === 'under200' ? product.price < 200000 : priceRange === '200to500' ? product.price >= 200000 && product.price <= 500000 : product.price > 500000)));
  filtered = [...filtered].sort((a, b) => sort === 'priceAsc' ? a.price - b.price : sort === 'priceDesc' ? b.price - a.price : sort === 'name' ? a.name.localeCompare(b.name, 'vi') : b.id - a.id);
  return `<main class="wrap page catalog-page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<span>${esc(navigation().categoryLabel)}</span></div><div class="catalog-intro"><div><span class="eyebrow">${esc(content.catalogEyebrow)}</span><h1>${esc(category || config.productsTitle)}</h1><p>${esc(content.catalogText)}</p></div><div class="catalog-intro-mark" aria-hidden="true">${icon('leaf')}</div></div><div class="catalog-filters"><div class="filters"><button class="chip ${!category ? 'active' : ''}" data-filter="">${label('all')}</button>${config.categories.map(name => `<button class="chip ${name === category ? 'active' : ''}" data-filter="${esc(name)}">${esc(name)}</button>`).join('')}</div><div class="catalog-controls"><label>${ui('Khoảng giá')}<select id="price-filter"><option value="">${ui('Tất cả mức giá')}</option><option value="under200" ${priceRange === 'under200' ? 'selected' : ''}>${ui('Dưới 200.000đ')}</option><option value="200to500" ${priceRange === '200to500' ? 'selected' : ''}>${ui('200.000đ – 500.000đ')}</option><option value="over500" ${priceRange === 'over500' ? 'selected' : ''}>${ui('Trên 500.000đ')}</option></select></label><label>${ui('Sắp xếp')}<select id="sort-products"><option value="newest" ${sort === 'newest' ? 'selected' : ''}>${ui('Mới nhất')}</option><option value="priceAsc" ${sort === 'priceAsc' ? 'selected' : ''}>${ui('Giá tăng dần')}</option><option value="priceDesc" ${sort === 'priceDesc' ? 'selected' : ''}>${ui('Giá giảm dần')}</option><option value="name" ${sort === 'name' ? 'selected' : ''}>${ui('Tên A – Z')}</option></select></label></div></div><div class="results-line"><span>${filtered.length} ${ui('sản phẩm')}${query ? ` ${ui('cho')} “${esc(query)}”` : ''}</span>${query ? `<button class="text-link" id="clear-search">${ui('Xóa tìm kiếm')} ${icon('close')}</button>` : ''}</div>${filtered.length ? `<div class="products">${filtered.map(productCard).join('')}</div>` : `<div class="empty">${icon('search')}<h2>${ui('Không tìm thấy sản phẩm phù hợp.')}</h2><button class="secondary" id="reset-filters">${ui('Xóa bộ lọc')}</button></div>`}</main>`;
}
async function navigationPage(id) {
  const item = navigation().items.find(entry => entry.id === id && entry.enabled);
  if (!item) return `<main class="wrap page"><div class="empty"><h1>Trang này hiện chưa được mở</h1><a class="primary" href="#products">${esc(navigation().allLabel)}</a></div></main>`;
  let selection = [];
  if (collectionIds.includes(id)) {
    if (item.productIds.length) selection = item.productIds.map(productId => products.find(product => product.id === productId)).filter(Boolean);
    else if (id === 'new') selection = [...products].sort((a, b) => b.id - a.id);
    else if (id === 'bestsellers') selection = await api('/collections/bestsellers');
  }
  const hasContact = config.phone || config.email || config.address;
  const contact = ['stores', 'franchise'].includes(id) && hasContact ? `<section class="contact-card"><h2>${ui('Liên hệ')}</h2>${config.address ? `<p>${esc(config.address)}</p>` : ''}<div class="button-row">${config.phone ? `<a class="secondary" href="tel:${esc(config.phone.replace(/[^+\d]/g, ''))}">${icon('phone')}${esc(config.phone)}</a>` : ''}${config.email ? `<a class="secondary" href="mailto:${esc(config.email)}">${icon('mail')}${esc(config.email)}</a>` : ''}</div></section>` : '';
  return `<main class="wrap page navigation-page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<span>${esc(item.label)}</span></div><section class="navigation-hero"><div><span class="eyebrow">${esc(item.eyebrow)}</span><h1>${esc(item.title)}</h1><p>${esc(item.description)}</p></div>${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}">` : ''}</section>${item.body ? `<section class="navigation-body"><p class="policy">${esc(item.body)}</p></section>` : ''}${id === 'bestsellers' && item.productIds.length ? '<p class="collection-notice">Bộ sưu tập do cửa hàng lựa chọn, không phải bảng thống kê doanh số.</p>' : ''}${collectionIds.includes(id) ? selection.length ? `<section class="section navigation-products"><div class="results-line"><span>${selection.length} ${ui('sản phẩm')}</span></div><div class="products">${selection.map(productCard).join('')}</div></section>` : `<section class="collection-notice"><p>${esc(id === 'bestsellers' ? 'Chưa có thống kê bán chạy hoặc bộ sưu tập được lựa chọn.' : 'Các sản phẩm của bộ sưu tập sẽ được cập nhật tại đây.')}</p><a class="text-link" href="#products" data-category="">${esc(navigation().allLabel)} ${icon('arrow')}</a></section>` : ''}${contact}${!collectionIds.includes(id) ? `<div class="button-row navigation-actions"><a class="primary" href="#products" data-category="">${esc(navigation().allLabel)} ${icon('arrow')}</a>${id === 'rewards' ? `<a class="secondary" href="#account">${label('account')} ${icon('user')}</a>` : ''}${id === 'events' ? `<a class="secondary" href="#inspiration">${ui('Góc cảm hứng')} ${icon('arrow')}</a>` : ''}</div>` : ''}</main>`;
}
function productPage(id) {
  const product = products.find(item => item.id === id);
  if (!product) return `<main class="wrap page"><div class="empty"><h1>${ui('Không tìm thấy sản phẩm')}</h1><a class="primary" href="#products">${label('products')}</a></div></main>`;
  const info = details(product);
  const gallery = [...new Set([product.image, ...(info.gallery || [])].filter(Boolean))];
  const related = products.filter(item => item.id !== id && item.category === product.category).slice(0, 4);
  const specs = info.specifications || [];
  return `<main class="wrap page product-page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<a href="#products" data-category="${esc(product.category)}">${esc(product.category)}</a>${icon('chevron')}<span>${esc(product.name)}</span></div><div class="product-detail"><div class="gallery"><div class="gallery-main"><img id="gallery-main-image" src="${esc(product.image)}" alt="${esc(product.name)}">${info.badge ? `<span class="badge">${esc(info.badge)}</span>` : ''}</div>${gallery.length > 1 ? `<div class="gallery-thumbs">${gallery.map((image, index) => `<button class="${index === 0 ? 'active' : ''}" data-gallery="${esc(image)}" aria-label="Ảnh ${index + 1} — ${esc(product.name)}"><img src="${esc(image)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div><div class="detail-copy"><span class="eyebrow">${esc(product.category)}</span><h1>${esc(product.name)}</h1>${info.sku ? `<p class="product-sku">${ui('Mã sản phẩm')}: ${esc(info.sku)}</p>` : ''}${info.summary ? `<p class="detail-summary">${esc(info.summary)}</p>` : ''}<div class="detail-price">${money(product.price)}</div>${info.is_sample ? `<p class="sample-notice">${ui('Sản phẩm mẫu — hình ảnh, thông số và giá dùng để tham khảo giao diện.')}</p>` : ''}${info.features?.length ? `<ul class="detail-features">${info.features.map(feature => `<li>${icon('check')}<span>${esc(feature)}</span></li>`).join('')}</ul>` : ''}<div class="stock-state ${product.stock ? '' : 'unavailable'}"><span></span>${product.stock ? `${ui('Còn hàng')} · ${product.stock} ${ui('sản phẩm')}` : label('outOfStock')}</div><div class="purchase-row"><div class="quantity-stepper"><button data-step="-1" aria-label="Giảm số lượng">−</button><input id="detail-quantity" type="number" min="1" max="${Math.min(product.stock, 99) || 1}" value="1" aria-label="Số lượng"><button data-step="1" aria-label="Tăng số lượng">+</button></div><button class="primary" id="detail-add" data-product-id="${product.id}" ${!product.stock ? 'disabled' : ''}>${icon('bag')}${label('add')}</button></div><div class="detail-shipping">${icon('truck')}<div><strong>${ui('Giao hàng tiêu chuẩn')} ${money(config.shippingFee)}</strong><span>${ui('Miễn phí vận chuyển từ')} ${money(config.freeShipping)}</span></div></div><div class="detail-policy-links">${config.policies.slice(0, 2).map((policy, index) => `<button data-policy="${index}">${esc(policy.title)} ${icon('chevron')}</button>`).join('')}</div></div></div><div class="product-information"><section><span class="eyebrow">${ui('TÌM HIỂU SẢN PHẨM')}</span><h2>${ui('Chi tiết sản phẩm')}</h2><p class="policy">${esc(product.description)}</p>${info.care ? `<h3>${ui('Sử dụng & bảo quản')}</h3><p class="policy">${esc(info.care)}</p>` : ''}</section><section class="specifications"><h2>${ui('Thông số sản phẩm')}</h2><dl>${[['Mã sản phẩm', info.sku], ['Chất liệu', info.material], ['Kích thước', info.dimensions], ['Dung tích', info.capacity], ['Màu sắc', info.color], ...specs.map(spec => [spec.label, spec.value])].filter(([, value]) => value).map(([name, value]) => `<div><dt>${ui(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${!info.sku && !specs.length && !info.material ? `<p class="muted">${ui('Thông số đang được cập nhật.')}</p>` : ''}</section></div>${related.length ? `<section class="section related-products">${sectionHeading(config.brand, config.ui?.['Có thể bạn cũng thích'] || 'Có thể bạn cũng thích', '', `<a class="text-link" href="#products" data-category="${esc(product.category)}">${ui('Xem thêm')} ${icon('arrow')}</a>`)}<div class="products">${related.map(productCard).join('')}</div></section>` : ''}</main>`;
}
function cartPage() {
  const items = cart.map(item => ({ ...item, product: products.find(product => product.id === item.id) }));
  const subtotal = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const shipping = subtotal >= config.freeShipping ? 0 : config.shippingFee;
  return `<main class="wrap page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<span>${label('cart')}</span></div><h1>${label('cart')} <span class="heading-count">${cart.reduce((sum, item) => sum + item.quantity, 0)}</span></h1>${!items.length ? `<div class="empty">${icon('bag')}<h2>${label('empty')}</h2><p>${ui('Khám phá những lựa chọn dành cho ngôi nhà của bạn.')}</p><a class="primary" href="#products">${label('products')} ${icon('arrow')}</a></div>` : `<div class="split"><div><div class="cart-list-header">${label('products')}<span>${ui('Số lượng')}</span></div>${items.map(item => `<div class="cart-item"><a href="#product/${item.id}"><img src="${esc(item.product?.image || '/logo.png')}" alt="${esc(item.product?.name || '')}"></a><div class="info"><span class="category">${esc(item.product?.category || '')}</span><strong><a href="#product/${item.id}">${esc(item.product?.name || 'Sản phẩm không còn bán')}</a></strong><p>${item.product ? money(item.product.price) : ui('Vui lòng xóa khỏi giỏ')}</p></div><input aria-label="Số lượng ${esc(item.product?.name || '')}" type="number" min="1" max="99" value="${item.quantity}" data-quantity="${item.id}"><button class="remove-item" data-remove="${item.id}" aria-label="Xóa">${icon('close')}</button></div>`).join('')}<a class="text-link continue-shopping" href="#products">${ui('Tiếp tục mua sắm')} ${icon('arrow')}</a></div><div class="panel checkout-panel"><h2>${ui('Thông tin đặt hàng')}</h2><div class="stack"><div class="row"><span>${ui('Tạm tính')}</span><span>${money(subtotal)}</span></div><div class="row"><span>${ui('Phí giao hàng')}</span><span>${money(shipping)}</span></div><div class="row total"><span>${ui('Tổng cộng')}</span><span>${money(subtotal + shipping)}</span></div></div><p class="shipping-message">${icon('truck')}${ui('Miễn phí vận chuyển từ')} ${money(config.freeShipping)}</p>${me.user ? `<form id="checkout" class="form"><label>${ui('Người nhận')}<input name="recipient" required maxlength="100" value="${esc(me.user.name)}" autocomplete="name"></label><label>${ui('Số điện thoại')}<input name="phone" required type="tel" autocomplete="tel"></label><label>${ui('Địa chỉ giao hàng')}<textarea name="address" required minlength="10" maxlength="600" autocomplete="street-address"></textarea></label><label>${ui('Thanh toán')}<select name="payment"><option value="cod">${label('cod')}</option>${config.bankName && config.bankAccount && config.bankHolder ? `<option value="bank">${label('bank')}</option>` : ''}</select></label><div class="error" role="alert"></div><button class="primary">${label('buy')} ${icon('arrow')}</button></form>` : `<a href="#account" class="primary">${label('login')} ${ui('để đặt hàng')} ${icon('arrow')}</a>`}</div></div>`}</main>`;
}
function authPage() {
  return `<main class="wrap page"><div class="auth-layout"><div class="auth-intro"><span class="eyebrow">${esc(config.brand)}</span><h1>${ui('Một tài khoản.\nThêm nhiều tiện ích.')}</h1><p>${ui('Đăng nhập để đặt hàng và theo dõi hành trình những món đồ bạn yêu thích.')}</p><img src="/images/scene-living.webp" alt="" loading="lazy"></div><div class="auth-form"><h2>${label('account')}</h2><div class="tabs"><button class="chip active" data-auth="login">${label('login')}</button><button class="chip" data-auth="register">${label('register')}</button></div><form class="form" id="auth" data-mode="login"><label id="name-field" hidden>${ui('Họ tên')}<input name="name" maxlength="100" autocomplete="name"></label><label>${ui('Email')}<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>${ui('Mật khẩu')}<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password"></label><p class="muted">${ui('Mật khẩu từ 12 ký tự. Không sử dụng mật khẩu của dịch vụ khác.')}</p><div class="error" role="alert"></div><button class="primary">${label('login')} ${icon('arrow')}</button></form></div></div></main>`;
}
function orderCard(order, admin = false) {
  return `<article class="order"><div class="row"><strong>${ui('Đơn')} #${order.id}</strong><span class="order-state">${ui(statusNames[order.status])}</span></div><p class="muted">${new Date(order.created).toLocaleString('vi-VN')} · ${order.payment === 'cod' ? 'COD' : ui('Chuyển khoản')}</p>${order.items.map(item => `<div class="row order-line"><span>${esc(item.name)} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}<div class="row total"><span>${ui('Tổng cộng')} (${ui('Phí giao hàng')} ${money(order.shipping)})</span><span>${money(order.total)}</span></div><p class="muted">${esc(order.recipient)} · ${esc(order.phone)}<br>${esc(order.address)}</p>${order.payment === 'bank' ? `<div class="notice">${esc(order.bank.name)} · ${esc(order.bank.account)}<br>${esc(order.bank.holder)}<br>${ui('Nội dung chuyển khoản')}: SN${order.id}. ${ui('Cửa hàng xác nhận thanh toán sau khi đối soát ngân hàng.')}</div>` : ''}${admin ? `<form class="row order-status" data-id="${order.id}"><select class="input" name="status">${Object.entries(statusNames).map(([value, text]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select><button class="primary">Cập nhật</button></form>` : ''}</article>`;
}
async function accountPage() {
  if (!me.user) return authPage();
  const orders = await api('/orders');
  return `<main class="wrap page"><div class="account-heading"><div><span class="eyebrow">${ui('TÀI KHOẢN CỦA BẠN')}</span><h1>${esc(me.user.name)}</h1><p class="muted">${esc(me.user.email)}</p></div><div class="button-row">${isStaff() ? `<a href="#admin" class="primary">${label('admin')} ${icon('arrow')}</a>` : ''}<button class="secondary" data-own-password>Đổi mật khẩu</button><button class="secondary" id="logout">${label('logout')}</button></div></div><h2>${label('orders')}</h2>${orders.length ? orders.map(order => orderCard(order)).join('') : `<div class="empty">${icon('bag')}<p>${ui('Chưa có đơn hàng.')}</p><a class="primary" href="#products">${label('products')}</a></div>`}</main>`;
}
function editorInput(name, title, value, multiline = false) {
  return `<label>${esc(title)}${multiline ? `<textarea name="${esc(name)}">${esc(value)}</textarea>` : `<input name="${esc(name)}" value="${esc(value)}">`}</label>`;
}
function editProduct(product = { name: '', category: config.categories[0] || '', description: '', price: 0, stock: 0, image: '', active: 0 }) {
  const info = details(product);
  modal(`<h2>${product.id ? 'Sửa' : 'Thêm'} sản phẩm</h2><p class="muted">Nhập thông tin cơ bản trước. Mở các nhóm bên dưới khi cần bổ sung nội dung chi tiết.</p><form id="product-form" class="form">
    <section class="product-editor-section"><h3>Thông tin cơ bản</h3><label>Tên sản phẩm<input name="name" required maxlength="200" value="${esc(product.name)}"></label>
    <div class="settings-grid"><label>Danh mục<select name="category">${[...new Set([...config.categories, product.category])].filter(Boolean).map(name => `<option ${name === product.category ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>${editorInput('detail_sku', 'Mã sản phẩm (SKU)', info.sku)}<label>Giá bán (đ)<input type="number" name="price" min="0" max="1000000000" step="1" required value="${product.price}"></label><label>Số lượng tồn kho<input type="number" name="stock" min="0" max="1000000" step="1" required value="${product.stock}"></label><label>Trạng thái<select name="active"><option value="1" ${product.active ? 'selected' : ''}>Đang bán — hiện trên cửa hàng</option><option value="0" ${!product.active ? 'selected' : ''}>Đang ẩn — lưu bản nháp</option></select></label><label>Dữ liệu mẫu<select name="detail_is_sample"><option value="1" ${info.is_sample ? 'selected' : ''}>Mẫu tham khảo</option><option value="0" ${!info.is_sample ? 'selected' : ''}>Sản phẩm chính thức</option></select></label></div></section>
    <section class="product-editor-section"><h3>Ảnh sản phẩm</h3><img class="admin-image-preview" id="product-image-preview" src="${esc(product.image)}" alt="Ảnh chính" ${product.image ? '' : 'hidden'}><label>Tải ảnh chính lên<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="image"><small>PNG, JPG hoặc WebP, tối đa 5 MB. Nhấn Lưu sản phẩm sau khi tải.</small></label><label>Hoặc dùng đường dẫn ảnh<input name="image" value="${esc(product.image)}" placeholder="/uploads/anh.webp hoặc https://..."></label><details class="admin-section"><summary>Thêm ảnh trong thư viện</summary>${editorInput('detail_gallery', 'Mỗi dòng một đường dẫn ảnh', (info.gallery || []).join('\n'), true)}</details></section>
    <section class="product-editor-section"><h3>Nội dung giới thiệu</h3>${editorInput('detail_summary', 'Giới thiệu ngắn (trên thẻ sản phẩm)', info.summary, true)}<label>Mô tả chi tiết<textarea name="description" maxlength="10000">${esc(product.description)}</textarea></label></section>
    <details class="admin-section"><summary>Thông số & đặc điểm sản phẩm</summary><div class="settings-grid">${[['material', 'Chất liệu'], ['dimensions', 'Kích thước'], ['capacity', 'Dung tích'], ['color', 'Màu sắc']].map(([key, title]) => editorInput('detail_' + key, title, info[key])).join('')}</div>${editorInput('detail_badge', 'Nhãn nổi bật trên thẻ sản phẩm', info.badge)}${editorInput('detail_features', 'Đặc điểm nổi bật (mỗi dòng một mục)', (info.features || []).join('\n'), true)}${editorInput('detail_specifications', 'Thông số khác (mỗi dòng: tên thông số: giá trị)', (info.specifications || []).map(spec => spec.label + ': ' + spec.value).join('\n'), true)}${editorInput('detail_care', 'Hướng dẫn sử dụng & bảo quản', info.care, true)}</details>
    <div class="error" role="alert"></div><button class="primary">Lưu sản phẩm ${icon('check')}</button></form>`);
  bindUploads($('#product-form'));
  const imageInput = $('#product-form [name="image"]');
  const preview = () => { const img = $('#product-image-preview'); img.hidden = !imageInput.value; img.src = imageInput.value; };
  imageInput.addEventListener('input', preview);
  imageInput.addEventListener('change', preview);
  $('#product-form').onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      const data = Object.fromEntries(new FormData(form));
      const body = Object.fromEntries(['name', 'category', 'description', 'image'].map(key => [key, data[key]]));
      for (const key of ['price', 'stock', 'active']) body[key] = Number(data[key]);
      body.details = {};
      for (const key of ['sku', 'summary', 'material', 'dimensions', 'capacity', 'color', 'badge', 'care']) body.details[key] = data['detail_' + key].trim();
      body.details.features = lines(data.detail_features);
      body.details.gallery = lines(data.detail_gallery);
      body.details.specifications = lines(data.detail_specifications).map(line => { const index = line.indexOf(':'); if (index < 1 || !line.slice(index + 1).trim()) throw Error('Mỗi thông số cần có dạng “Tên: giá trị”.'); return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() }; });
      body.details.is_sample = data.detail_is_sample === '1';
      await api('/admin/products' + (product.id ? '/' + product.id : ''), { method: product.id ? 'PUT' : 'POST', body });
      await motion.closeDialog($('#modal'));
      await refresh();
      toast('Đã lưu sản phẩm');
    });
  };
}
async function submit(form, action) {
  const button = form.querySelector('button[type="submit"],button.primary');
  if (form.dataset.submitting === 'true' || button?.disabled) return;
  form.dataset.submitting = 'true';
  form.setAttribute('aria-busy', 'true');
  if (button) {
    button.disabled = true;
    button.classList.add('is-pending');
    button.setAttribute('aria-busy', 'true');
  }
  form.querySelector('.error')?.replaceChildren();
  try { await action(); }
  catch (error) {
    const target = form.querySelector('.error');
    if (target) { target.textContent = error.message; motion.formError(form); }
    else toast(error.message);
  } finally {
    delete form.dataset.submitting;
    form.removeAttribute('aria-busy');
    if (button) { button.disabled = false; button.classList.remove('is-pending'); button.removeAttribute('aria-busy'); }
  }
}
async function refresh() { [config, products] = await Promise.all([api('/settings'), api('/products')]); await render(); }
let generation = 0, lastRenderedRoute;
async function render() {
  const current = ++generation;
  try {
    const route = location.hash.slice(1);
    const body = route === 'cart' ? cartPage() : route === 'account' ? await accountPage() : (route === 'admin' || route.startsWith('admin/')) ? await adminUI.page(route.split('/')[1] || '') : route === 'products' ? catalog() : route.startsWith('collection/') || route.startsWith('page/') ? await navigationPage(route.split('/')[1]) : route.startsWith('product/') ? productPage(Number(route.split('/')[1])) : route === 'inspiration' ? `<main class="wrap page">${journalSection()}</main>` : home();
    if (current !== generation) return;
    const activeProduct = route.startsWith('product/') && products.find(item => item.id === Number(route.split('/')[1]));
    const activePage = navigation().items.find(item => navigationHref(item) === '#' + route);
    document.title = (activeProduct ? activeProduct.name : activePage ? activePage.title : config.brand) + ' — ' + config.tagline;
    for (const [key, value] of Object.entries(config.colors)) document.documentElement.style.setProperty('--' + key, value);
    const adminRoute = route === 'admin' || route.startsWith('admin/');
    $('#app').innerHTML = adminRoute ? body : header() + body + footer();
    if (!adminRoute) applyCopy($('#app'));
    bind();
    if (adminRoute) adminUI.bind();
    motion.enhancePage($('#app'), route !== lastRenderedRoute);
    lastRenderedRoute = route;
  } catch (error) { toast(error.message); }
}
function bindUploads(root) {
  root.querySelectorAll('[data-upload]').forEach(input => input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Ảnh tối đa 5 MB.');
    const buttons = [...root.querySelectorAll('button.primary')];
    buttons.forEach(button => { button.disabled = true; button.classList.add('is-pending'); button.setAttribute('aria-busy', 'true'); });
    try {
      const response = await fetch('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': me.csrf }, body: file });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      const target = root.querySelector('[name="' + input.dataset.upload + '"]');
      target.value = data.url;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      toast('Đã tải ảnh. Nhấn Lưu để áp dụng.');
    } catch (error) { toast(error.message); } finally { buttons.forEach(button => { button.disabled = false; button.classList.remove('is-pending'); button.removeAttribute('aria-busy'); }); }
  });
}
function bind() {
  if ($('#category-toggle')) {
    const toggle = $('#category-toggle'), panel = $('#category-panel'), menu = toggle.closest('.category-menu');
    const canHover = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    let closeTimer, openedByHover = false;
    const cancelClose = () => clearTimeout(closeTimer);
    menu.onpointerenter = event => {
      if (event.pointerType !== 'mouse' || !canHover.matches) return;
      cancelClose();
      if (toggle.getAttribute('aria-expanded') !== 'true') {
        openedByHover = true;
        motion.disclosure(toggle, panel, true);
      }
    };
    menu.onpointerleave = event => {
      if (event.pointerType !== 'mouse' || !canHover.matches) return;
      cancelClose();
      // Brief grace period bridges the space between the trigger and its panel.
      closeTimer = setTimeout(() => {
        if (!menu.isConnected || panel.contains(document.activeElement)) return;
        openedByHover = false;
        motion.disclosure(toggle, panel, false);
      }, 180);
    };
    menu.onfocusout = () => queueMicrotask(() => {
      if (menu.isConnected && !menu.contains(document.activeElement) && !menu.matches(':hover')) {
        cancelClose();
        openedByHover = false;
        motion.disclosure(toggle, panel, false);
      }
    });
    toggle.onclick = event => {
      cancelClose();
      const open = toggle.getAttribute('aria-expanded') === 'true';
      // A click following mouse entry keeps the newly opened list available.
      const mouseClick = event.detail > 0 && (event.pointerType === 'mouse' || (!event.pointerType && toggle.matches(':hover')));
      if (mouseClick && canHover.matches && openedByHover && open) {
        openedByHover = false;
        return;
      }
      openedByHover = false;
      motion.disclosure(toggle, panel, !open);
    };
    toggle.onkeydown = event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      cancelClose();
      openedByHover = false;
      motion.disclosure(toggle, panel, true);
      $('#category-panel a')?.focus();
    };
  }
  if ($('#settings')) bindUploads($('#settings'));
  if ($('#search')) $('#search').onsubmit = event => { event.preventDefault(); query = new FormData(event.currentTarget).get('q').trim(); location.hash = 'products'; render(); };
  document.querySelectorAll('[data-category],[data-filter]').forEach(button => button.onclick = () => { category = button.dataset.category ?? button.dataset.filter; if (location.hash !== '#products') location.hash = 'products'; else render(); });
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => add(Number(button.dataset.add), 1, button));
  document.querySelectorAll('[data-policy]').forEach(button => button.onclick = () => { const policy = config.policies[Number(button.dataset.policy)]; modal(`<span class="eyebrow">${esc(config.brand)}</span><h2>${esc(policy.title)}</h2><p class="policy">${esc(policy.body)}</p>`); });
  document.querySelectorAll('[data-article]').forEach(button => button.onclick = () => { const article = editorial().journal.articles[Number(button.dataset.article)]; modal(`<img class="article-modal-image" src="${esc(article.image)}" alt="${esc(article.title)}"><span class="eyebrow">${esc(editorial().journal.eyebrow)}</span><h2>${esc(article.title)}</h2><p class="article-intro">${esc(article.excerpt)}</p><p class="policy">${esc(article.body)}</p>`); });
  document.querySelectorAll('[data-gallery]').forEach(button => button.onclick = () => { $('#gallery-main-image').src = button.dataset.gallery; motion.imageChanged($('#gallery-main-image')); document.querySelectorAll('[data-gallery]').forEach(item => item.classList.toggle('active', item === button)); });
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => { const input = $('#detail-quantity'); input.value = Math.min(Number(input.max), Math.max(1, Number(input.value) + Number(button.dataset.step))); motion.quantityChanged(input); });
  if ($('#detail-add')) $('#detail-add').onclick = event => add(Number(event.currentTarget.dataset.productId), Number($('#detail-quantity').value), event.currentTarget);
  if ($('#sort-products')) $('#sort-products').onchange = event => { sort = event.target.value; render(); };
  if ($('#price-filter')) $('#price-filter').onchange = event => { priceRange = event.target.value; render(); };
  if ($('#reset-filters')) $('#reset-filters').onclick = () => { query = ''; category = ''; priceRange = ''; render(); };
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { cart = cart.filter(item => item.id !== Number(button.dataset.remove)); saveCart(); render(); });
  document.querySelectorAll('[data-quantity]').forEach(input => input.onchange = () => { const quantity = Number(input.value); if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) return render(); cart.find(item => item.id === Number(input.dataset.quantity)).quantity = quantity; saveCart(); render(); });
  if ($('#clear-search')) $('#clear-search').onclick = () => { query = ''; render(); };
  document.querySelectorAll('[data-auth]').forEach(button => button.onclick = () => { const mode = button.dataset.auth; $('#auth').dataset.mode = mode; $('#name-field').hidden = mode === 'login'; $('#name-field input').required = mode === 'register'; $('#auth button').innerHTML = esc(config.labels[mode]) + icon('arrow'); $('#auth input[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; document.querySelectorAll('[data-auth]').forEach(item => item.classList.toggle('active', item === button)); });
  if ($('#auth')) $('#auth').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; submit(form, async () => { me = await api('/' + form.dataset.mode, { method: 'POST', body: Object.fromEntries(new FormData(form)) }); await render(); toast('Đăng nhập thành công'); }); };
  if ($('#logout')) $('#logout').onclick = logoutSession;
  document.querySelectorAll('[data-own-password]').forEach(button => button.onclick = changePassword);
  if ($('#checkout')) $('#checkout').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; submit(form, async () => { const result = await api('/orders', { method: 'POST', body: { ...Object.fromEntries(new FormData(form)), items: cart.map(({ id, quantity }) => ({ id, quantity })) } }); cart = []; saveCart(); await refresh(); location.hash = 'account'; toast('Đã tạo đơn #' + result.id); }); };
  document.querySelectorAll('.order-status').forEach(form => form.onsubmit = event => { event.preventDefault(); submit(form, async () => { await api('/admin/orders/' + form.dataset.id, { method: 'PATCH', body: { status: new FormData(form).get('status') } }); await render(); toast('Đã cập nhật đơn hàng'); }); });
}
async function reloadUser() {
  me = await api('/me');
  if (!me.user && location.hash.startsWith('#admin')) location.hash = 'account';
}
async function logoutSession() {
  try { await api('/logout', { method: 'POST' }); me = { user: null }; location.hash = 'account'; await render(); }
  catch (error) { toast(error.message); }
}
function changePassword() {
  modal(`<h2>Đổi mật khẩu</h2><p>Mật khẩu mới cần từ 12 ký tự. Sau khi đổi, bạn sẽ đăng nhập lại trên các thiết bị.</p><form class="form" id="change-password"><label>Mật khẩu hiện tại<input type="password" name="currentPassword" required maxlength="128" autocomplete="current-password"></label><label>Mật khẩu mới<input type="password" name="newPassword" required minlength="12" maxlength="128" autocomplete="new-password"></label><label>Nhập lại mật khẩu mới<input type="password" name="confirmPassword" required minlength="12" maxlength="128" autocomplete="new-password"></label><p class="error" role="alert"></p><button class="primary">Đổi mật khẩu</button></form>`);
  const form = $('#change-password'); form.onsubmit = event => { event.preventDefault(); submit(form, async () => {
    if (form.elements.newPassword.value !== form.elements.confirmPassword.value) throw Error('Hai mật khẩu mới chưa trùng nhau.');
    await api('/account/password', { method: 'POST', body: { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value } });
    await motion.closeDialog($('#modal')); me = { user: null }; location.hash = 'account'; await render(); toast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
  }); };
}
const adminUI = createAdminUI({ api, esc, money, icon, modal, submit, statusNames, editProduct, orderCard, getUser: () => me.user, getConfig: () => config, getCsrf: () => me.csrf, products: () => products, refresh, render, reloadUser, logout: logoutSession, changePassword, toast, closeModal: () => motion.closeDialog($('#modal')) });
window.addEventListener('beforeunload', event => { if (adminUI.isDirty()) { event.preventDefault(); event.returnValue = ''; } });
motion.installDialog($('#modal'));
document.addEventListener('click', event => { if (!event.target.closest('.category-menu')) closeCategories(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#category-toggle')?.getAttribute('aria-expanded') === 'true') closeCategories(true); });
window.addEventListener('hashchange', () => { motion.closeDialog($('#modal'), { immediate: true }); render(); window.scrollTo({ top: 0, behavior: 'instant' }); });
try { [config, products, me] = await Promise.all([api('/settings'), api('/products'), api('/me')]); await render(); } catch (error) { $('#app').innerHTML = `<main class="wrap page"><h1>Không thể tải cửa hàng</h1><p>${esc(error.message)}</p><button id="reload" class="primary">Thử lại</button></main>`; $('#reload').onclick = () => location.reload(); }
