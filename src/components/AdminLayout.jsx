import {createContext,useContext,useState} from 'react';
import {Outlet,useLocation} from 'react-router-dom';
import {apiRequest} from '../api/client';
import {useResource} from '../hooks/useResource';
import {navigation} from '../lib/admin';
import Sidebar from '../partials/Sidebar';
import Header from '../partials/Header';
const CafeContext=createContext(null);
export const useCafe=()=>useContext(CafeContext);
export default function AdminLayout(){const [sidebarOpen,setSidebarOpen]=useState(false);const location=useLocation();const resource=useResource(signal=>apiRequest('/api/cafe',{signal}).catch(e=>{if(e.status===404)return null;throw e;}),[]);const title=navigation.find(([path])=>location.pathname===path)?.[1]||'Order details';return <CafeContext.Provider value={{...resource,cafe:resource.data}}><div className="flex h-dvh overflow-hidden"><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-50 bg-white p-3 text-gray-900">Skip to content</a><Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/><div className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden" id="content-scroll"><Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/><main id="main" tabIndex={-1} className="grow"><div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto"><div className="mb-8"><p className="text-sm text-gray-500 mb-1">Administration</p><h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">{title}</h1></div><Outlet key={location.pathname}/></div></main></div></div></CafeContext.Provider>;}
