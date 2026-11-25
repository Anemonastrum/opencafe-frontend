import {useEffect,useRef,useState} from 'react';
import {BellIcon,CheckIcon} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {adminApi as api} from '../api/admin';
import {useAuth} from '../context/AuthContext';
import {useResource} from '../hooks/useResource';
import {dateTime,formatMoney} from '../lib/admin';
import {Pagination,secondary} from './AdminUI';
import Skeleton from './Skeleton';

function NotificationText({notification:{type,data}}){
 if(type==='DAILY_SALES_REPORT')return <><p className="font-medium">Daily sales report</p><p>{data.businessDate} · {data.summary?.paidOrderCount??0} paid orders</p><p>Collected: {formatMoney(data.summary?.collectedAmount)}</p></>;
 if(type==='DAILY_SALES_REPORT_UNAVAILABLE')return <><p className="font-medium">Daily sales report unavailable</p><p>{data.businessDate} · Report limit exceeded. Review sales reports for details.</p></>;
 if(type==='PAYMENT_SUCCESS')return <><p className="font-medium">Payment received</p><p>{data.orderNumber} · {data.method}</p><p>{formatMoney(data.amount)}</p></>;
 return <p className="font-medium">New notification</p>;
}
export default function DropdownNotifications(){
 const {generation}=useAuth(),[open,setOpen]=useState(false),[page,setPage]=useState(1),[busy,setBusy]=useState(false),ref=useRef(),mutation=useRef();
 const unread=useResource(signal=>api.getUnreadNotificationCount({signal}));
 const list=useResource(signal=>open?api.listNotifications({page,limit:10},{signal}):null,[open,page]);
 useEffect(()=>{setOpen(false);setPage(1);setBusy(false);return()=>mutation.current?.abort();},[generation]);
 useEffect(()=>{
  const outside=e=>{if(!e.composedPath().includes(ref.current))setOpen(false);};
  const escape=e=>{if(e.key==='Escape'){setOpen(false);if(ref.current?.contains(document.activeElement))ref.current.querySelector('button').focus();}};
  document.addEventListener('click',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);};
 },[]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible'){unread.reload();if(open)list.reload();}};
  const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[open,unread.reload,list.reload]);
 async function mark(id){
  if(mutation.current)return;
  const controller=new AbortController();mutation.current=controller;setBusy(true);
  try{if(id)await api.markNotificationRead(id,{signal:controller.signal});else await api.markAllNotificationsRead({signal:controller.signal});if(!controller.signal.aborted){list.reload();unread.reload();}}
  catch(error){if(!controller.signal.aborted&&error.code!=='SESSION_CHANGED')toast.error(error.message);}
  finally{if(mutation.current===controller){mutation.current=null;if(!controller.signal.aborted)setBusy(false);}}
 }
 const count=unread.data?.unreadCount;
 return <div ref={ref} className="relative">
  <button type="button" aria-label="Notifications" aria-expanded={open} aria-controls="notifications-panel" onClick={()=>{if(!open){setPage(1);unread.reload();}setOpen(!open);}} className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500"><BellIcon aria-hidden="true" className="h-6 w-6"/>{count>0&&<span data-unread-count aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">{count>99?'99+':count}</span>}<span className="sr-only" aria-live="polite">{unread.error?'Unread count unavailable':count!=null?`${count} unread notifications`:''}</span></button>
  {open&&<div id="notifications-panel" className="absolute right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
   <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700"><h2 className="text-sm font-semibold">Notifications</h2><button type="button" disabled={busy||!count} onClick={()=>mark()} className="mt-2 text-xs text-violet-700 dark:text-violet-300">Mark all as read</button></div>
   <div className="max-h-[60dvh] overflow-y-auto px-4 py-3 text-sm">
    {unread.error&&<p className="mb-3 text-xs text-red-600 dark:text-red-400">Unread count unavailable. <button type="button" onClick={unread.reload} className="underline">Retry count</button></p>}
    {list.loading?<Skeleton label="Loading notifications" rows={3}/>:list.error?<div role="alert"><p>{list.error.message}</p><button type="button" className={`${secondary} mt-3`} onClick={list.reload}>Retry</button></div>:list.data?.notifications.length?<><ul className="divide-y divide-gray-100 dark:divide-gray-700/60">{list.data.notifications.map(notification=><li key={notification.id} className={`py-3 ${notification.readAt?'text-gray-500 dark:text-gray-400':'text-gray-800 dark:text-gray-100'}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1 space-y-1 break-words"><NotificationText notification={notification}/><p className="text-xs text-gray-500 dark:text-gray-400"><time dateTime={notification.createdAt}>{dateTime(notification.createdAt)} WIB</time> · {notification.readAt?'Read':'Unread'}</p></div>{!notification.readAt&&<button type="button" disabled={busy} title="Mark as read" aria-label={`Mark notification ${notification.id} as read`} onClick={()=>mark(notification.id)} className="shrink-0 rounded-md p-2 text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/10"><CheckIcon aria-hidden="true" className="h-5 w-5"/></button>}</div></li>)}</ul><Pagination page={page} total={list.data.total} limit={10} onChange={setPage}/></>:<div className="py-6 text-center"><p className="font-medium">No notifications yet</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Notifications will appear here when available.</p></div>}
   </div>
  </div>}
 </div>;
}
