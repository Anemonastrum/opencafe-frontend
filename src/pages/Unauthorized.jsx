import {Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import toast from 'react-hot-toast';
import {workspaceFor} from '../lib/admin';
export default function Unauthorized(){const {user,logout}=useAuth(),target=workspaceFor(user);if(target!=='/unauthorized')return <Navigate to={target} replace/>;return <main className="min-h-screen grid place-items-center p-6"><section className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-lg"><h1 className="text-2xl font-bold mb-3">Workspace unavailable</h1><p className="mb-6">Your account does not have access to this workspace.</p><button className="btn bg-violet-600 text-white" onClick={()=>logout().catch(e=>toast.error(e.message))}>Sign out</button></section></main>;}
