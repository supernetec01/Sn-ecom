import { interfaceText } from './i18n-copy.js';

const supported = new Set(['vi','en','zh-TW']);
let language = 'vi';
try {
  const explicit = new URL(location.href).searchParams.get('lang');
  const saved = localStorage.getItem('sn-language');
  language = supported.has(explicit) ? explicit : supported.has(saved) ? saved : 'vi';
} catch { /* Storage may be unavailable; the default remains usable. */ }

const translatedCopy = {en:new Map(), 'zh-TW':new Map()};
const textSources = new WeakMap(), attributeSources = new WeakMap();
const responses = new Map();
let context, sequence = 0, controller, scheduled = false, mode = 'source';
const privateRoute = route => /^(account|change-password|order\/|profile|manage|admin|forgot|reset\/|verify\/)/.test(route);
const editorRoute = route => route === 'admin' || route.startsWith('admin/') || route.startsWith('manage');

export const currentLanguage = () => language;
export const t = source => interfaceText(source,language);
export function languageControl() {
  return `<label class="language-control"><span class="visually-hidden">Ngôn ngữ</span><select data-language-select aria-label="Ngôn ngữ"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="zh-TW">繁體中文</option></select></label>`;
}

function translate(source, dynamic = true) {
  const key = source.trim();
  if (!key || language === 'vi') return source;
  const local = interfaceText(key,language);
  const result = local !== key ? local : dynamic ? translatedCopy[language]?.get(key) ?? key : key;
  return source.replace(key,result);
}

function original(current, record) {
  // Preserve source when switching languages; also recognize later application
  // updates to the same node (validation, quote, stock and address loading).
  return record && current === record.rendered ? record.source : current;
}
function excluded(element) {
  return element.closest('script,style,textarea,code,pre,[data-original-content],[data-source-editor],[data-language-select]') ||
    (element.matches('option') && element.value && element.closest('[data-vn-province],[data-vn-ward]'));
}
function updateStatus() {
  const element = document.querySelector('[data-translation-status]');
  if (!element) return;
  const notices = {
    loading:{vi:'',en:'Translating store content…','zh-TW':'正在翻譯商店內容…'},
    fallback:{vi:'',en:'Some content is shown in Vietnamese.','zh-TW':'部分內容以越南文顯示。'},
    editor:{vi:'',en:'Administration and source content are shown in Vietnamese.','zh-TW':'管理後台與原始內容以越南文顯示。'},
  };
  const status = editorRoute(context?.route || '') ? 'editor' : mode === 'loading' ? 'loading' : mode !== 'translated' ? 'fallback' : '';
  const message = language === 'vi' ? '' : notices[status]?.[language] || '';
  element.hidden = !message;
  element.textContent = message;
  element.setAttribute('aria-busy',String(mode === 'loading'));
}

const observer = new MutationObserver(() => schedule());
function apply() {
  scheduled = false;
  observer.disconnect();
  document.documentElement.lang = language;
  const root = document.querySelector('#app main');
  if (root) {
    if (editorRoute(context?.route || '')) root.setAttribute('data-source-editor','');
    else root.removeAttribute('data-source-editor');
  }
  const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let node;
  while ((node=walker.nextNode())) {
    if (excluded(node.parentElement)) continue;
    const source = original(node.nodeValue,textSources.get(node));
    const dynamic = !node.parentElement.closest('.order,.commerce-order') && !privateRoute(context?.route || '');
    const rendered = translate(source,dynamic);
    textSources.set(node,{source,rendered});
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }
  for (const element of document.querySelectorAll('[placeholder],[aria-label],[alt],[title]')) {
    if (excluded(element)) continue;
    const records = attributeSources.get(element) || {};
    for (const attr of ['placeholder','aria-label','alt','title']) {
      if (!element.hasAttribute(attr)) continue;
      const source = original(element.getAttribute(attr),records[attr]);
      const rendered = translate(source,!privateRoute(context?.route || ''));
      records[attr] = {source,rendered};
      if (element.getAttribute(attr) !== rendered) element.setAttribute(attr,rendered);
    }
    attributeSources.set(element,records);
  }
  for (const select of document.querySelectorAll('[data-language-select]')) select.value=language;
  for (const link of document.querySelectorAll('a[href]')) {
    if (link.getAttribute('href').startsWith('#')) continue;
    const url=new URL(link.href,location.href);
    if (url.origin!==location.origin || !(url.pathname==='/' || url.pathname.startsWith('/san-pham/'))) continue;
    if(language==='vi')url.searchParams.delete('lang');else url.searchParams.set('lang',language);
    link.setAttribute('href',url.pathname+url.search+url.hash);
  }
  updateStatus();
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','alt','title']});
}
function schedule() {
  if (!scheduled) { scheduled=true; queueMicrotask(apply); }
}

