import { createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { dictionaries } from './public/i18n-copy.js';

const languages = new Set(['vi', 'en', 'zh-TW']);
const version = 'public-copy-v1';
const hash = text => createHash('sha256').update(text).digest('hex');
const day = () => new Date().toISOString().slice(0, 10);
const bounded = (value, fallback, maximum) => value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0
  ? Math.min(Number(value), maximum) : fallback;

export function migrateTranslations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_cache (
      source_hash TEXT NOT NULL, language TEXT NOT NULL, version TEXT NOT NULL,
      translated TEXT NOT NULL, expires INTEGER NOT NULL,
      PRIMARY KEY(source_hash, language, version)
    );
    CREATE TABLE IF NOT EXISTS translation_daily_budget (
      day TEXT PRIMARY KEY, characters INTEGER NOT NULL CHECK(characters>=0)
    );
    CREATE TABLE IF NOT EXISTS translation_api_usage (
      id INTEGER PRIMARY KEY, content_type TEXT NOT NULL, target_language TEXT NOT NULL,
      character_count INTEGER NOT NULL, cache_hit INTEGER NOT NULL,
      status TEXT NOT NULL, created TEXT NOT NULL
    );
  `);
}

// Only public catalog/editorial fields are eligible. Never accept browser-supplied
// text, orders, addresses, reviews, account data, payment details or legal policies.
function publicCopy(db, body) {
  const settings = JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  const texts = new Set();
  const add = value => {
    if (typeof value === 'string' && value.trim() && value.length <= 10000 && !Object.hasOwn(dictionaries[body.target_language] || {}, value)) texts.add(value);
  };
  if (body.page_type === 'storefront') {
    for (const key of ['tagline','announcement','heroEyebrow','heroTitle','heroText','heroButton',
      'collectionTitle','collectionText','productsTitle','searchPlaceholder','footerText']) add(settings[key]);
    settings.categories?.forEach(add);
    settings.benefits?.forEach(add);
    Object.values(settings.labels || {}).forEach(add);
    Object.values(settings.ui || {}).forEach(add);
    const editorial = settings.editorial || {};
    for (const key of ['collectionEyebrow','featuredEyebrow','featuredTitle','featuredText','featuredButton',
      'catalogEyebrow','catalogText','serviceTitle','footerHeading','footerText']) add(editorial[key]);
    for (const item of editorial.categoryImages || []) add(item.caption);
    for (const key of ['eyebrow','title','text','button']) add(editorial.story?.[key]);
    for (const key of ['eyebrow','title','text']) add(editorial.journal?.[key]);
    for (const article of editorial.journal?.articles || []) {
      for (const key of ['title','excerpt','body']) add(article[key]);
    }
    add(settings.navigation?.categoryLabel); add(settings.navigation?.allLabel);
    for (const item of settings.navigation?.items || []) {
      if (item.enabled) for (const key of ['label','title','eyebrow','description','body']) add(item[key]);
    }
  }
  const ids = body.page_type === 'product' ? [body.page_id] : body.product_ids || [];
  for (const id of new Set(ids)) {
    const product = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(id);
    if (!product) {
      if (body.page_type === 'product') throw Object.assign(Error('Không tìm thấy sản phẩm.'), {status:404});
      continue;
    }
    for (const key of ['name','description','category']) add(product[key]);
    const details = JSON.parse(product.details || '{}');
    for (const key of ['summary','material','dimensions','capacity','color','care','badge']) add(details[key]);
    details.features?.forEach(add);
    for (const spec of details.specifications || []) { add(spec.label); add(spec.value); }
    // Variant SKU, stock and price are deliberately excluded, as are order snapshots.
  }
  return {texts:[...texts], brand:settings.brand};
}

function protect(text, brand) {
  const terms = [...new Set([brand, 'Super Net'].filter(Boolean))].sort((a,b) => b.length-a.length);
  const escape = term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(terms.map(escape).concat('[A-Z]{2,}[-_][A-Z0-9_-]+', '\\d+(?:[.,]\\d+)*').join('|'), 'g');
  const values = [];
  return {text:text.replace(pattern, value => `SNKEEP${values.push(value)-1}TOKEN`), values};
}
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (match, code) => {
  if (code[0] === '#') {
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2),16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  }
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[code.toLowerCase()] || match;
});

export function createTranslationService(db, {
  fetchImpl = globalThis.fetch,
  apiKey = () => process.env.TRANSLATION_API_KEY,
  dailyLimit = () => bounded(process.env.TRANSLATION_DAILY_CHAR_LIMIT, 100000, 5000000),
} = {}) {
  const pending = new Map();
  let retryAfter = 0;
  const usage = (body, count, hit, status) => db.prepare(
    'INSERT INTO translation_api_usage(content_type,target_language,character_count,cache_hit,status,created) VALUES(?,?,?,?,?,?)'
  ).run(body.page_type, body.target_language, count, hit ? 1 : 0, status, new Date().toISOString());

  async function translate(body) {
    const {texts, brand} = publicCopy(db, body);
    const language = body.target_language;
    if (language === 'vi') return {language, mode:'source', translations:[]};
    const translations = [], missing = [];
    for (const source of texts) {
      const key = hash(JSON.stringify({source,brand,version}));
      const cached = db.prepare('SELECT translated FROM translation_cache WHERE source_hash=? AND language=? AND version=? AND expires>?').get(key,language,version,Date.now());
      if (cached) translations.push({source,translated:cached.translated});
      else missing.push({source,key,...protect(source,brand)});
    }
    if (!missing.length) {
      usage(body,0,true,'cached');
      return {language,mode:'translated',translations};
    }
    if (!apiKey() || Date.now() < retryAfter) {
      usage(body,0,false,'unavailable');
      return {language,mode:translations.length?'partial':'unavailable',translations};
    }
    const selected = []; let characters = 0;
    for (const item of missing) {
      const count = [...item.source].length;
      if (selected.length >= 100 || characters + count > 20000) break;
      selected.push(item); characters += count;
    }
    if (!selected.length) return {language,mode:'limited',translations};
    db.prepare('INSERT OR IGNORE INTO translation_daily_budget(day,characters) VALUES(?,0)').run(day());
    const reserved = db.prepare('UPDATE translation_daily_budget SET characters=characters+? WHERE day=? AND characters+?<=?').run(characters,day(),characters,dailyLimit());
    if (!reserved.changes) {
      usage(body,0,false,'limited');
      return {language,mode:'limited',translations};
    }
    try {
      const response = await fetchImpl('https://translation.googleapis.com/language/translate/v2', {
        method:'POST', signal:AbortSignal.timeout(10000),
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey()},
        body:JSON.stringify({q:selected.map(item=>item.text),source:'vi',target:language,format:'text'}),
      });
      if (!response.ok) throw Error('Translation provider unavailable');
      const output = (await response.json()).data?.translations;
      if (!Array.isArray(output) || output.length !== selected.length) throw Error('Invalid translation result');
      let complete = selected.length === missing.length;
      for (const [index, item] of selected.entries()) {
        let translated = output[index]?.translatedText;
        if (typeof translated !== 'string' || !translated.trim() || translated.length > 30000) { complete=false; continue; }
        if (item.values.some((_, i) => translated.split(`SNKEEP${i}TOKEN`).length !== 2)) { complete=false; continue; }
        translated = decode(translated).replace(/SNKEEP(\d+)TOKEN/g, (token, i)=>item.values[Number(i)] ?? token);
        db.prepare('INSERT OR REPLACE INTO translation_cache VALUES(?,?,?,?,?)').run(item.key,language,version,translated,Date.now()+30*86400000);
        translations.push({source:item.source,translated});
      }
      usage(body,characters,false,complete?'translated':'partial');
      return {language,mode:complete?'translated':'partial',translations};
    } catch {
      retryAfter = Date.now()+30000;
      usage(body,characters,false,'provider_error');
      return {language,mode:translations.length?'partial':'unavailable',translations};
    }
  }
  return {
    translate(body) {
      const key = JSON.stringify(body);
      if (!pending.has(key)) pending.set(key,translate(body).finally(()=>pending.delete(key)));
      return pending.get(key);
    },
  };
}

export function installTranslations(app, db, options) {
  const service = createTranslationService(db,options);
  const limit = rateLimit({windowMs:60000,limit:20,message:{error:'Vui lòng thử dịch lại sau ít phút.'}});
  app.post('/api/i18n/translate-page',limit,async(req,res,next)=>{
    const b=req.body;
    const allowed=['page_type','page_id','product_ids','source_language','target_language'];
    if (!b || typeof b!=='object' || Array.isArray(b) || Object.keys(b).some(k=>!allowed.includes(k)) ||
      !languages.has(b.target_language) || (b.source_language !== undefined && b.source_language !== 'vi') ||
      !['storefront','product','products'].includes(b.page_type) ||
      (b.page_type==='product' && (!Number.isSafeInteger(b.page_id) || b.page_id<=0)) ||
      (b.product_ids!==undefined && (!Array.isArray(b.product_ids) || b.product_ids.length>24 || !b.product_ids.every(id=>Number.isSafeInteger(id)&&id>0)))) {
      return res.status(400).json({error:'Yêu cầu dịch không hợp lệ.'});
    }
    if (req.session && req.get('X-CSRF-Token')!==req.session.csrf) return res.status(403).json({error:'Phiên yêu cầu không hợp lệ.'});
    try { res.json(await service.translate(b)); }
    catch (error) { if(error.status)res.status(error.status).json({error:error.message});else next(error); }
  });
}
