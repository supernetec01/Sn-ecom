import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readProduct } from './store.js';
import { decorateProduct } from './commerce-store.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installSeo(app,db,settings){
 const template=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
 const origin=req=>(process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
 app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /uploads/\nSitemap: ${origin(req)}/sitemap.xml\n`));
 app.get('/sitemap.xml',(req,res)=>{const paths=['/',...db.prepare('SELECT * FROM products WHERE active=1').all().map(p=>decorateProduct(db,p,readProduct).url)];res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>`<url><loc>${esc(origin(req)+p)}</loc></url>`).join('')+'</urlset>');});
 app.get(['/','/san-pham/:slug'],(req,res)=>{
  const s=settings();let p;if(req.params.slug){const id=Number(req.params.slug.split('-')[0]);const row=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(id);if(!row)return res.status(404).type('html').send('<html lang="vi"><meta charset="utf-8"><title>Không tìm thấy sản phẩm</title><h1>Không tìm thấy sản phẩm</h1><a href="/">Về cửa hàng</a></html>');p=decorateProduct(db,row,readProduct);if('/san-pham/'+req.params.slug!==p.url){const language=['vi','en','zh-TW'].includes(req.query.lang)?'?lang='+encodeURIComponent(req.query.lang):'';return res.redirect(301,p.url+language);}}
  const url=origin(req)+(p?.url||'/'),title=p?`${p.name} | ${s.brand}`:s.brand,description=(p?.details?.summary||p?.description||s.tagline).slice(0,300);const src=p?.image||s.heroImage;const picture=src?new URL(src,origin(req)).href:'';const nonce=randomBytes(16).toString('base64');
  const productSchema=p?{'@context':'https://schema.org','@type':'Product',name:p.name,description,image:picture,...(p.details?.sku?{sku:p.details.sku}:{}),offers:{'@type':'Offer',priceCurrency:'VND',price:p.price,availability:'https://schema.org/'+(p.stock?'InStock':'OutOfStock'),url}}:null;
  const metadata=`<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="${p?'product':'website'}">${picture?`<meta property="og:image" content="${esc(picture)}">`:''}${productSchema?`<script type="application/ld+json" nonce="${nonce}">${JSON.stringify(productSchema).replaceAll('<','\\u003c')}</script>`:''}`;
  const fallback=p?`<main class="wrap page"><h1>${esc(p.name)}</h1><img src="${esc(p.image)}" alt="${esc(p.name)}" width="400"><p>${esc(p.description)}</p><p>${p.price.toLocaleString('vi-VN')} đ · ${p.stock?'Còn hàng':'Hết hàng'}</p><a href="/#cart">Giỏ hàng</a><noscript>Bật JavaScript để chọn phiên bản và đặt hàng.</noscript></main>`:`<main class="wrap page"><h1>${esc(s.brand)}</h1><p>${esc(s.tagline)}</p>${db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id DESC LIMIT 16').all().map(row=>{const item=decorateProduct(db,row,readProduct);return `<p><a href="${esc(item.url)}">${esc(item.name)}</a> · ${item.price.toLocaleString('vi-VN')} đ</p>`;}).join('')}</main>`;
  const csp=res.getHeader('Content-Security-Policy');if(csp)res.setHeader('Content-Security-Policy',String(csp).replace("script-src 'self'",`script-src 'self' 'nonce-${nonce}'`));
  res.type('html').send(template.replace(/<title>.*?<\/title>/,'<title>'+esc(title)+'</title>').replace(/<meta name="description"[^>]*>/,metadata).replace('<div id="app"><p class="loading">Đang tải Super Net…</p></div>','<div id="app">'+fallback+'</div>'));
 });
}
