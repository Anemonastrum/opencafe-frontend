const max=999999999999n;
export function paymentRequestId(){
 const crypto=globalThis.crypto;
 if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
 if(typeof crypto?.getRandomValues!=='function')throw Error('Secure randomness unavailable. Use a supported browser.');
 // ponytail: LAN HTTP lacks randomUUID; use Web Crypto, never weak randomness.
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function parseMoney(value){
 if(!['string','number'].includes(typeof value)||!/^\d{1,10}(\.\d{1,2})?$/.test(String(value)))throw Error('Invalid amount: use 0–9999999999.99 with at most two decimals');
 const [whole,fraction='']=String(value).split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function fixedMoney(value){
 if(typeof value!=='bigint')throw Error('Expected bigint cents');
 const sign=value<0n?'-':'',amount=value<0n?-value:value;
 return `${sign}${amount/100n}.${String(amount%100n).padStart(2,'0')}`;
}
const bounded=value=>{if(value>max)throw Error('Amount exceeds supported limit');return value;};
export function cartEstimate(cart,cafe){
 if(!Array.isArray(cart)||cart.length>100||!cafe||typeof cafe.taxEnabled!=='boolean')throw Error('Invalid cart or cafe settings');
 let subtotal=0n;const ids=new Set();
 for(const item of cart){
  if(!Number.isInteger(item.id)||item.id<1||item.id>2147483647||ids.has(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)throw Error('Invalid cart item');
  ids.add(item.id);subtotal=bounded(subtotal+bounded(parseMoney(item.price)*BigInt(item.quantity)));
 }
 const rate=cafe.taxEnabled?parseMoney(cafe.taxRate):0n,inclusive=cafe.taxEnabled?cafe.taxInclusive:false;
 if(rate>10000n||typeof inclusive!=='boolean'||(cafe.taxEnabled&&((cafe.taxName!==null&&(typeof cafe.taxName!=='string'||!cafe.taxName.trim()))||(rate>0n&&!cafe.taxName))))throw Error('Invalid tax settings');
 const denominator=inclusive?10000n+rate:10000n,tax=bounded((subtotal*rate+denominator/2n)/denominator);
 return {subtotalAmount:fixedMoney(subtotal),taxAmount:fixedMoney(tax),totalAmount:fixedMoney(bounded(subtotal+(inclusive?0n:tax)))};
}
const validId=value=>Number.isInteger(value)&&value>0&&value<=2147483647;
const text=value=>typeof value==='string';
const optionalText=value=>value==null||text(value);
const date=value=>text(value)&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value.slice(0,10);
// Reject unsafe display data; shaped but inconsistent captured money stays read-only.
export function reviewCapturedOrder(detail,id,cashierId){
 if(!detail||!validId(detail.id)||String(detail.id)!==String(id)||detail.cashierId!==cashierId)throw Error('Order unavailable or ownership could not be verified');
 if(!text(detail.orderNumber)||!detail.orderNumber.trim()||!text(detail.status)||!detail.status.trim()||!text(detail.checkoutVersion)||!date(detail.createdAt)||!date(detail.updatedAt)||(detail.completedAt!=null&&!date(detail.completedAt))||['paymentHoldReason','receiptCafeName','receiptCafeAddress','receiptLogoUrl','receiptCashierName','receiptPaperSize','taxName'].some(k=>!optionalText(detail[k]))||['taxRate','subtotalAmount','taxAmount','totalAmount'].some(k=>!text(detail[k]))||typeof detail.taxInclusive!=='boolean'||!Array.isArray(detail.items)||detail.items.some(i=>!i||!text(i.productName)||!i.productName.trim()||typeof i.quantity!=='number'||!Number.isFinite(i.quantity)||!text(i.unitPrice)||!text(i.subtotal)))throw Error('Malformed captured order response. Refresh or ask an administrator.');
 let blocked='';
 try{
  if(!['PENDING','COMPLETED','CANCELLED'].includes(detail.status)||!/^[0-9a-f]{64}$/.test(detail.checkoutVersion)||!detail.items?.length||detail.items.some(i=>!validId(i.productId)||typeof i.productName!=='string'||!i.productName.trim()))throw Error();
  const totals=cartEstimate(detail.items.map(i=>({id:i.productId,price:i.unitPrice,quantity:i.quantity})),{taxEnabled:true,taxName:detail.taxName,taxRate:detail.taxRate,taxInclusive:detail.taxInclusive});
  for(const key of ['subtotalAmount','taxAmount','totalAmount'])if(parseMoney(detail[key])!==parseMoney(totals[key]))throw Error();
  for(const item of detail.items)if(parseMoney(item.subtotal)!==parseMoney(item.unitPrice)*BigInt(item.quantity))throw Error();
 }catch{blocked='Captured order facts require reconciliation before changes.';}
 return {order:detail,blocked};
}
// Compare complete captured facts, not totals alone; history is a separate locked read.
export function reviewOrder(detail,history,id,cashierId){
 let {blocked}=reviewCapturedOrder(detail,id,cashierId);
 if(!history?.order||!Array.isArray(history.payments)||history.payments.some(p=>!p||typeof p!=='object'))throw Error('Order unavailable or ownership could not be verified');
 const fields=['id','cashierId','orderNumber','status','paymentHoldReason','checkoutVersion','createdAt','updatedAt','completedAt','receiptCafeName','receiptCafeAddress','receiptLogoUrl','receiptCashierName','receiptPaperSize','taxName','taxRate','taxInclusive','subtotalAmount','taxAmount','totalAmount','items'];
 const facts=order=>JSON.stringify(fields.map(key=>order[key]??null));
 if(facts(detail)!==facts(history.order))throw Error('Order and payment history disagree. Refresh before continuing.');
 if(history.payments.some(p=>!validId(p.id)||!text(p.method)||!text(p.status)||!optionalText(p.reconciliationReason)||(p.attemptNumber!=null&&(!Number.isInteger(p.attemptNumber)||p.attemptNumber<1))||(p.createdAt!=null&&!date(p.createdAt))))throw Error('Malformed payment history response. Refresh or ask an administrator.');
 if(detail.paymentHoldReason)blocked=`Payment reconciliation required: ${detail.paymentHoldReason}`;
 const invalidAmounts=p=>{try{const amounts=paymentEstimate(p.orderTotalAmount);if(parseMoney(p.amount)!==parseMoney(amounts.amount)||typeof p.roundingAdjustment!=='string'||p.roundingAdjustment!==amounts.roundingAdjustment)throw Error();for(const key of ['cashReceived','changeAmount'])if(p[key]!=null)parseMoney(p[key]);if(p.method==='CASH'&&(p.cashReceived==null||p.changeAmount==null||paymentEstimate(p.orderTotalAmount,p.cashReceived).changeAmount!==p.changeAmount))throw Error();return false;}catch{return true;}};
 if(history.payments.some(p=>!p||invalidAmounts(p)||!validId(p.id)||p.orderId!==detail.id||!['CASH','QRIS'].includes(p.method)||!['FAILED','EXPIRED'].includes(p.status)||typeof p.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.requestId)||p.orderTotalAmount==null||p.roundingAdjustment==null||p.reconciliationReason))blocked='Payment active, paid, held or unresolved. Changes are blocked; ask an administrator to reconcile.';
 return {order:detail,history,reconciliation:blocked,blocked:blocked||(detail.status!=='PENDING'?'Only pending orders can be changed.':'')};
}
// Payment recovery accepts active attempts, but never trusts status without money/ownership.
export function reviewPaymentHistory(history,id,cashierId){
 const {blocked}=reviewCapturedOrder(history?.order,id,cashierId);
 if(!Array.isArray(history.payments))throw Error('Malformed payment history response');
 const order=history.order,ids=new Set(),requests=new Set();
 let issue=blocked||(order.paymentHoldReason?'Payment reconciliation required. Ask an administrator.':'');
 for(const p of history.payments){
  try{
   if(!p||!validId(p.id)||ids.has(p.id)||p.orderId!==order.id||
      !['CASH','QRIS'].includes(p.method)||!['PENDING','PAID','FAILED','EXPIRED'].includes(p.status)||
      typeof p.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.requestId)||
      requests.has(p.requestId)||p.reconciliationReason)throw Error();
   ids.add(p.id);requests.add(p.requestId);
   const expected=paymentEstimate(p.orderTotalAmount,p.method==='CASH'?p.cashReceived:undefined);
   if(p.amount!==expected.amount||p.roundingAdjustment!==expected.roundingAdjustment||
      (p.method==='CASH'&&(p.cashReceived==null||p.changeAmount==null||p.status!=='PAID'||p.changeAmount!==expected.changeAmount))||
      (p.method==='QRIS'&&!expected.qrisAllowed))throw Error();
   if(['PENDING','PAID'].includes(p.status)&&p.orderTotalAmount!==order.totalAmount)throw Error();
   if(['qrisQrUrl','qrisPayload'].some(k=>p[k]!=null&&(typeof p[k]!=='string'||p[k].length>10000))||['expiresAt','paidAt','createdAt','updatedAt'].some(k=>p[k]!=null&&!date(p[k])))throw Error();
  }catch{issue='Payment active, held or unresolved. Ask an administrator to reconcile.';}
 }
 const active=history.payments.filter(p=>p&&['PENDING','PAID'].includes(p.status));
 if(active.length>1||(active.some(p=>p.status==='PENDING')&&order.status!=='PENDING')||(active.some(p=>p.status==='PAID')&&order.status!=='COMPLETED')||(order.status==='COMPLETED'&&!active.some(p=>p.status==='PAID')))issue='Order and payment status require reconciliation. Ask an administrator.';
 return {order,history,issue};
}
export function safeQrUrl(value){
 if(typeof value!=='string'||value.length>4096)return null;
 try{
  const url=new URL(value),host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(url.protocol!=='https:'||url.username||url.password||!host.includes('.')||host.endsWith('.localhost')||host.endsWith('.local')||/^[\d.]+$/.test(host)||host.includes(':'))return null;
  return url.href;
 }catch{return null;}
}
export function paymentEstimate(total,cash){
 const cents=parseMoney(total),payable=bounded(((cents+50n)/100n)*100n),grossAmount=Number(payable/100n);
 const result={orderTotalAmount:fixedMoney(cents),amount:fixedMoney(payable),roundingAdjustment:fixedMoney(payable-cents),grossAmount};
 if(cash!==undefined){const received=parseMoney(cash);if(received<payable)throw Error('Insufficient cash received');Object.assign(result,{cashReceived:fixedMoney(received),changeAmount:fixedMoney(received-payable)});}
 return {...result,qrisAllowed:grossAmount>=1&&grossAmount<=10000000};
}
