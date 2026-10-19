let provincesRequest;
const wardRequests = new Map();
export const addressFields = () => `<fieldset class="vn-address-fields"><legend>Địa chỉ nhận hàng tại Việt Nam</legend><input type="hidden" name="country" value="VN"><p class="muted">Quốc gia: Việt Nam · Địa chỉ hành chính hai cấp</p><div class="address-select-grid"><label>Tỉnh/thành phố<select name="province_code" required autocomplete="address-level1" data-vn-province disabled><option value="">Đang tải tỉnh/thành phố…</option></select></label><label>Phường/xã/đặc khu<select name="ward_code" required autocomplete="address-level2" data-vn-ward disabled><option value="">Chọn tỉnh/thành phố trước</option></select></label></div><p class="muted" data-address-status role="status"></p><button type="button" class="secondary" data-address-retry hidden>Tải lại danh sách địa chỉ</button></fieldset>`;
export const storedAddress = row => row.province_code
 ? [row.address_line || row.address, row.ward_name, row.province_name, 'Việt Nam'].filter(Boolean).join(', ')
 : [row.address, row.region].filter(Boolean).join(', ');

export async function mountAddressFields(form, {api, onChange=()=>{}}) {
 const province = form.querySelector('[data-vn-province]'), ward = form.querySelector('[data-vn-ward]');
 const status = form.querySelector('[data-address-status]'), retry = form.querySelector('[data-address-retry]');
 let generation = 0, provinceItems = [];
 const placeholder = (select, text) => { select.replaceChildren(new Option(text, '')); select.value = ''; };
 const append = (select, items) => { for (const item of items) select.add(new Option(item.name, item.code)); };
 const wardList = code => {
  if (!wardRequests.has(code)) {
   const request = api('/locations/provinces/'+code+'/wards').catch(error => { wardRequests.delete(code); throw error; });
   wardRequests.set(code,request);
  }
  return wardRequests.get(code);
 };
 async function chooseProvince(wardCode = '') {
  const current = ++generation, code = province.value;
  placeholder(ward, code ? 'Đang tải phường/xã…' : 'Chọn tỉnh/thành phố trước');
  ward.disabled = true; retry.hidden = true; status.textContent = ''; onChange();
  if (!code) return false;
  try {
   const data = await wardList(code);
   if (!form.isConnected || current !== generation || code !== province.value) return false;
   placeholder(ward,'Chọn phường/xã/đặc khu'); append(ward,data.wards); ward.disabled=false;
   if (wardCode && data.wards.some(w=>w.code===wardCode)) ward.value=wardCode;
   status.textContent=`Có ${data.wards.length} phường/xã/đặc khu thuộc tỉnh/thành phố đã chọn.`;
   onChange(); return Boolean(ward.value);
  } catch {
   if (!form.isConnected || current !== generation) return false;
   placeholder(ward,'Chưa tải được danh sách');status.textContent='Chưa tải được phường/xã. Vui lòng thử lại.';retry.hidden=false;onChange();return false;
  }
 }
 async function loadProvinces() {
  province.disabled=true;retry.hidden=true;placeholder(province,'Đang tải tỉnh/thành phố…');
  if (!provincesRequest) provincesRequest=api('/locations/provinces').catch(error=>{provincesRequest=undefined;throw error;});
  try {
   const data=await provincesRequest;if(!form.isConnected)return;
   provinceItems=data.provinces;placeholder(province,'Chọn tỉnh/thành phố');append(province,provinceItems);province.disabled=false;
   status.textContent='Chọn tỉnh/thành phố để xem danh sách phường/xã trực thuộc.';
  } catch {
   if(!form.isConnected)return;
   placeholder(province,'Chưa tải được danh sách');status.textContent='Chưa tải được tỉnh/thành phố. Vui lòng thử lại.';retry.hidden=false;
  }
 }
 province.onchange=event=>{event.stopPropagation();chooseProvince();};ward.onchange=event=>{event.stopPropagation();onChange();};
 retry.onclick=()=>provinceItems.length&&province.value?chooseProvince():loadProvinces();
 await loadProvinces();
 return { async select(provinceCode, wardCode) {
  if(!form.isConnected)return false;
  province.value=provinceItems.some(p=>p.code===provinceCode)?provinceCode:'';
  return chooseProvince(wardCode||'');
 }};
}
