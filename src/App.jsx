import {Routes,Route,Navigate} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';
import {AuthProvider,useAuth} from './context/AuthContext';
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
function Content(){const {status,error,retrySession}=useAuth();if(status==='loading')return <div role="status" className="min-h-screen grid place-items-center">Loading session…</div>;if(status==='error')return <main className="min-h-screen grid place-items-center"><section className="bg-white dark:bg-gray-800 rounded-xl p-8"><h1 className="text-xl font-bold">Session unavailable</h1><p role="alert" className="my-4">{error?.message}</p><button className="btn bg-violet-600 text-white" onClick={retrySession}>Restore session</button></section></main>;return <Routes><Route path="/login" element={<Login/>}/><Route path="/change-password" element={<ChangePassword/>}/><Route path="/unauthorized" element={<Unauthorized/>}/><Route element={<ProtectedRoute/>}><Route element={<AdminLayout/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/categories" element={<Category/>}/><Route path="/products" element={<Products/>}/><Route path="/cafe-settings" element={<CafeSettings/>}/><Route path="/cashiers" element={<Cashiers/>}/><Route path="/profile" element={<Profile/>}/><Route path="/sales-report" element={<SalesReport/>}/><Route path="/orders" element={<Orders/>}/><Route path="/orders/:id" element={<OrderDetail/>}/></Route></Route><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="*" element={<NotFound/>}/></Routes>;}
export default function App(){return <AuthProvider><Toaster position="top-right"/><Content/></AuthProvider>;}
