// RFC 4180-style fields: escaped quotes, embedded commas and newlines.
export function parseCsv(source){
 if(typeof source!=='string'||source.length>120000)throw Error('CSV tối đa 120 KB mỗi lần nhập.');
 const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<source.length;i++){const ch=source[i];if(quoted){if(ch==='"'){if(source[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=ch;}else if(ch==='"'){if(value||closed)throw Error('Dấu nháy CSV không hợp lệ.');quoted=true;}else if(ch===','||ch==='\n'||ch==='\r'){row.push(value);value='';closed=false;if(ch!==','){if(ch==='\r'&&source[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}}else{if(closed)throw Error('CSV có ký tự sau dấu đóng nháy.');value+=ch;}}
 if(quoted)throw Error('CSV thiếu dấu đóng nháy.');row.push(value);if(row.some(x=>x!==''))rows.push(row);if(rows.length<2||rows.length>201)throw Error('CSV cần tiêu đề và 1–200 sản phẩm.');const keys=rows.shift().map((v,i)=>(i===0?v.replace(/^\uFEFF/,''):v).trim());if(new Set(keys).size!==keys.length)throw Error('CSV trùng tên cột.');return rows.map((values,i)=>{if(values.length!==keys.length)throw Error('Sai số cột tại dòng '+(i+2));return Object.fromEntries(keys.map((k,j)=>[k,values[j].replace(/^'(?=[=+\-@\t\r])/,'')]));});
}
