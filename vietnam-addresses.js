import { readFileSync } from 'node:fs';
const dataset=JSON.parse(readFileSync(new URL('./public/datasets/vietnam-addresses.json',import.meta.url),'utf8'));
const provinces=new Map(dataset.provinces.map(p=>[p.code,p]));
const wards=new Map(dataset.provinces.flatMap(p=>p.wards.map(w=>[w.code,{...w,province_code:p.code}])));
if(provinces.size!==dataset.province_count||wards.size!==dataset.ward_count)throw Error('Vietnam address dataset is inconsistent.');
const collator=new Intl.Collator('vi');
export const addressMetadata={country:'VN',version:dataset.version,generated_at:dataset.generated_at,province_count:dataset.province_count,ward_count:dataset.ward_count};
export const listProvinces=()=>[...provinces.values()].map(({wards,...p})=>p).sort((a,b)=>collator.compare(a.short_name,b.short_name));
export const listWards=code=>provinces.get(code)?.wards.slice().sort((a,b)=>collator.compare(a.name,b.name));
export function validateVietnamAddress(body,{detailRequired=true}={}){
 if(body.country!==undefined&&body.country!=='VN')throw Error('Cửa hàng chỉ giao hàng tại Việt Nam.');
 const province=typeof body.province_code==='string'&&provinces.get(body.province_code);
 if(!province)throw Error('Vui lòng chọn tỉnh/thành phố tại Việt Nam trong danh sách.');
 const ward=typeof body.ward_code==='string'&&wards.get(body.ward_code);
 if(!ward||ward.province_code!==province.code)throw Error('Vui lòng chọn phường/xã/đặc khu thuộc tỉnh/thành phố đã chọn.');
 const line=typeof body.address==='string'?body.address.trim():'';
 if(detailRequired&&(line.length<3||line.length>400))throw Error('Nhập số nhà, tên đường hoặc thôn/ấp từ 3–400 ký tự.');
 return {country:'VN',province_code:province.code,province_name:province.name,ward_code:ward.code,ward_name:ward.name,address_line:line,address_version:dataset.version,region:province.short_name,full_address:[line,ward.name,province.name,'Việt Nam'].filter(Boolean).join(', ')};
}
export function formatStoredAddress(row){return row.province_code?[row.address_line||row.address,row.ward_name,row.province_name,'Việt Nam'].filter(Boolean).join(', '):[row.address,row.region].filter(Boolean).join(', ');}
