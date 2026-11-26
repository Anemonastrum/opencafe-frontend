import {useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {workspaceFor} from '../lib/admin';
import ThemeToggle from '../components/ThemeToggle';
import {Field,primary} from '../components/AdminUI';
import toast from 'react-hot-toast';
export default function Login(){
 const {user,login}=useAuth();const [busy,setBusy]=useState(false);
 if(user)return <Navigate to={workspaceFor(user)} replace/>;
 async function submit(e){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await login(f.get('username'),f.get('password'));}catch(e){toast.error(e.message);}finally{setBusy(false);}}
 return <main className="min-h-dvh flex flex-col bg-gray-100 dark:bg-gray-900 px-4 sm:px-6 py-6"><div className="flex items-center justify-between gap-4 mb-6"><div><p className="font-bold text-lg text-gray-800 dark:text-gray-100">OpenCafe</p><p className="text-xs text-gray-500 dark:text-gray-400">Cafe workspace</p></div><ThemeToggle/></div><div className="flex flex-1 items-center"><section aria-label="Sign in" className="grid w-full md:grid-cols-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"><aside aria-label="Welcome" className="hidden md:flex flex-col justify-center bg-violet-50 dark:bg-violet-500/10 p-8 lg:p-12"><span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-3xl font-bold mb-6">C</span><h2 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100">Your cafe, connected.</h2><p className="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">One workspace for your cafe team. Sign in with your admin or cashier account.</p></aside><form onSubmit={submit} className="min-w-0 p-6 sm:p-8 lg:p-12 space-y-5"><div><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Welcome back</p><h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">Sign in</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Enter your account details to continue.</p></div><Field label="Username" name="username" autoComplete="username" required maxLength={100} pattern="[A-Za-z0-9_.-]+"/><Field label="Password" name="password" type="password" autoComplete="current-password" required/><button className={`${primary} w-full`} type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="text-xs text-gray-500 dark:text-gray-400">For admin and cashier accounts.</p></form></section></div></main>;
}
