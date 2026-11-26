import {Routes,Route,Navigate} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';
import {AuthProvider,useAuth} from './context/AuthContext';
import {CashierProvider} from './context/CashierContext';
import {workspaceFor} from './lib/admin';
import POS from './pages/POS';
import CashierOrders from './pages/CashierOrders';
import CashierOrderDetail from './pages/CashierOrderDetail';
import ProtectedRoute from './context/ProtectedRoutes';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Unauthorized from './pages/Unauthorized';
import AdminLayout from './components/AdminLayout';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import Category from './pages/Category';
import Products from './pages/Products';
import CafeSettings from './pages/CafeSettings';
import Cashiers from './pages/Cashiers';
import Profile from './pages/Profile';
import SalesReport from './pages/SalesReport';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import './css/style.css';
import {LayoutSkeleton} from './components/Skeleton';
function Content(){const {status,user,error,retrySession}=useAuth();if(status==='loading')return <LayoutSkeleton/>;if(status==='error')return <main className="min-h-screen grid place-items-center"><section className="bg-white dark:bg-gray-800 rounded-xl p-8"><h1 className="text-xl font-bold">Session unavailable</h1><p role="alert" className="my-4">{error?.message}</p><button className="btn bg-violet-600 text-white" onClick={retrySession}>Restore session</button></section></main>;const routes=<Routes><Route path="/login" element={<Login/>}/><Route path="/change-password" element={<ChangePassword/>}/><Route path="/unauthorized" element={<Unauthorized/>}/><Route element={<ProtectedRoute roles={['ADMIN','CASHIER']}/>}><Route element={<AdminLayout/>}><Route path="/profile" element={<Profile/>}/><Route element={<ProtectedRoute roles={['CASHIER']}/>}><Route path="/pos" element={<POS/>}/><Route path="/my-orders" element={<CashierOrders/>}/><Route path="/my-orders/:id" element={<CashierOrderDetail/>}/></Route><Route element={<ProtectedRoute/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/categories" element={<Category/>}/><Route path="/products" element={<Products/>}/><Route path="/cafe-settings" element={<CafeSettings/>}/><Route path="/cashiers" element={<Cashiers/>}/><Route path="/sales-report" element={<SalesReport/>}/><Route path="/orders" element={<Orders/>}/><Route path="/orders/:id" element={<OrderDetail/>}/></Route></Route></Route><Route path="/" element={<Navigate to={workspaceFor(user)} replace/>}/><Route path="*" element={<NotFound/>}/></Routes>;
// Keep private state across every same-session route, without keying anonymous forms.
return status==='authenticated'?<CashierProvider>{routes}</CashierProvider>:routes;}
export default function App(){return <AuthProvider><Toaster position="top-right"/><Content/></AuthProvider>;}
