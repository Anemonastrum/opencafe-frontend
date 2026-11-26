import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {gateFor} from '../lib/admin';
export default function ProtectedRoute({children,roles=['ADMIN']}) {
 const {user}=useAuth();
 const target=gateFor(user,roles);
 if(target)return <Navigate to={target} replace/>;
 return children || <Outlet/>;
}
