export const gateFor = user => !user ? '/login' : user.mustChangePassword ? '/change-password' : user.role !== 'ADMIN' ? '/unauthorized' : null;
export const navigation = [['/dashboard','Dashboard'],['/sales-report','Sales report'],['/orders','Orders'],['/products','Products'],['/categories','Categories'],['/cashiers','Cashiers'],['/cafe-settings','Cafe settings'],['/profile','Profile']];
export function formatMoney(value) {
 if(typeof value!=='string'||!/^(-?)(\d+)(?:\.(\d{1,2}))?$/.test(value))return 'Unavailable';
 const [,sign,whole,fraction='']=value.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
 return `${sign}Rp ${whole.replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${fraction.padEnd(2,'0')}`;
}
export function jakartaDate(now=new Date()) { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`; }
export const monthRange=(now=new Date())=>{const to=jakartaDate(now);return {from:to.slice(0,8)+'01',to};};
export const dateTime=value=>value?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Unavailable';
export function validateReportFilters({from,to,method,cashierId}) {
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&+value.slice(0,4)>=1000&&+value.slice(0,4)<=9998&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!valid(from)||!valid(to))return 'Choose valid dates (years 1000–9998).';
 const days=(Date.parse(to)-Date.parse(from))/86400000+1;
 if(days<1||days>366)return 'Choose an inclusive range of 1–366 days.';
 if(method&&!['CASH','QRIS'].includes(method))return 'Invalid payment method.';
 if(cashierId&&!validId(cashierId))return 'Invalid cashier.';return null;
}
export const validId=value=>/^[1-9]\d{0,9}$/.test(String(value))&&Number(value)<=2147483647;
export const queryString=record=>new URLSearchParams(Object.entries(record).filter(([,v])=>v!==''&&v!==undefined&&v!==null)).toString();
export const textError=(value,max,bytes=Infinity)=>typeof value!=='string'||!value.isWellFormed()||!value.trim()||[...value.trim()].length>max||new TextEncoder().encode(value.trim()).length>bytes?`Enter nonempty text up to ${max} characters.`:null;
export const usernameError=value=>typeof value!=='string'||! /^[A-Za-z0-9_.-]{1,100}$/.test(value)?'Username: 1–100 letters, digits, _, . or -.':null;
export const passwordError=value=>typeof value!=='string'||!value.isWellFormed()||new TextEncoder().encode(value).length<12||new TextEncoder().encode(value).length>128?'Password must contain 12–128 UTF-8 bytes.':null;
export const priceError=value=>!/^\d{1,10}(\.\d{1,2})?$/.test(String(value))?'Price: 0–9999999999.99, at most two decimals.':null;
export const taxError=value=>!/^\d{1,3}(\.\d{1,2})?$/.test(String(value))||Number(value)>100?'Tax rate: 0–100, at most two decimals.':null;
export const imageError=file=>file&&(!/\.(jpe?g|png|webp)$/i.test(file.name)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)?'Choose JPEG, PNG or WebP up to 5 MiB.':null;
export function buildPayload(fields,fileField,file) {
 if(!file)return fields;if(imageError(file))throw Error(imageError(file));
 if(Object.values(fields).includes(null))throw Error('Save cleared fields separately before uploading an image.');
 const form=new FormData();for(const [k,v] of Object.entries(fields))if(v!==undefined)form.append(k,String(v));form.append(fileField,file);return form;
}
export async function loadPages(load,{signal}={}) {
 const rows=[],seen=new Set();let page=1;
 for(;;){signal?.throwIfAborted();const data=await load(page,signal);if(!Array.isArray(data.rows)||!Number.isSafeInteger(data.total)||data.total<0)throw Error('Invalid lookup response.');
 for(const row of data.rows){if(seen.has(row.id))throw Error('Lookup changed; retry.');seen.add(row.id);rows.push(row);}
 if(rows.length===data.total)return rows;if(!data.rows.length||rows.length>data.total)throw Error('Lookup incomplete; retry.');page++;
 }
}
export function changedFields(original,draft) {return Object.fromEntries(Object.entries(draft).filter(([k,v])=>original[k]!==v));}
export function downloadBlob({blob,type},{filename,mime}) {
 if(!type.toLowerCase().startsWith(mime))throw Error('Unexpected download format.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
