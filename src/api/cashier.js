import {apiRequest} from './client.js';
import {queryString,textError} from '../lib/admin.js';
import {fixedMoney,parseMoney} from '../lib/pos.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const allowed=(value,fields)=>{if(!object(value)||Object.keys(value).some(key=>!fields.includes(key)))throw Error('Invalid fields');return value;};
const id=value=>{if(!['number','string'].includes(typeof value)||!/^[1-9]\d{0,9}$/.test(String(value))||Number(value)>2147483647)throw Error('Invalid ID');return String(value);};
const options=(value={})=>allowed(value,['signal']);
export function validateItems(items){
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('Supply 1–100 distinct order items');
 const ids=new Set();return Array.from(items,item=>{
  allowed(item,['productId','quantity']);
  if(Object.keys(item).length!==2||typeof item.productId!=='number'||!Number.isInteger(item.productId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999||ids.has(item.productId))throw Error('Each item requires a distinct productId and quantity 1–999');
  id(item.productId);ids.add(item.productId);return {productId:item.productId,quantity:item.quantity};
 });
}
export function validatePayment(body){
 const fields=body?.method==='CASH'?['requestId','method','checkoutVersion','cashReceived']:['requestId','method','checkoutVersion'];allowed(body,fields);
 if(Object.keys(body).length!==fields.length||!['CASH','QRIS'].includes(body.method))throw Error('Invalid payment fields');
 if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.requestId))throw Error('requestId must be a canonical lowercase UUID');
 if(typeof body.checkoutVersion!=='string'||body.checkoutVersion.length!==64||!/^[0-9a-f]{64}$/.test(body.checkoutVersion))throw Error('checkoutVersion must be a lowercase SHA-256 hex digest');
 return {requestId:body.requestId,method:body.method,checkoutVersion:body.checkoutVersion,...(body.method==='CASH'?{cashReceived:fixedMoney(parseMoney(body.cashReceived))}:{})};
}
function query(q,fields){
 allowed(q,fields);const result={...q};
 for(const key of ['page','limit','categoryId'])if(q[key]!==undefined)id(q[key]);
 const page=Number(q.page??1),limit=Number(q.limit??20);
 if(limit>100||(page-1)*limit>2147483647)throw Error('Invalid page or limit');
 for(const [key,max] of [['search',150],['orderNumber',50]])if(q[key]!==undefined){if(textError(q[key],max))throw Error(`Invalid ${key}`);result[key]=q[key].trim();}
 if(q.status!==undefined&&!['PENDING','CANCELLED','COMPLETED','ALL'].includes(q.status))throw Error('Invalid order status');
 if(q.isAvailable!==undefined&&typeof q.isAvailable!=='boolean')throw Error('Invalid availability');
 return queryString(result);
}
export function createCashierApi(request=apiRequest){
 const list=(path,fields,q={},o)=>request(`${path}?${query(q,fields)}`,options(o));
 return {
  listProducts:(q={},o)=>list('/api/products',['page','limit','search','categoryId','isAvailable'],q,o),
  listCategories:(q={},o)=>list('/api/categories',['page','limit','search'],q,o),
  getCafe:o=>request('/api/cafe',options(o)),
  listOrders:(q={},o)=>list('/api/orders',['page','limit','status','orderNumber'],{status:'ALL',...allowed(q,['page','limit','status','orderNumber'])},o),
  getOrder:(key,o)=>request(`/api/orders/${id(key)}`,options(o)),
  getPayments:(key,o)=>request(`/api/orders/${id(key)}/payments`,options(o)),
  createOrder:(items,o)=>request('/api/orders',{...options(o),method:'POST',body:{items:validateItems(items)}}),
  updateOrder:(key,items,o)=>request(`/api/orders/${id(key)}`,{...options(o),method:'PUT',body:{items:validateItems(items)}}),
  cancelOrder:(key,o)=>request(`/api/orders/${id(key)}/cancel`,{...options(o),method:'POST'}),
  createPayment:(key,body,o)=>request(`/api/orders/${id(key)}/payments`,{...options(o),method:'POST',body:validatePayment(body)}),
  reconcilePayment:(key,payment,o)=>request(`/api/orders/${id(key)}/payments/${id(payment)}/reconcile`,{...options(o),method:'POST'}),
 };
}
export const cashierApi=createCashierApi();
