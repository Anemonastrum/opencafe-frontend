import {Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import toast from 'react-hot-toast';
export default function Unauthorized(){const {user,logout}=useAuth();if(!user)return <Navigate to="/login" replace/>;return <main className="min-h-screen grid place-items-center p-6"><section className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-lg"><h1 className="text-2xl font-bold mb-3">Administrator access only</h1><p className="mb-6">Cashier dashboard and POS are not available in this release.</p><button className="btn bg-violet-600 text-white" onClick={()=>logout().catch(e=>toast.error(e.message))}>Sign out</button></section></main>;}
