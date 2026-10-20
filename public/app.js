import { mountSkuEditor } from './sku-editor.js';
import { uploadImage } from './uploads.js';
import { cartView, orderExtras, extraPage, enhanceCommerce, orderManage } from './commerce-ui.js';
import { motion } from './motion.js';
import { createAdminUI } from './admin.js';
import { languageControl, updateLanguageContext } from './i18n.js';
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
let commerce, config, products, me = { user: null }, category = '', query = '', sort = 'newest', priceRange = '';
let cart;
try { cart = JSON.parse(localStorage.getItem('sn-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
cart = cart.filter(item => item && Number.isSafeInteger(item.id) && item.id > 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99);
cart = cart.filter(item => item.variant_id === undefined || Number.isSafeInteger(item.variant_id) && item.variant_id > 0);
cart = [...new Map(cart.map(item => [`${item.id}:${item.variant_id||0}`, item])).values()].slice(0,50);
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
const storeUpdateKey = 'sn-store-updated';
const isStorefront = route => route === '' || route === 'products' || route === 'inspiration' || /^(product|collection|page)\//.test(route);
let settingsRead, storeSync;
function readStoreSettings() {
  return settingsRead ||= api('/settings').finally(() => { settingsRead = null; });
}
function maySyncStorefront() {
  const route = location.hash.slice(1) || (location.pathname.startsWith('/san-pham/') ? 'product/' : '');
  return config && isStorefront(route) && document.visibilityState === 'visible' && !$('#modal').open &&
    !document.activeElement?.closest('input,textarea,select,[contenteditable="true"]');
}
async function syncStorefront() {
  if (!maySyncStorefront() || storeSync) return;
  storeSync = (async () => {
    const next = await readStoreSettings();
    if (maySyncStorefront() && JSON.stringify(next) !== JSON.stringify(config)) await render({ settings: next });
  })();
  try { await storeSync; } catch { /* Retry on the next focus or poll; keep the current page usable. */ }
  finally { storeSync = null; }
}
const headerObserver = new ResizeObserver(entries => {
  for (const entry of entries) if (entry.target.isConnected) {
    document.documentElement.style.setProperty('--storefront-header-height', Math.ceil(entry.target.getBoundingClientRect().height) + 'px');
  }
});
function watchHeader() {
  headerObserver.disconnect();
  const header = $('.storefront-header');
  document.documentElement.style.setProperty('--storefront-header-height', header ? Math.ceil(header.getBoundingClientRect().height) + 'px' : '0px');
  if (header) headerObserver.observe(header);
}
async function api(url, options = {}) {
  const response = await fetch('/api' + url, { ...options, headers: { 'Content-Type': 'application/json', ...(me.csrf ? { 'X-CSRF-Token': me.csrf } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (data.code === 'PASSWORD_CHANGE_REQUIRED' && me.user) {
      me.user.mustChangePassword = true; void motion.closeDialog($('#modal')); location.hash = 'change-password';
    }
    if (response.status === 401 && url.startsWith('/admin')) {
      me = { user: null }; motion.closeDialog($('#modal')); location.hash = 'account';
    }
    throw Error(data.error || 'Không thể xử lý yêu cầu.');
  }
  if (/^\/admin\/(settings|categories)(\/|$)/.test(url) && !['GET','HEAD'].includes(options.method || 'GET')) {
    try { localStorage.setItem(storeUpdateKey, Date.now() + ':' + Math.random()); } catch {}
  }
  return data;
}
function toast(message) { motion.showToast($('#toast'), message); }
function saveCart() { localStorage.setItem('sn-cart', JSON.stringify(cart)); }
function add(id, quantity = 1, source = null) {
  const product = products.find(item => item.id === id);
  if (!product?.stock) return toast('Sản phẩm đã hết hàng.');
  let variant_id;
  if (product.has_variants || product.variants?.length) {
    const selected = source?.id === 'detail-add' && Number(source.dataset.productId) === id ? Number($('#variant-picker')?.value) : 0;
    variant_id = product.variants?.find(variant => variant.id === selected)?.id;
    if (!variant_id) { location.hash = 'product/'+id; return toast('Chọn phiên bản trước khi thêm vào giỏ.'); }
  }
  const stock = variant_id ? product.variants.find(v=>v.id===variant_id)?.stock || 0 : product.stock;
  const item = cart.find(line => line.id === id && (line.variant_id||0)===(variant_id||0));
  if (!Number.isSafeInteger(quantity) || quantity < 1 || (item?.quantity || 0) + quantity > Math.min(stock, 99)) return toast('Số lượng vượt quá tồn kho hoặc giới hạn 99 sản phẩm.');
  if (item) item.quantity += quantity; else cart.push({ id, quantity, ...(variant_id?{variant_id}:{}) });
  saveCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(element => element.textContent = count);
  $('.cart-link')?.setAttribute('aria-label', `${config.labels.cart}: ${count}`);
  api('/events',{method:'POST',body:{event:'add_to_cart',product_id:id}}).catch(()=>{});
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
  $('#modal').innerHTML = `<button type="button" class="modal-close" aria-label="Đóng">${icon('close')}</button>` + html;
  motion.openDialog($('#modal'));
  $('#modal .modal-close').onclick = () => motion.closeDialog($('#modal'));
}
function header() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const route = location.hash.slice(1) || (location.pathname.startsWith('/san-pham/') ? 'product/'+Number(location.pathname.split('/')[2].split('-')[0]) : '');

  return `<div class="storefront-header"><div class="announcement"><div class="wrap"><span>${esc(config.announcement)}</span><div class="announcement-tools"><a href="#order/0">${ui('Theo dõi đơn hàng')} ${icon('arrow')}</a>${languageControl()}</div></div></div><p class="translation-status" data-translation-status role="status" aria-live="polite" hidden></p>
    <header class="header"><div class="wrap header-inner">
      <a class="brand-link" href="/" aria-label="${esc(config.brand)}"><img class="logo" src="${esc(config.logo)}" alt="${esc(config.brand)}"></a>
      <form class="search" id="search">${icon('search')}<input aria-label="Tìm sản phẩm" name="q" placeholder="${esc(config.searchPlaceholder)}" value="${esc(query)}"><button aria-label="Tìm kiếm">${icon('arrow')}</button></form>
      <div class="header-actions"><a href="#wishlist">${icon('heart')}<span>Yêu thích</span></a><a href="#support">${icon('mail')}<span>Tư vấn</span></a><a href="#account">${icon('user')}<span ${me.user ? 'data-original-content' : ''}>${me.user ? esc(me.user.name) : label('account')}</span></a><a class="cart-link" href="#cart">${icon('bag')}<span>${label('cart')}</span><b class="cart-count">${count}</b></a></div>
    </div><div class="nav-shell"><div class="wrap nav-frame"><div class="category-menu"><button class="category-toggle ${route === 'products' ? 'active' : ''}" id="category-toggle" aria-expanded="false" aria-controls="category-panel">${icon('menu')}<span>${esc(navigation().categoryLabel)}</span>${icon('down')}</button><div class="category-panel" id="category-panel" hidden><a class="${route === 'products' && !category ? 'active' : ''}" href="#products" data-category="">${esc(navigation().allLabel)}${icon('arrow')}</a>${config.categories.map(name => `<a class="${route === 'products' && category === name ? 'active' : ''}" href="#products" data-category="${esc(name)}">${esc(name)}${icon('chevron')}</a>`).join('')}</div></div><nav class="nav nav-tabs" aria-label="Điều hướng chính">${navigation().items.filter(item => item.enabled).map(item => `<a class="${'#' + route === navigationHref(item) ? 'active' : ''} ${item.id === 'rewards' ? 'rewards-link' : ''}" href="${navigationHref(item)}" ${'#' + route === navigationHref(item) ? 'aria-current="page"' : ''}>${item.id === 'rewards' ? esc(item.label).replace(/Rewards$/i, word => `<span class="rewards-word">${word}</span>`) : esc(item.label)}</a>`).join('')}${isStaff() ? `<a class="admin-link" href="#admin">${label('admin')}</a>` : ''}</nav></div></div></header></div>`;
}
function footer() {
  const content = editorial();
  return `<footer><div class="wrap"><div class="footer-top"><div><span class="eyebrow">${esc(config.brand)}</span><h2>${esc(content.footerHeading)}</h2><p class="footer-intro">${esc(content.footerText)}</p></div><a class="footer-explore" href="#products">${label('products')} ${icon('arrow')}</a></div><div class="footer-grid"><div class="footer-brand"><a href="#"><img src="${esc(config.logo)}" alt="${esc(config.brand)}"></a><p>${esc(config.footerText)}</p>${config.address ? `<p>${esc(config.address)}</p>` : ''}</div><div class="footer-links"><strong>${ui('Khám phá cửa hàng')}</strong>${config.categories.map(name => `<a href="#products" data-category="${esc(name)}">${esc(name)}</a>`).join('')}<a href="#account">${label('account')}</a></div><div class="footer-links"><strong>${ui('Thông tin & chính sách')}</strong>${config.policies.map((policy, index) => `<button data-policy="${index}">${esc(policy.title)}</button>`).join('')}</div><div class="footer-links"><strong>${ui('Liên hệ')}</strong>${config.phone ? `<a href="tel:${esc(config.phone.replace(/[^+\d]/g, ''))}">${icon('phone')}${esc(config.phone)}</a>` : ''}${config.email ? `<a href="mailto:${esc(config.email)}">${icon('mail')}${esc(config.email)}</a>` : ''}<a href="#account">${ui('Hỗ trợ đơn hàng')} ${icon('arrow')}</a><span class="payment-caption">${ui('Phương thức thanh toán')}</span><div class="payment-badges"><span>COD</span>${config.bankName && config.bankAccount && config.bankHolder ? `<span>${ui('Chuyển khoản')}</span>` : ''}</div></div></div><div class="copyright"><span>© ${new Date().getFullYear()} ${esc(config.brand)}. ${ui('Mọi quyền được bảo lưu.')}</span><span>${esc(config.tagline)}</span></div></div></footer>`;
}
function productCard(product) {
  const info = details(product);
  return `<article class="product"><a class="product-image" href="${esc(product.url || '#product/'+product.id)}" aria-label="${esc(product.name)}"><img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">${!product.stock ? `<span class="badge sold-out">${label('outOfStock')}</span>` : info.badge ? `<span class="badge">${esc(info.badge)}</span>` : ''}<span class="product-view">${label('details')} ${icon('arrow')}</span></a><div class="product-meta"><span class="category">${esc(product.category)}</span>${info.is_sample ? `<span class="sample-label">${ui('Mẫu tham khảo')}</span>` : ''}</div><h3><a href="${esc(product.url || '#product/'+product.id)}">${esc(product.name)}</a></h3>${info.summary ? `<p class="product-summary">${esc(info.summary)}</p>` : ''}<div class="product-bottom"><span class="price">${money(product.price)}</span><button class="add" data-add="${product.id}" aria-label="${label('add')} — ${esc(product.name)}" ${!product.stock ? 'disabled' : ''}>${icon('plus')}</button></div></article>`;
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
async function catalog() {
  const content = editorial();
  const result = await api('/catalog?'+new URLSearchParams({q:query,category,sort,price:priceRange,page:catalogPageNumber,limit:16}));
  const filtered = result.items;
  for(const item of filtered) { const index=products.findIndex(p=>p.id===item.id); if(index<0)products.push(item);else products[index]=item; }
  return `<main class="wrap page catalog-page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<span>${esc(navigation().categoryLabel)}</span></div><div class="catalog-intro"><div><span class="eyebrow">${esc(content.catalogEyebrow)}</span><h1>${esc(category || config.productsTitle)}</h1><p>${esc(content.catalogText)}</p></div><div class="catalog-intro-mark" aria-hidden="true">${icon('leaf')}</div></div><div class="catalog-filters"><div class="filters"><button class="chip ${!category ? 'active' : ''}" data-filter="">${label('all')}</button>${config.categories.map(name => `<button class="chip ${name === category ? 'active' : ''}" data-filter="${esc(name)}">${esc(name)}</button>`).join('')}</div><div class="catalog-controls"><label>${ui('Khoảng giá')}<select id="price-filter"><option value="">${ui('Tất cả mức giá')}</option><option value="under200" ${priceRange === 'under200' ? 'selected' : ''}>${ui('Dưới 200.000đ')}</option><option value="200to500" ${priceRange === '200to500' ? 'selected' : ''}>${ui('200.000đ – 500.000đ')}</option><option value="over500" ${priceRange === 'over500' ? 'selected' : ''}>${ui('Trên 500.000đ')}</option></select></label><label>${ui('Sắp xếp')}<select id="sort-products"><option value="newest" ${sort === 'newest' ? 'selected' : ''}>${ui('Mới nhất')}</option><option value="priceAsc" ${sort === 'priceAsc' ? 'selected' : ''}>${ui('Giá tăng dần')}</option><option value="priceDesc" ${sort === 'priceDesc' ? 'selected' : ''}>${ui('Giá giảm dần')}</option><option value="name" ${sort === 'name' ? 'selected' : ''}>${ui('Tên A – Z')}</option></select></label></div></div><div class="results-line"><span>${result.total} ${ui('sản phẩm')}${query ? ` ${ui('cho')} “${esc(query)}”` : ''}</span>${query ? `<button class="text-link" id="clear-search">${ui('Xóa tìm kiếm')} ${icon('close')}</button>` : ''}</div>${filtered.length ? `<div class="products">${filtered.map(productCard).join('')}</div><div class="button-row"><button class="secondary" data-catalog-page="${Math.max(1,result.page-1)}" ${result.page===1?'disabled':''}>Trang trước</button><span>Trang ${result.page}</span><button class="secondary" data-catalog-page="${result.page+1}" ${result.page*result.limit>=result.total?'disabled':''}>Trang sau</button></div>` : `<div class="empty">${icon('search')}<h2>${ui('Không tìm thấy sản phẩm phù hợp.')}</h2><button class="secondary" id="reset-filters">${ui('Xóa bộ lọc')}</button></div>`}</main>`;
}
async function navigationPage(id) {
  const item = navigation().items.find(entry => entry.id === id && entry.enabled);
  if (!item) return `<main class="wrap page"><div class="empty"><h1>Trang này hiện chưa được mở</h1><a class="primary" href="#products">${esc(navigation().allLabel)}</a></div></main>`;
  let selection = [];
  if (collectionIds.includes(id)) {
    if (item.productIds.length) { selection = (await Promise.all(item.productIds.map(id=>api('/products/'+id).catch(()=>null)))).filter(Boolean);for(const p of selection)if(!products.some(x=>x.id===p.id))products.push(p); }
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
  const gallery = [...new Set([product.image, ...(product.variants||[]).map(v=>v.image), ...(info.gallery || [])].filter(Boolean))];
  const related = products.filter(item => item.id !== id && item.category === product.category).slice(0, 4);
  const specs = info.specifications || [];
  return `<main class="wrap page product-page"><div class="breadcrumb"><a href="#">${ui('Trang chủ')}</a>${icon('chevron')}<a href="#products" data-category="${esc(product.category)}">${esc(product.category)}</a>${icon('chevron')}<span>${esc(product.name)}</span></div><div class="product-detail"><div class="gallery"><div class="gallery-main"><img id="gallery-main-image" src="${esc(product.image)}" alt="${esc(product.name)}">${info.badge ? `<span class="badge">${esc(info.badge)}</span>` : ''}</div>${gallery.length > 1 ? `<div class="gallery-thumbs">${gallery.map((image, index) => `<button class="${index === 0 ? 'active' : ''}" data-gallery="${esc(image)}" aria-label="Ảnh ${index + 1} — ${esc(product.name)}"><img src="${esc(image)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div><div class="detail-copy"><span class="eyebrow">${esc(product.category)}</span><h1>${esc(product.name)}</h1><p class="product-sku" id="selected-sku" ${info.sku?'':'hidden'}>${ui('Mã sản phẩm')}: ${esc(info.sku||'')}</p>${info.summary ? `<p class="detail-summary">${esc(info.summary)}</p>` : ''}<div class="detail-price">${money(product.price)}</div>${info.is_sample ? `<p class="sample-notice">${ui('Sản phẩm mẫu — hình ảnh, thông số và giá dùng để tham khảo giao diện.')}</p>` : ''}${info.features?.length ? `<ul class="detail-features">${info.features.map(feature => `<li>${icon('check')}<span>${esc(feature)}</span></li>`).join('')}</ul>` : ''}<div class="stock-state ${product.stock ? '' : 'unavailable'}"><span></span>${product.stock ? `${ui('Còn hàng')} · ${product.stock} ${ui('sản phẩm')}` : label('outOfStock')}</div><div class="purchase-row"><div class="quantity-stepper"><button data-step="-1" aria-label="Giảm số lượng">−</button><input id="detail-quantity" type="number" min="1" max="${Math.min(product.stock, 99) || 1}" value="1" aria-label="Số lượng"><button data-step="1" aria-label="Tăng số lượng">+</button></div><button class="primary" id="detail-add" data-product-id="${product.id}" ${!product.stock ? 'disabled' : ''}>${icon('bag')}${label('add')}</button></div><div class="detail-shipping">${icon('truck')}<div><strong>${ui('Giao hàng tiêu chuẩn')} ${money(config.shippingFee)}</strong><span>${ui('Miễn phí vận chuyển từ')} ${money(config.freeShipping)}</span></div></div><div class="detail-policy-links">${config.policies.slice(0, 2).map((policy, index) => `<button data-policy="${index}">${esc(policy.title)} ${icon('chevron')}</button>`).join('')}</div></div></div><div class="product-information"><section><span class="eyebrow">${ui('TÌM HIỂU SẢN PHẨM')}</span><h2>${ui('Chi tiết sản phẩm')}</h2><p class="policy">${esc(product.description)}</p>${info.care ? `<h3>${ui('Sử dụng & bảo quản')}</h3><p class="policy">${esc(info.care)}</p>` : ''}</section><section class="specifications"><h2>${ui('Thông số sản phẩm')}</h2><dl>${[['Mã sản phẩm', info.sku], ['Chất liệu', info.material], ['Kích thước', info.dimensions], ['Dung tích', info.capacity], ['Màu sắc', product.has_variants?(product.variants||[]).map(v=>v.label).join(', '):info.color], ...specs.map(spec => [spec.label, spec.value])].filter(([, value]) => value).map(([name, value]) => `<div><dt>${ui(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${!info.sku && !specs.length && !info.material && !info.dimensions && !info.capacity && !(product.has_variants?product.variants?.length:info.color) ? `<p class="muted">${ui('Thông số đang được cập nhật.')}</p>` : ''}</section></div>${related.length ? `<section class="section related-products">${sectionHeading(config.brand, config.ui?.['Có thể bạn cũng thích'] || 'Có thể bạn cũng thích', '', `<a class="text-link" href="#products" data-category="${esc(product.category)}">${ui('Xem thêm')} ${icon('arrow')}</a>`)}<div class="products">${related.map(productCard).join('')}</div></section>` : ''}</main>`;
}
function cartPage() { return cartView(commerceContext()); }
function authPage() {
  return `<main class="wrap page"><div class="auth-layout"><div class="auth-intro"><span class="eyebrow">${esc(config.brand)}</span><h1>${ui('Một tài khoản.\nThêm nhiều tiện ích.')}</h1><p>${ui('Đăng nhập để đặt hàng và theo dõi hành trình những món đồ bạn yêu thích.')}</p><img src="/images/scene-living.webp" alt="" loading="lazy"></div><div class="auth-form"><h2>${label('account')}</h2><div class="tabs"><button class="chip active" data-auth="login">${label('login')}</button><button class="chip" data-auth="register">${label('register')}</button></div><form class="form" id="auth" data-mode="login"><label id="name-field" hidden>${ui('Họ tên')}<input name="name" maxlength="100" autocomplete="name"></label><label>${ui('Email')}<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>${ui('Mật khẩu')}<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password"></label><p class="muted">${ui('Mật khẩu từ 12 ký tự. Không sử dụng mật khẩu của dịch vụ khác.')}</p><div class="error" role="alert"></div><label>Mã xác thực hai bước (nếu đã bật)<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="16"></label><button class="primary">${label('login')} ${icon('arrow')}</button></form><a class="text-link" href="#forgot">Quên mật khẩu?</a><a class="text-link" href="#order/0">Tra cứu đơn khách vãng lai</a></div></div></main>`;
}
function baseOrderCard(order, admin = false) {
  return `<article class="order"><div class="row"><strong>${ui('Đơn')} #${order.id}</strong><span class="order-state">${ui(statusNames[order.status])}</span></div><p class="muted">${new Date(order.created).toLocaleString('vi-VN')} · ${order.payment === 'cod' ? 'COD' : order.payment === 'vnpay' ? 'VNPay' : ui('Chuyển khoản')}</p>${order.items.map(item => `<div class="row order-line"><span data-original-content lang="vi">${esc(item.name)}${item.variant?' · '+esc(item.variant):''}${item.sku?' · '+esc(item.sku):''} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}<div class="row total"><span>${ui('Tổng cộng')} (${ui('Phí giao hàng')} ${money(order.shipping)})</span><span>${money(order.total)}</span></div><p class="muted" data-original-content lang="vi">${esc(order.recipient)} · ${esc(order.phone)}<br>${esc(order.address)}</p>${order.payment === 'bank' ? `<div class="notice">${esc(order.bank.name)} · ${esc(order.bank.account)}<br>${esc(order.bank.holder)}<br>${ui('Nội dung chuyển khoản')}: SN${order.id}. ${ui('Cửa hàng xác nhận thanh toán sau khi đối soát ngân hàng.')}</div>` : ''}${admin ? `<form class="row order-status" data-id="${order.id}"><select class="input" name="status">${Object.entries(statusNames).map(([value, text]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select><button class="primary">Cập nhật</button></form>` : ''}</article>`;
}
function orderCard(order, admin=false) { return baseOrderCard(order,admin)+orderExtras(order,commerceContext(),admin); }
async function accountPage() {
  if (!me.user) return authPage();
  const orders = await api('/orders');
  return `<main class="wrap page"><div class="account-heading"><div><span class="eyebrow">${ui('TÀI KHOẢN CỦA BẠN')}</span><h1 data-original-content>${esc(me.user.name)}</h1><p class="muted">${esc(me.user.email)}</p></div><div class="button-row">${isStaff() ? `<a href="#admin" class="primary">${label('admin')} ${icon('arrow')}</a>` : ''}<button class="secondary" data-own-password>Đổi mật khẩu</button><button class="secondary" id="logout">${label('logout')}</button></div></div><div class="button-row"><a class="secondary" href="#profile">Hồ sơ & bảo mật</a><a class="secondary" href="#wishlist">Yêu thích</a></div><h2>${label('orders')}</h2>${orders.length ? orders.map(order => orderCard(order)).join('') : `<div class="empty">${icon('bag')}<p>${ui('Chưa có đơn hàng.')}</p><a class="primary" href="#products">${label('products')}</a></div>`}</main>`;
}
function editorInput(name, title, value, multiline = false) {
  return `<label>${esc(title)}${multiline ? `<textarea name="${esc(name)}">${esc(value)}</textarea>` : `<input name="${esc(name)}" value="${esc(value)}">`}</label>`;
}

function editProduct(product = { name: '', category: config.categories[0] || '', description: '', price: 0, stock: 0, image: '', active: 0 }) {
  product = { ...product, price: product.base_price ?? product.price, stock: product.base_stock ?? product.stock };
  const info = details(product);
  modal(`<h2>${product.id ? 'Sửa' : 'Thêm'} sản phẩm</h2><p class="muted">Nhập thông tin cơ bản trước. Mở các nhóm bên dưới khi cần bổ sung nội dung chi tiết.</p><form id="product-form" class="form">
    <section class="product-editor-section"><h3>Thông tin cơ bản</h3><label>Tên sản phẩm<input name="name" required maxlength="200" value="${esc(product.name)}"></label>
    <div class="settings-grid"><label>Danh mục<select name="category">${[...new Set([...config.categories, product.category])].filter(Boolean).map(name => `<option ${name === product.category ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label><label>Trạng thái<select name="active"><option value="1" ${product.active ? 'selected' : ''}>Đang bán — hiện trên cửa hàng</option><option value="0" ${!product.active ? 'selected' : ''}>Đang ẩn — lưu bản nháp</option></select></label><label>Dữ liệu mẫu<select name="detail_is_sample"><option value="1" ${info.is_sample ? 'selected' : ''}>Mẫu tham khảo</option><option value="0" ${!info.is_sample ? 'selected' : ''}>Sản phẩm chính thức</option></select></label></div></section>
    <section class="product-editor-section"><h3>Ảnh sản phẩm</h3><img class="admin-image-preview" id="product-image-preview" src="${esc(product.image)}" alt="Ảnh chính" ${product.image ? '' : 'hidden'}><label>Tải ảnh chính lên<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="image"><small>PNG, JPG hoặc WebP, tối đa 5 MB. Nhấn Lưu sản phẩm sau khi tải.</small></label><label>Hoặc dùng đường dẫn ảnh<input name="image" value="${esc(product.image)}" placeholder="/uploads/anh.webp hoặc https://..."></label><details class="admin-section"><summary>Thêm ảnh trong thư viện</summary>${editorInput('detail_gallery', 'Mỗi dòng một đường dẫn ảnh', (info.gallery || []).join('\n'), true)}</details></section>
    <section class="product-editor-section" id="sku-editor"></section><section class="product-editor-section"><h3>Nội dung giới thiệu</h3>${editorInput('detail_summary', 'Giới thiệu ngắn (trên thẻ sản phẩm)', info.summary, true)}<label>Mô tả chi tiết<textarea name="description" maxlength="10000">${esc(product.description)}</textarea></label></section>
    <details class="admin-section"><summary>Thông số & đặc điểm sản phẩm</summary><div class="settings-grid">${[['material', 'Chất liệu'], ['dimensions', 'Kích thước'], ['capacity', 'Dung tích']].map(([key, title]) => editorInput('detail_' + key, title, info[key])).join('')}</div>${editorInput('detail_badge', 'Nhãn nổi bật trên thẻ sản phẩm', info.badge)}${editorInput('detail_features', 'Đặc điểm nổi bật (mỗi dòng một mục)', (info.features || []).join('\n'), true)}${editorInput('detail_specifications', 'Thông số khác (mỗi dòng: tên thông số: giá trị)', (info.specifications || []).map(spec => spec.label + ': ' + spec.value).join('\n'), true)}${editorInput('detail_care', 'Hướng dẫn sử dụng & bảo quản', info.care, true)}</details>
    <div class="error" role="alert"></div><button type="submit" class="primary">Lưu sản phẩm ${icon('check')}</button></form>`);
  const productForm = $('#product-form');
  productForm.elements.name.focus({ preventScroll: true });
  productForm.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.target.matches('input')) event.preventDefault();
  });
  bindUploads(productForm);
  const imageInput = $('#product-form [name="image"]');
  const preview = () => { const img = $('#product-image-preview'); img.hidden = !imageInput.value; img.src = imageInput.value; };
  imageInput.addEventListener('input', preview);
  imageInput.addEventListener('change', preview);
  const skuEditor = mountSkuEditor($('#sku-editor'), { product, esc, cover:imageInput, upload:file=>uploadImage(file,{form:productForm,csrf:me.csrf}), toast });
  $('#product-form').onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      const data = Object.fromEntries(new FormData(form));
      const body = Object.fromEntries(['name', 'category', 'description', 'image'].map(key => [key, data[key]]));
      const skuRows=skuEditor.read(), multiple=skuRows.length>1||skuEditor.hasVariants;
      body.price=skuEditor.hasVariants?product.price:skuRows[0].price;body.active=Number(data.active);if(!product.id)body.stock=multiple?0:skuRows[0].stock;
      body.image=data.image||skuRows[0].image;
      body.details = {};
      for (const key of ['summary', 'material', 'dimensions', 'capacity', 'badge', 'care']) body.details[key] = data['detail_' + key].trim();
      body.details.sku=multiple?'':skuRows[0].sku;
      body.details.color=multiple?(info.color||''):skuRows[0].label;
      if(multiple&&(!product.id||skuEditor.changed()))body.skus=skuRows;
      body.details.features = lines(data.detail_features);
      body.details.gallery = lines(data.detail_gallery);
      body.details.specifications = lines(data.detail_specifications).map(line => { const index = line.indexOf(':'); if (index < 1 || !line.slice(index + 1).trim()) throw Error('Mỗi thông số cần có dạng “Tên: giá trị”.'); return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() }; });
      body.details.is_sample = data.detail_is_sample === '1';
      if (product.id) {
        body.details = Object.fromEntries(Object.entries(body.details).filter(([key,value]) => JSON.stringify(value) !== JSON.stringify(info[key])));
        if (!Object.keys(body.details).length) delete body.details;
        for (const key of ['name','category','description','image','price','active']) if (body[key] === product[key]) delete body[key];
        body.revision = product.revision;
      }
      await api('/admin/products' + (product.id ? '/' + product.id : ''), { method: product.id ? 'PATCH' : 'POST', body });
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
async function loadProducts(){const first=(await api('/catalog?limit=16')).items;const missing=[...new Set(cart.map(l=>l.id))].filter(id=>!first.some(p=>p.id===id));const extra=await Promise.all(missing.map(id=>api('/products/'+id).catch(()=>null)));return first.concat(extra.filter(Boolean));}
async function refresh() { [config, products, commerce, me] = await Promise.all([api('/settings'), loadProducts(), api('/commerce'), api('/me')]); await render(); }
function commerceContext() { return { api, esc, money, me, config, commerce, products, cart, saveCart, toast, submit, render, refresh, productCard, orderCard, editProduct, reloadUser, imageChanged: image=>motion.imageChanged(image) }; }
let generation = 0, lastRenderedRoute, catalogPageNumber=1;
async function render({ settings } = {}) {
  const current = ++generation;
  try {
    let route = location.hash.slice(1) || (location.pathname.startsWith('/san-pham/') ? 'product/'+Number(location.pathname.split('/')[2].split('-')[0]) : '');
    if (me.user?.mustChangePassword) { route = 'change-password'; if (location.hash !== '#change-password') history.replaceState(null, '', '#change-password'); }
    if (isStorefront(route)) {
      const next = settings || await readStoreSettings();
      if (current !== generation) return;
      const changed = JSON.stringify(next) !== JSON.stringify(config);
      let nextProducts = products;
      if (changed) {
        nextProducts = await loadProducts();
        if (current !== generation) return;
      }
      config = next; products = nextProducts;
      if (category && !config.categories.includes(category)) { category = ''; catalogPageNumber = 1; }
    }
    if(route.startsWith('product/')) { try { const item=await api('/products/'+Number(route.split('/')[1]));products=products.filter(p=>p.id!==item.id).concat(item); } catch {} }
    const extra = route === 'change-password' ? requiredPasswordPage() : route.startsWith('manage') ? await adminUI.page(({commerce:'commerce',inventory:'inventory'}[route.split('/')[1]] || route.split('/')[1] || 'overview').split('?')[0]) : await extraPage(route, commerceContext());
    const body = extra ?? (route === 'cart' ? cartPage() : route === 'account' ? await accountPage() : (route === 'admin' || route.startsWith('admin/')) ? await adminUI.page(route.split('/')[1] || '') : route === 'products' ? await catalog() : route.startsWith('collection/') || route.startsWith('page/') ? await navigationPage(route.split('/')[1]) : route.startsWith('product/') ? productPage(Number(route.split('/')[1])) : route === 'inspiration' ? `<main class="wrap page">${journalSection()}</main>` : home());
    if (current !== generation) return;
    const activeProduct = route.startsWith('product/') && products.find(item => item.id === Number(route.split('/')[1]));
    const activePage = navigation().items.find(item => navigationHref(item) === '#' + route);
    document.title = (activeProduct ? activeProduct.name : activePage ? activePage.title : config.brand) + ' — ' + config.tagline;
    const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=location.origin+(activeProduct?.url||'/');
    if(activeProduct){document.querySelector('meta[name="description"]')?.setAttribute('content',(activeProduct.details?.summary||activeProduct.description).slice(0,300));document.querySelector('meta[property="og:title"]')?.setAttribute('content',activeProduct.name+' | '+config.brand);document.querySelector('meta[property="og:url"]')?.setAttribute('content',location.origin+activeProduct.url);}
    for (const [key, value] of Object.entries(config.colors)) document.documentElement.style.setProperty('--' + key, value);
    const adminRoute = route === 'admin' || route.startsWith('admin/') || route.startsWith('manage');
    $('#app').innerHTML = adminRoute ? body : header() + body + footer();
    watchHeader();
    if (!adminRoute) applyCopy($('#app'));
    document.querySelectorAll('a[href^="#product/"]').forEach(a=>{const p=products.find(p=>p.id===Number(a.getAttribute('href').split('/')[1]));if(p?.url)a.href=p.url;});
    updateLanguageContext({...commerceContext(),route});
    bind();
    if (adminRoute) adminUI.bind();
    enhanceCommerce(commerceContext()).catch(error=>toast(error.message));
    motion.enhancePage($('#app'), route !== lastRenderedRoute);
    if(route!==lastRenderedRoute && (route==='cart'||activeProduct))api('/events',{method:'POST',body:{event:route==='cart'?'checkout_start':'product_view',...(activeProduct?{product_id:activeProduct.id}:{})}}).catch(()=>{});
    lastRenderedRoute = route;
  } catch (error) { toast(error.message); }
}
function bindUploads(root) {
  root.querySelectorAll('[data-upload]').forEach(input=>input.onchange=async()=>{
    const file=input.files[0];if(!file)return;
    try {const target=root.querySelector('[name="'+input.dataset.upload+'"]');target.value=await uploadImage(file,{form:root,csrf:me.csrf});target.dispatchEvent(new Event('change',{bubbles:true}));toast('Đã tải ảnh. Nhấn Lưu để áp dụng.');}
    catch(error){toast(error.message);}
  });
}

function bind() {
  if ($('#required-password')) bindPasswordForm($('#required-password'));
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
  if ($('#search')) $('#search').onsubmit = event => { event.preventDefault(); query = new FormData(event.currentTarget).get('q').trim(); catalogPageNumber=1; location.hash = 'products'; render(); };
  document.querySelectorAll('[data-category],[data-filter]').forEach(button => button.onclick = () => {
    category = button.dataset.category ?? button.dataset.filter;
    catalogPageNumber = 1;
    // Links navigate through their href; changing the hash here as well would
    // add a second history entry before the product-link handler runs.
    if (location.hash === '#products') render();
    else if (!button.matches('a[href]')) location.hash = 'products';
  });
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => add(Number(button.dataset.add), 1, button));
  document.querySelectorAll('[data-policy]').forEach(button => button.onclick = () => { const policy = config.policies[Number(button.dataset.policy)]; modal(`<span class="eyebrow">${esc(config.brand)}</span><div data-original-content lang="vi"><h2>${esc(policy.title)}</h2><p class="policy">${esc(policy.body)}</p></div><p class="muted">Chính sách được giữ nguyên bằng tiếng Việt.</p>`); });
  document.querySelectorAll('[data-article]').forEach(button => button.onclick = () => { const article = editorial().journal.articles[Number(button.dataset.article)]; modal(`<img class="article-modal-image" src="${esc(article.image)}" alt="${esc(article.title)}"><span class="eyebrow">${esc(editorial().journal.eyebrow)}</span><h2>${esc(article.title)}</h2><p class="article-intro">${esc(article.excerpt)}</p><p class="policy">${esc(article.body)}</p>`); });
  document.querySelectorAll('[data-gallery]').forEach(button => button.onclick = () => { $('#gallery-main-image').src = button.dataset.gallery; motion.imageChanged($('#gallery-main-image')); document.querySelectorAll('[data-gallery]').forEach(item => item.classList.toggle('active', item === button)); });
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => { const input = $('#detail-quantity'); input.value = Math.min(Number(input.max), Math.max(1, Number(input.value) + Number(button.dataset.step))); motion.quantityChanged(input); });
  if ($('#detail-add')) $('#detail-add').onclick = event => add(Number(event.currentTarget.dataset.productId), Number($('#detail-quantity').value), event.currentTarget);
  if ($('#sort-products')) $('#sort-products').onchange = event => { sort = event.target.value; catalogPageNumber=1; render(); };
  document.querySelectorAll('[data-catalog-page]').forEach(b=>b.onclick=()=>{catalogPageNumber=Number(b.dataset.catalogPage);render();});
  if ($('#price-filter')) $('#price-filter').onchange = event => { priceRange = event.target.value; catalogPageNumber=1; render(); };
  if ($('#reset-filters')) $('#reset-filters').onclick = () => { query = ''; category = ''; priceRange = ''; render(); };
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { cart = cart.filter(item => item.id !== Number(button.dataset.remove)); saveCart(); render(); });
  document.querySelectorAll('[data-quantity]').forEach(input => input.onchange = () => { const quantity = Number(input.value); if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) return render(); cart.find(item => item.id === Number(input.dataset.quantity)).quantity = quantity; saveCart(); render(); });
  if ($('#clear-search')) $('#clear-search').onclick = () => { query = ''; render(); };
  document.querySelectorAll('[data-auth]').forEach(button => button.onclick = () => { const mode = button.dataset.auth; $('#auth').dataset.mode = mode; $('#name-field').hidden = mode === 'login'; $('#name-field input').required = mode === 'register'; $('#auth button').innerHTML = esc(config.labels[mode]) + icon('arrow'); $('#auth input[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; document.querySelectorAll('[data-auth]').forEach(item => item.classList.toggle('active', item === button)); });
  if ($('#auth')) $('#auth').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; submit(form, async () => { me = await api('/' + form.dataset.mode, { method: 'POST', body: Object.fromEntries(new FormData(form)) }); await render(); toast('Đăng nhập thành công'); }); };
  if ($('#logout')) $('#logout').onclick = logoutSession;
  document.querySelectorAll('[data-own-password]').forEach(button => button.onclick = changePassword);
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
function passwordFields() {
  return `<label>Mật khẩu hiện tại<input type="password" name="currentPassword" required maxlength="128" autocomplete="current-password"></label><label>Mật khẩu mới<input type="password" name="newPassword" required minlength="12" maxlength="128" autocomplete="new-password"></label><label>Nhập lại mật khẩu mới<input type="password" name="confirmPassword" required minlength="12" maxlength="128" autocomplete="new-password"></label><label>Mã xác thực hai bước (nếu đã bật)<input name="otp" autocomplete="one-time-code" maxlength="16"></label><p class="error" role="alert"></p><button class="primary">Đổi mật khẩu</button>`;
}
function requiredPasswordPage() {
  if (!me.user) return authPage();
  return `<main class="wrap page narrow"><h1>Đặt mật khẩu riêng</h1><p>Xin chào ${esc(me.user.name)}. Hãy thay mật khẩu do quản trị viên cấp bằng mật khẩu riêng trước khi sử dụng tài khoản. Mật khẩu mới cần từ 12–128 ký tự.</p><form class="form" id="required-password">${passwordFields()}</form><button class="text-link" id="logout">Đăng xuất</button></main>`;
}
function bindPasswordForm(form) {
  form.onsubmit = event => { event.preventDefault(); submit(form, async () => {
    if (form.elements.newPassword.value !== form.elements.confirmPassword.value) throw Error('Hai mật khẩu mới chưa trùng nhau.');
    await api('/account/password', { method: 'POST', body: { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value, otp: form.elements.otp.value } });
    await motion.closeDialog($('#modal')); me = { user: null }; location.hash = 'account'; await render(); toast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
  }); };
}
function changePassword() {
  modal(`<h2>Đổi mật khẩu</h2><p>Mật khẩu mới cần từ 12 ký tự. Sau khi đổi, bạn sẽ đăng nhập lại trên các thiết bị.</p><form class="form" id="change-password">${passwordFields()}</form>`);
  bindPasswordForm($('#change-password'));
}

const adminUI = createAdminUI({ api, esc, money, icon, modal, submit, statusNames, editProduct, orderCard, orderManage: o => orderManage(o, commerceContext()), commercePage: section => extraPage('manage/' + section, { ...commerceContext(), adminEmbedded: true }), enhanceModal: () => enhanceCommerce({ ...commerceContext(), refresh: async () => { await motion.closeDialog($('#modal')); await refresh(); } }), getUser: () => me.user, getConfig: () => config, getCsrf: () => me.csrf, products: () => products, refresh, render, reloadUser, logout: logoutSession, changePassword, toast, closeModal: () => motion.closeDialog($('#modal')) });
window.addEventListener('beforeunload', event => { if (adminUI.isDirty()) { event.preventDefault(); event.returnValue = ''; } });
motion.installDialog($('#modal'));
window.addEventListener('focus', syncStorefront);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncStorefront(); });
window.addEventListener('storage', event => { if (event.key === storeUpdateKey) void syncStorefront(); });
setInterval(syncStorefront, 15000);
window.addEventListener('popstate',()=>render());
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/san-pham/')) return;
  // Fragment links inherit the product pathname. Route them from the storefront
  // root, including href="#" which must open home rather than the same product.
  if (link.getAttribute('href').startsWith('#')) url.pathname = '/';
  event.preventDefault();
  history.pushState({}, '', url.pathname + url.search + url.hash);
  motion.closeDialog($('#modal'), { immediate: true });
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
document.addEventListener('click', event => { if (!event.target.closest('.category-menu')) closeCategories(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#category-toggle')?.getAttribute('aria-expanded') === 'true') closeCategories(true); });
window.addEventListener('hashchange', () => { motion.closeDialog($('#modal'), { immediate: true }); render(); window.scrollTo({ top: 0, behavior: 'instant' }); });
try { [config, products, me, commerce] = await Promise.all([api('/settings'), loadProducts(), api('/me'), api('/commerce')]); await render(); } catch (error) { $('#app').innerHTML = `<main class="wrap page"><h1>Không thể tải cửa hàng</h1><p>${esc(error.message)}</p><button id="reload" class="primary">Thử lại</button></main>`; $('#reload').onclick = () => location.reload(); }
