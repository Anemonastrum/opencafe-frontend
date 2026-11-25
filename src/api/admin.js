import {apiRequest} from './client.js';
import {queryString,validId,loadPages,validateReportFilters} from '../lib/admin.js';
const id=value=>{if(!validId(value))throw Error('Invalid ID');return String(value);};
const allowed=(data,keys,kind='field')=>{if(Object.keys(data).some(k=>!keys.includes(k)))throw Error(`Invalid ${kind}`);return data;};
export function createAdminApi(request=apiRequest){
 const list=(path,fields,q={},o={})=>request(`${path}?${queryString(allowed(q,fields,'query'))}`,o);
 const save=(path,key,data,o={})=>request(key==null?path:`${path}/${id(key)}`,{...o,method:key==null?'POST':'PUT',body:data});
 const reportFilters=filters=>{allowed(filters,['from','to','method','cashierId'],'query');const error=validateReportFilters(filters);if(error)throw Error(error);return filters;};
 const api={
  listCategories:(q={},o)=>list('/api/categories',['page','limit','search'],q,o),
  saveCategory:(key,data,o)=>save('/api/categories',key,allowed(data,['name']),o),
  deleteCategory:(key,o)=>request(`/api/categories/${id(key)}`,{...o,method:'DELETE'}),
  listProducts:(q={},o)=>list('/api/products',['page','limit','search','categoryId','isAvailable'],q,o),
  getProduct:(key,o)=>request(`/api/products/${id(key)}`,o),
  saveProduct:(key,data,o)=>save('/api/products',key,data instanceof FormData?data:allowed(data,['name','price','description','categoryId','isAvailable','imageUrl']),o),
  setProductAvailability:(key,isAvailable,o)=>{if(typeof isAvailable!=='boolean')throw Error('Invalid availability');return save('/api/products',key,{isAvailable},o);},
  getCafe:o=>request('/api/cafe',o),
  saveCafe:(exists,data,o)=>request('/api/cafe',{...o,method:exists?'PUT':'POST',body:data}),
  listCashiers:(q={},o)=>list('/api/admin/cashiers',['page','limit'],q,o),
  getCashier:(key,o)=>request(`/api/admin/cashiers/${id(key)}`,o),
  createCashier:(data,o)=>{if(data instanceof FormData){data.set('role','CASHIER');}else data={...allowed(data,['name','username','password','imageUrl'] ),role:'CASHIER'};return request('/api/admin/users',{...o,method:'POST',body:data});},
  updateCashier:(key,data,o)=>save('/api/admin/cashiers',key,data instanceof FormData?data:allowed(data,['name','username','isActive','imageUrl']),o),
  resetCashierPassword:(key,newPassword,o)=>request(`/api/admin/cashiers/${id(key)}/password`,{...o,method:'PUT',body:{newPassword}}),
  updateProfile:(data,o)=>request('/api/auth/profile',{...o,method:'PUT',body:data instanceof FormData?data:allowed(data,['name','username','imageUrl'])}),
  getMe:o=>request('/api/auth/me',o),
  listNotifications:(q={},o)=>list('/api/notifications',['page','limit','unread'],q,o),
  getUnreadNotificationCount:o=>request('/api/notifications/unread-count',o),
  markNotificationRead:(key,o)=>request(`/api/notifications/${id(key)}/read`,{...o,method:'PATCH'}),
  markAllNotificationsRead:o=>request('/api/notifications/read-all',{...o,method:'PATCH'}),
  getSalesReport:(filters,o)=>list('/api/admin/reports/sales',['from','to','method','cashierId'],reportFilters(filters),o),
  getSalesTransactions:(filters,{scope='all',page=1,limit=20,signal}={})=>request(`/api/admin/reports/sales/transactions?${queryString({...reportFilters(filters),scope,page,limit})}`,{signal}),
  exportSales:(filters,{scope='all',format='csv',signal}={})=>{if(!['csv','xlsx'].includes(format))throw Error('Invalid format');return request(`/api/admin/reports/sales/export?${queryString({...reportFilters(filters),scope,format})}`,{signal,response:'blob'});},
  listOrders:(q={},o)=>list('/api/orders',['status','page','limit','cashierId','orderNumber'],{status:'ALL',...q},o),
  getOrder:(key,o)=>request(`/api/orders/${id(key)}`,o),
  getPayments:(key,o)=>request(`/api/orders/${id(key)}/payments`,o),
  reconcilePayment:(key,payment,o)=>request(`/api/orders/${id(key)}/payments/${id(payment)}/reconcile`,{...o,method:'POST'}),
  generateReceipt:(key,o)=>request(`/api/orders/${id(key)}/receipt`,{...o,method:'POST'}),
  downloadReceipt:(key,o)=>request(`/api/orders/${id(key)}/receipt`,{...o,response:'blob'}),
 };
 api.loadLookup=(kind,o={})=>loadPages(async(page,signal)=>{const data=await (kind==='categories'?api.listCategories:api.listCashiers)({page,limit:100},{signal});return {rows:data[kind],total:data.total};},o);
 return api;
}
export const adminApi=createAdminApi();
