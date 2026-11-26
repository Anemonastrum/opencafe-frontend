import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import {client,ApiError} from '../api/client.js';
import {cashierApi,validateItems,validatePayment} from '../api/cashier.js';
import {fixedMoney,parseMoney,reviewCapturedOrder,reviewOrder,reviewPaymentHistory,paymentEstimate,paymentRequestId} from '../lib/pos.js';

const CashierContext=createContext(null);
const identity=session=>JSON.stringify([session.status,session.generation,session.user?.id,session.user?.role]);
const idle=()=>Object.freeze({status:'idle',orderId:null,error:null});
export function useCashier(){const value=useContext(CashierContext);if(!value)throw Error('CashierProvider required');return value;}
export function CashierProvider({children,api=cashierApi}){
 const session=useAuth(),key=identity(session);
 return <CashierSession key={key} sessionKey={key} api={api}>{children}</CashierSession>;
}
function CashierSession({children,sessionKey,api}){
 const [state,setState]=useState(()=>({cart:Object.freeze([]),creation:idle(),paymentIntents:Object.freeze({}),orderChanges:Object.freeze({})})),current=useRef(state),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const check=()=>{if(!mounted.current||identity(client.getSession())!==sessionKey)throw new ApiError('Session changed',0,'SESSION_CHANGED');if(client.getSession().status!=='authenticated')throw new ApiError('Sign in required',401);};
 const publish=patch=>{check();current.current={...current.current,...patch};setState(current.current);};
 const editable=()=>{check();if(current.current.creation.status!=='idle')throw Error('Order creation unresolved; verify or inspect My orders');};
 const entry=key=>{check();if(!/^[1-9]\d{0,9}$/.test(String(key))||!['number','string'].includes(typeof key)||Number(key)>2147483647)throw Error('Invalid order ID');return current.current.paymentIntents[String(key)];};
 const paymentState=(key,value)=>publish({paymentIntents:Object.freeze({...current.current.paymentIntents,[key]:Object.freeze(value)})});
 async function verifyCreation(){
  check();const creation=current.current.creation;
  if(creation.status!=='verification'||creation.busy)throw Error('No order creation awaiting verification');
  publish({creation:Object.freeze({...creation,busy:true,error:null})});
  try{const order=await api.getOrder(creation.orderId);check();const reviewed=reviewCapturedOrder(order,creation.orderId,client.getSession().user.id);if(client.getSession().user.role!=='CASHIER'||reviewed.blocked||order.items.length!==creation.items.length||!creation.items.every(i=>order.items.some(line=>line.productId===i.productId&&line.quantity===i.quantity)))throw Error('Invalid order verification response; captured selection requires review');publish({cart:Object.freeze([]),creation:idle()});return order;}
  catch(error){check();publish({creation:Object.freeze({...creation,busy:false,error})});throw error;}
 }
 async function submitOrder(){
  editable();const items=Object.freeze(validateItems(current.current.cart.map(({id:productId,quantity})=>({productId,quantity}))).map(Object.freeze));
  publish({creation:Object.freeze({status:'submitting',items,orderId:null,error:null})});
  let response;
  try{response=await api.createOrder(items);check();}
  catch(error){check();publish({creation:Object.freeze({status:[400,401,403,404,409,422].includes(error.status)?'idle':'uncertain',items,orderId:null,error})});throw error;}
  const key=response?.order?.id;
  if(!Number.isInteger(key)||key<1||key>2147483647){const error=Error('Order creation result uncertain; inspect My orders');publish({creation:Object.freeze({status:'uncertain',items,orderId:null,error})});throw error;}
  publish({creation:Object.freeze({status:'verification',items,orderId:key,error:null})});return verifyCreation();
 }
 async function verifyPayment(key,{signal,reconcile=false}={}){
  const saved=entry(key);
  if(!saved||['submitting','checking'].includes(saved.status))throw Error('Payment unavailable for verification');
  paymentState(key,{...saved,status:'checking',retryAllowed:false,error:null});
  let verificationIssue='';
  try{
   let providerError=null;
   if(reconcile&&saved.paymentId){
    try{await api.reconcilePayment(key,saved.paymentId,{signal});check();}
    catch(error){check();signal?.throwIfAborted();providerError=error;}
   }
   const history=await api.getPayments(key,{signal});
   check();signal?.throwIfAborted();
   verificationIssue='Payment evidence could not be verified. Ask an administrator before continuing.';
   const reviewed=reviewPaymentHistory(history,key,client.getSession().user.id);
   if(reviewed.issue)throw Error(reviewed.issue);
   const matches=history.payments.filter(row=>row.requestId===saved.intent.requestId);
   if(!matches.length&&saved.status==='uncertain'){
    const paired=await readOrder(key,{signal});
    if(paired.blocked||current.current.orderChanges[key]||paired.order.checkoutVersion!==saved.intent.checkoutVersion)throw Error(paired.blocked||'Order changed. Inspect existing payment before retrying.');
    paymentState(key,{...saved,status:'uncertain',retryAllowed:true,history,verificationIssue:'',error:null});
    return history;
   }
   const payment=matches[0];
   if(matches.length!==1||!payment||payment.method!==saved.intent.method||
      (saved.paymentId!=null&&payment.id!==saved.paymentId)||
      (payment.method==='CASH'&&payment.cashReceived!==saved.intent.cashReceived)){
    throw Error('Payment not confirmed in history; reconcile saved intent.');
   }
   paymentState(key,{...saved,status:payment.status.toLowerCase(),retryAllowed:false,paymentId:payment.id,history,verificationIssue:'',error:providerError});
   if(providerError)throw providerError;
   return history;
  }catch(error){
   check();
   // A successful readback above remains authoritative even if provider lookup failed.
   if(entry(key).status==='checking')paymentState(key,{...saved,retryAllowed:false,verificationIssue:verificationIssue||saved.verificationIssue,error});
   throw error;
  }
 }
 async function submitPayment(key){
  const saved=entry(key);
  if(!saved||!(saved.status==='ready'||(saved.status==='uncertain'&&saved.retryAllowed)))throw Error('Payment intent cannot be submitted; verify existing payment');
  paymentState(key,{...saved,status:'submitting',retryAllowed:false,error:null});
  try{
   if(current.current.orderChanges[key])throw Error('Resolve existing order change before payment');
   const fresh=await readOrder(key);
   if(saved.status==='uncertain'&&fresh.history.payments.some(row=>row.requestId===saved.intent.requestId)){
    // An existing request is readback-only, even if its frozen version is now stale.
    paymentState(key,{...saved,status:'verification',retryAllowed:false,error:null});
    return verifyPayment(key);
   }
   if(fresh.blocked||current.current.orderChanges[key]||fresh.order.checkoutVersion!==saved.intent.checkoutVersion){
    throw Error(fresh.blocked||'Order changed. Review details before paying.');
   }
   const amounts=paymentEstimate(fresh.order.totalAmount,saved.intent.method==='CASH'?saved.intent.cashReceived:undefined);
   if(saved.intent.method==='QRIS'&&!amounts.qrisAllowed)throw Error('QRIS amount must be IDR 1–10000000');
  }catch(error){
   check();
   paymentState(key,{...saved,status:saved.status==='ready'?'rejected':'uncertain',retryAllowed:false,error});
   throw error;
  }
  let response;
  try{
   response=await api.createPayment(key,saved.intent);check();
  }catch(error){
   check();
   const rejected=error.status===400||(error.status===409&&error.message==='Order changed. Review details before paying.');
   paymentState(key,{...saved,status:rejected?'rejected':'uncertain',retryAllowed:false,error});
   throw error;
  }
  paymentState(key,{...saved,status:'verification',retryAllowed:false,paymentId:Number.isInteger(response?.payment?.id)&&response.payment.id>0?response.payment.id:null,error:null});
  return verifyPayment(key);
 }
 const changeState=(key,value)=>publish({orderChanges:Object.freeze({...current.current.orderChanges,[key]:value?Object.freeze(value):null})});
 const paymentBlocks=key=>{const saved=current.current.paymentIntents[String(key)];return saved&&(!!saved.verificationIssue||!['failed','expired','rejected'].includes(saved.status));};
 async function readOrder(key,options={}){
  check();if(client.getSession().user?.role!=='CASHIER')throw Error('Cashier permission required');
  const [detail,history]=await Promise.all([api.getOrder(key,options),api.getPayments(key,options)]);check();
  try{return reviewOrder(detail,history,key,client.getSession().user.id);}
  catch(error){error.code='INVALID_PAYMENT_EVIDENCE';throw error;}
 }
 async function verifyOrderChange(key){
  entry(key);const saved=current.current.orderChanges[key];if(!saved||saved.busy)throw Error('No order change awaiting verification');
  changeState(key,{...saved,busy:true,error:null});
  try{
   const result=await readOrder(key),order=result.order;
   const matches=saved.kind==='cancel'?order.status==='CANCELLED':order.items?.length===saved.items.length&&saved.items.every(i=>order.items.some(line=>line.productId===i.productId&&line.quantity===i.quantity));
   if(!matches)throw Error('Saved result not confirmed. Do not repeat this change; inspect My orders or ask an administrator.');
   if((saved.kind==='cancel'?result.reconciliation:result.blocked)||['taxName','taxRate','taxInclusive'].some(k=>order[k]!==saved.base[k])||saved.base.items.some(old=>order.items.some(i=>i.productId===old.productId&&(i.unitPrice!==old.unitPrice||i.productName!==old.productName)))||(saved.kind==='cancel'&&(order.items.length!==saved.base.items.length||saved.base.items.some(old=>!order.items.some(i=>i.productId===old.productId&&i.quantity===old.quantity))||['subtotalAmount','taxAmount','totalAmount'].some(k=>order[k]!==saved.base[k]))))throw Error('Changed order facts require reconciliation. Do not repeat this change.');
   changeState(key,null);return result;
  }catch(error){check();changeState(key,{...saved,busy:false,error});throw error;}
 }
 async function changeOrder(key,kind,items,base){
  entry(key);if(!['update','cancel'].includes(kind)||current.current.orderChanges[key]||paymentBlocks(key))throw Error('Resolve existing order or payment operation before changes');
  const selection=kind==='update'?Object.freeze(validateItems(items).map(Object.freeze)):null;
  changeState(key,{kind,items:selection,base,status:'reviewing',busy:true,error:null});
  let sent=false;
  try{
   const fresh=await readOrder(key);if(fresh.blocked||paymentBlocks(key)||fresh.order.checkoutVersion!==base.checkoutVersion)throw Error(fresh.blocked||'Order changed. Review fresh details before changes.');
   sent=true;changeState(key,{kind,items:selection,base,status:'submitting',busy:true,error:null});
   const response=kind==='cancel'?await api.cancelOrder(key):await api.updateOrder(key,selection);check();
   if(String(response?.order?.id)!==String(key))throw Error('Invalid mutation response; verify saved result before continuing');
   changeState(key,{kind,items:selection,base,status:'verification',busy:false,error:null});
  }catch(error){check();if(!sent||[400,401,403,404,409,422].includes(error.status))changeState(key,null);else changeState(key,{kind,items:selection,base,status:'uncertain',busy:false,error});throw error;}
  return verifyOrderChange(key);
 }
 return <CashierContext.Provider value={{...state,readOrder,changeOrder,verifyOrderChange,paymentBlocks,
  setQuantity(product,quantity){
   editable();if(!Number.isInteger(quantity)||quantity<1||quantity>999)throw Error('Quantity must be 1–999');
   if(!product||!Number.isInteger(product.id)||product.id<1||product.id>2147483647||typeof product.name!=='string'||!product.name.trim()||product.isAvailable===false)throw Error('Invalid or unavailable product');
   const price=fixedMoney(parseMoney(product.price)),cart=current.current.cart,index=cart.findIndex(item=>item.id===product.id);
   if(index<0&&cart.length===100)throw Error('Cart supports at most 100 distinct products');
   const item=Object.freeze({id:product.id,name:product.name,price,quantity});publish({cart:Object.freeze(index<0?[...cart,item]:cart.map((old,i)=>i===index?item:old))});
  },
  removeItem(key){editable();entry(key);publish({cart:Object.freeze(current.current.cart.filter(item=>String(item.id)!==String(key)))});},
  clearCart(){editable();publish({cart:Object.freeze([])});},
  submitOrder,verifyCreation,
  startOver({inspected=false}={}){check();if(current.current.creation.status!=='uncertain'||!inspected)throw Error('Inspect My orders before starting over');publish({cart:Object.freeze([]),creation:idle()});},
  preparePayment(key,fields){
   const saved=entry(key);
   if(current.current.orderChanges[key])throw Error('Resolve existing order change before payment');
   const intent=Object.freeze(validatePayment({...fields,requestId:saved?.intent.requestId??paymentRequestId()}));
   if(saved){if(JSON.stringify(saved.intent)!==JSON.stringify(intent))throw Error('Payment intent is immutable; resolve existing intent first');return saved.intent;}
   paymentState(key,{intent,status:'ready',error:null,paymentId:null});return intent;
  },
  submitPayment,verifyPayment,
  discardPaymentIntent(key){
   const saved=entry(key);
   if(!saved)return;
   if(saved.verificationIssue||!['ready','rejected','failed','expired'].includes(saved.status)||
      saved.history?.order?.paymentHoldReason||saved.history?.payments.some(row=>
       row.reconciliationReason||!row.requestId||row.orderTotalAmount==null||
       row.roundingAdjustment==null||['PENDING','PAID'].includes(row.status))){
    throw Error('Payment unresolved; verify or reconcile before replacement');
   }
   const next={...current.current.paymentIntents};
   delete next[key];
   publish({paymentIntents:Object.freeze(next)});
  },
 }}>{children}</CashierContext.Provider>;
}