async function loadCopy() {
  const current = ++sequence, selected=language;
  controller?.abort(); controller=new AbortController();
  if (!context || selected === 'vi' || editorRoute(context.route)) { mode='source'; apply(); return; }
  const {api,config,products,cart,route} = context;
  const active = Number(route.match(/^product\/(\d+)/)?.[1]);
  const visible = [...document.querySelectorAll('[data-add]')].map(e=>Number(e.dataset.add));
  const ids = [...new Set([...(active?[active]:[]),...visible,...(route==='cart'?cart.map(l=>l.id):[])])].slice(0,24);
  // Context is used only for local cache invalidation, never sent as text to the API.
  const fingerprint = JSON.stringify([config,products.filter(p=>ids.includes(p.id))]);
  const key = JSON.stringify([selected,ids,fingerprint]);
  const old = responses.get(key);
  if (old && old.expires > Date.now()) { mode=old.mode; apply(); return; }
  mode='loading'; apply();
  try {
    let complete=true;
    const requests=[{page_type:'storefront'},...(ids.length?[{page_type:'products',product_ids:ids}]:[])];
    for (const request of requests) {
      for (let batch=0;batch<4;batch++) {
        const result = await api('/i18n/translate-page',{
          method:'POST',signal:controller.signal,body:{...request,source_language:'vi',target_language:selected},
        });
        if (current !== sequence || selected !== language) return;
        let added=0;
        for (const item of result.translations || []) {
          if (typeof item.source==='string' && typeof item.translated==='string') {
            if (!translatedCopy[selected].has(item.source)) added++;
            translatedCopy[selected].set(item.source,item.translated);
          }
        }
        apply();
        if (result.mode === 'translated') break;
        if (result.mode !== 'partial' || !added || batch === 3) { complete=false; break; }
      }
    }
    if (current !== sequence) return;
    mode=complete?'translated':'unavailable';
    if (responses.size>=50) responses.delete(responses.keys().next().value);
    responses.set(key,{mode,expires:Date.now()+(complete?300000:30000)});
  } catch (error) {
    if (current !== sequence || error.name==='AbortError') return;
    mode='unavailable';
  }
  if (current===sequence) apply();
}

export function updateLanguageContext(value) {
  context=value;
  apply();
  void loadCopy();
}
document.addEventListener('change',event=>{
  if (!event.target.matches('[data-language-select]') || !supported.has(event.target.value)) return;
  language=event.target.value;
  try { localStorage.setItem('sn-language',language); } catch { /* Keep current selection in memory. */ }
  const url=new URL(location.href);
  if (language==='vi') url.searchParams.delete('lang');else url.searchParams.set('lang',language);
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  // No page render: cart state, field values, focus and the current route survive.
  apply();
  void loadCopy();
});
window.addEventListener('popstate',()=>{
  const explicit=new URL(location.href).searchParams.get('lang');
  const selected=explicit===null?'vi':explicit;
  if (!supported.has(selected) || language===selected) return;
  language=selected;
  try { localStorage.setItem('sn-language',language); } catch { /* Current page still works. */ }
  apply();
  void loadCopy();
});
apply();
