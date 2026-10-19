import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
// Review a new immutable upstream commit and its metadata before changing this pin.
const commit = '8b78ba5118715e1fa81769286724db79346abf52';
const base = `https://raw.githubusercontent.com/ThangLeQuoc/vietnamese-provinces-database/${commit}/`;
async function download(path) {
 const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
 if (!response.ok) throw Error(`Cannot download ${path}: ${response.status}`);
 return Buffer.from(await response.arrayBuffer());
}
const [source, meta, license] = await Promise.all([
 download('json/full_json_generated_data_vn_units.json'),
 download('json/vn_provinces_metadata.json'), download('LICENSE'),
]);
const raw = JSON.parse(source), metadata = JSON.parse(meta), provinces = [], seen = new Set(), wards = new Set();
if (!Array.isArray(raw) || raw.length !== 34) throw Error('Unexpected province count; review the new dataset.');
for (const p of raw) {
 if (!/^[0-9]{2}$/.test(p.Code) || seen.has(p.Code) || !p.FullName || !Array.isArray(p.Wards) || !p.Wards.length) throw Error('Invalid province data.');
 seen.add(p.Code);
 const children = p.Wards.map(w => {
  if (!/^[0-9]{5}$/.test(w.Code) || wards.has(w.Code) || w.ProvinceCode !== p.Code || !w.FullName || !['Phường','Xã','Đặc khu'].includes(w.AdministrativeUnitShortName)) throw Error('Invalid ward or parent.');
  wards.add(w.Code); return { code:w.Code, name:w.FullName };
 });
 provinces.push({ code:p.Code, name:p.FullName, short_name:p.Name, wards:children });
}
if (wards.size !== 3321 || metadata.DatasetVersion !== 'v5.2.0') throw Error('Unexpected release; review counts and tests.');
const dataset = { country:'VN',version:metadata.DatasetVersion,generated_at:metadata.GeneratedAt,latest_decree:metadata.LatestDecree,source:'https://github.com/ThangLeQuoc/vietnamese-provinces-database',source_commit:commit,source_path:'json/full_json_generated_data_vn_units.json',source_sha256:createHash('sha256').update(source).digest('hex'),province_count:provinces.length,ward_count:wards.size,provinces };
mkdirSync(new URL('../public/datasets/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/datasets/vietnam-addresses.json',import.meta.url),JSON.stringify(dataset)+'\n');
writeFileSync(new URL('../docs/licenses/vietnamese-provinces-database.txt',import.meta.url),license);
console.log(`Saved ${provinces.length} provinces and ${wards.size} wards (${dataset.version}).`);
