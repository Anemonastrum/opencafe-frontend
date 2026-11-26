import {useState} from 'react';
import {Link} from 'react-router-dom';
import {cashierApi as api} from '../api/cashier';
import {useResource} from '../hooks/useResource';
import {formatMoney,dateTime} from '../lib/admin';
import {Card,Field,PageState,Pagination,Table,Cell,Badge,primary} from '../components/AdminUI';
export default function CashierOrders(){
 const [page,setPage]=useState(1),[draft,setDraft]=useState({status:'ALL',orderNumber:''}),[filters,setFilters]=useState({status:'ALL'});
 const orders=useResource(signal=>api.listOrders({...filters,page,limit:20},{signal}),[filters,page]);
 return <div className="space-y-6"><Card title="Find my orders"><form className="grid sm:grid-cols-3 items-end gap-4" onSubmit={e=>{e.preventDefault();setFilters({status:draft.status,...(draft.orderNumber.trim()?{orderNumber:draft.orderNumber.trim()}:{})});setPage(1);}}><Field label="Order status">{id=><select id={id} className="form-select w-full" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{['ALL','PENDING','COMPLETED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select>}</Field><Field label="Exact order number" value={draft.orderNumber} maxLength={50} onChange={e=>setDraft({...draft,orderNumber:e.target.value})}/><button type="submit" className={primary}>Apply filters</button></form></Card><Card title="Own order history"><PageState resource={orders} empty={orders.data?.orders.length===0}><Table label="My orders" headers={['Order','Created (Jakarta)','Items','Total','Status']}>{orders.data?.orders.map(o=><tr key={o.id}><Cell><Link className="text-violet-600 dark:text-violet-300" to={`/my-orders/${o.id}`}>{o.orderNumber}</Link></Cell><Cell className="whitespace-nowrap">{dateTime(o.createdAt)}</Cell><Cell>{o._count?.items??'Unavailable'}</Cell><Cell className="whitespace-nowrap">{formatMoney(o.totalAmount)}</Cell><Cell><Badge tone={o.status==='PENDING'?'warn':o.status==='COMPLETED'?'good':'neutral'}>{o.status}</Badge></Cell></tr>)}</Table></PageState><Pagination page={page} total={orders.data?.total} onChange={setPage}/></Card></div>;
}
