export function mountSkuEditor(root, { product, esc, cover, upload, toast }) {
  const variants=product.all_variants||[], hasVariants=variants.length>0;
  const initial=hasVariants?variants:[{base:Boolean(product.id),sku:product.details?.sku||'',label:product.details?.color||'Mặc định',price:product.price,stock:product.stock,image:product.image,active:1}];
  let serial=0,lastCover=cover.value;
  const rowHTML=row=>{
    const key=serial++,first=key===0,existing=Boolean(row.id||row.base),prefix=first?'':`sku_${key}_`;
    return `<fieldset class="sku-editor-row" data-sku-row data-key="${key}" ${row.id?`data-id="${row.id}" data-revision="${row.revision}"`:''} ${row.base?'data-base="true"':''}><legend>SKU <span data-sku-index></span></legend><div class="sku-editor-layout"><div class="sku-editor-photo"><img data-sku-preview src="${esc(row.image||'')}" alt="Ảnh SKU" ${row.image?'':'hidden'}><label>Tải ảnh SKU<input type="file" data-sku-upload accept="image/png,image/jpeg,image/webp"></label><label>Hoặc đường dẫn ảnh<input data-sku-field="image" value="${esc(row.image||'')}" maxlength="2000" placeholder="/uploads/anh.webp hoặc https://..."></label></div><div class="settings-grid"><label>Mã SKU<input data-sku-field="sku" name="${prefix}detail_sku" required maxlength="100" value="${esc(row.sku||'')}" placeholder="Ví dụ: SN-COC-XANH"></label><label>Màu sắc / phiên bản<input data-sku-field="label" required maxlength="100" value="${esc(row.label||'')}" placeholder="Ví dụ: Xanh lá / 350 ml"></label><label>Giá bán (đ)<input data-sku-field="price" name="${prefix}price" type="number" required min="0" max="1000000000" step="1" value="${row.price||0}"></label>${existing?`<p class="sku-editor-stock">Tồn kho khi mở: <strong>${row.stock}</strong>. Điều chỉnh bằng số lượng tăng/giảm tại Kho & biến thể.</p>`:`<label>Tồn kho ban đầu<input data-sku-field="stock" name="${prefix}stock" type="number" required min="0" max="1000000" step="1" value="${row.stock||0}"></label>`}<label data-sku-active>Trạng thái SKU<select data-sku-field="active"><option value="1" ${row.active?'selected':''}>Đang bán</option><option value="0" ${!row.active?'selected':''}>Ngừng bán</option></select></label></div></div><div class="sku-editor-actions">${existing?'<span class="muted">Giữ SKU đã lưu để bảo toàn đơn hàng và lịch sử kho.</span>':'<button type="button" class="danger" data-sku-remove>Xóa SKU chưa lưu</button>'}</div></fieldset>`;
  };
  root.innerHTML=`<div class="sku-editor-heading"><div><h3>SKU & màu sắc</h3><p class="muted">Mỗi màu có mã SKU, ảnh, giá và tồn kho riêng. Mặc định một SKU; thêm dòng cho màu tiếp theo.</p></div><button type="button" class="secondary" data-sku-add>+ Thêm SKU / màu</button></div><div data-sku-rows>${initial.map(rowHTML).join('')}</div>`;
  const rows=()=>[...root.querySelectorAll('[data-sku-row]')];
  const input=(row,key)=>row.querySelector(`[data-sku-field="${key}"]`);
  const preview=row=>{const image=row.querySelector('[data-sku-preview]');image.hidden=!input(row,'image').value;image.src=input(row,'image').value;};
  const update=()=>rows().forEach((row,index)=>{row.querySelector('[data-sku-index]').textContent=index+1;row.querySelector('[data-sku-active]').hidden=rows().length===1&&!hasVariants;input(row,'image').required=rows().length>1||hasVariants;const remove=row.querySelector('[data-sku-remove]');if(remove)remove.disabled=rows().length===1;});
  root.addEventListener('click',event=>{
    if(event.target.closest('[data-sku-add]')) {
      if(rows().length>=50)return toast('Một sản phẩm tối đa 50 SKU.');
      root.querySelector('[data-sku-rows]').insertAdjacentHTML('beforeend',rowHTML({sku:'',label:'',price:Number(input(rows()[0],'price').value),stock:0,image:'',active:1}));update();input(rows().at(-1),'sku').focus();
    }
    if(event.target.closest('[data-sku-remove]')&&rows().length>1){event.target.closest('[data-sku-row]').remove();update();}
  });
  root.addEventListener('input',event=>{const row=event.target.closest('[data-sku-row]');if(row&&event.target===input(row,'image')){preview(row);if(rows().length===1&&!hasVariants){cover.value=event.target.value;cover.dispatchEvent(new Event('change',{bubbles:true}));}}});
  root.addEventListener('change',async event=>{
    if(!event.target.matches('[data-sku-upload]'))return;
    const file=event.target.files[0],row=event.target.closest('[data-sku-row]');if(!file)return;
    try{input(row,'image').value=await upload(file);input(row,'image').dispatchEvent(new Event('input',{bubbles:true}));preview(row);toast('Đã tải ảnh SKU. Nhấn Lưu sản phẩm để áp dụng.');}catch(error){toast(error.message);}finally{event.target.value='';}
  });
  cover.addEventListener('change',()=>{const first=rows()[0];if(!hasVariants&&(rows().length===1||input(first,'image').value===lastCover||!input(first,'image').value)){input(first,'image').value=cover.value;preview(first);}lastCover=cover.value;});
  const read=()=>rows().map(row=>{
    const value={sku:input(row,'sku').value.trim(),label:input(row,'label').value.trim(),price:Number(input(row,'price').value),image:input(row,'image').value.trim(),active:Number(input(row,'active').value)};
    if(row.dataset.id){value.id=Number(row.dataset.id);value.revision=Number(row.dataset.revision);}
    else if(row.dataset.base)value.base=true;
    else value.stock=Number(input(row,'stock').value);
    return value;
  });
  update();const snapshot=JSON.stringify(read());
  return {read,changed:()=>JSON.stringify(read())!==snapshot,hasVariants};
}
