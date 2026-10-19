const pending = new WeakMap();
export async function uploadImage(file, { form, csrf }) {
  if (!file || file.size > 5*1024*1024) throw Error('Ảnh tối đa 5 MB.');
  pending.set(form,(pending.get(form)||0)+1);
  const buttons=[...form.querySelectorAll('button.primary')];
  buttons.forEach(button=>{button.disabled=true;button.classList.add('is-pending');button.setAttribute('aria-busy','true');});
  try {
    const response=await fetch('/api/admin/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:file});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Không tải được ảnh.');return data.url;
  } finally {
    pending.set(form,pending.get(form)-1);
    buttons.forEach(button=>{button.disabled=pending.get(form)>0||form.dataset.submitting==='true';button.classList.toggle('is-pending',button.disabled);if(button.disabled)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');});
  }
}
