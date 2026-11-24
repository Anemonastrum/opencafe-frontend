import {useEffect,useRef,useState} from 'react';
import {BellIcon} from '@heroicons/react/24/outline';

export default function DropdownNotifications(){
 const [open,setOpen]=useState(false),ref=useRef();
 useEffect(()=>{
  const outside=e=>{if(!ref.current?.contains(e.target))setOpen(false);};
  const escape=e=>{if(e.key==='Escape'){setOpen(false);if(ref.current?.contains(document.activeElement))ref.current.querySelector('button').focus();}};
  document.addEventListener('click',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);};
 },[]);
 return <div ref={ref} className="relative">
  <button type="button" aria-label="Notifications" aria-expanded={open} aria-controls="notifications-panel" onClick={()=>setOpen(!open)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500"><BellIcon aria-hidden="true" className="h-5 w-5"/></button>
  {open&&<div id="notifications-panel" className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
   <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-700">Notifications</h2>
   <div className="px-4 py-6 text-center"><p className="text-sm font-medium">No notifications yet</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Notifications will appear here when available.</p></div>
  </div>}
 </div>;
}
