import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {gateFor} from '../lib/admin';
export default function ProtectedRoute({children}) {
 const {user}=useAuth();
 const target=gateFor(user);
 if(target)return <Navigate to={target} replace/>;
 return children || <Outlet/>;
}
