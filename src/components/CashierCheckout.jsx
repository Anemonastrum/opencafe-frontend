import {useEffect,useRef,useState} from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {useCashier} from '../context/CashierContext';
import {useAuth} from '../context/AuthContext';
import {cashierApi} from '../api/cashier';
import {adminApi} from '../api/admin';
import {paymentEstimate,reviewPaymentHistory,safeQrUrl} from '../lib/pos';
import {dateTime,downloadBlob,formatMoney} from '../lib/admin';
import {Card,Field,FormError,ConfirmDialog,primary,secondary} from './AdminUI';

function Money({amounts}){
 return <dl className="space-y-2 text-sm">{[['Captured total','orderTotalAmount'],['Rounding adjustment','roundingAdjustment'],['Payable','amount'],['Cash received','cashReceived'],['Change','changeAmount']].filter(([,key])=>amounts[key]!=null).map(([label,key])=><div key={key} className="flex flex-wrap justify-between gap-3" data-testid={key==='changeAmount'?'payment-change':undefined}><dt>{label}</dt><dd className="font-medium">{formatMoney(amounts[key])}</dd></div>)}</dl>;
}
function Qr({payment}){
 const url=safeQrUrl(payment.qrisQrUrl),[failed,setFailed]=useState(false),[local,setLocal]=useState(null);
 const payload=typeof payment.qrisPayload==='string'&&payment.qrisPayload.length<=10000?payment.qrisPayload:null;
 useEffect(()=>{setFailed(false);},[url]);
 useEffect(()=>{
  let active=true;setLocal(null);
  if(payload&&(!url||failed))QRCode.toDataURL(payload,{errorCorrectionLevel:'M',margin:4,width:320}).then(value=>{if(active)setLocal(value);}).catch(()=>{});
  return()=>{active=false;};
 },[url,payload,failed]);
 const source=(!failed&&url)||local;
 return <div className="space-y-3">{source?<img src={source} alt="QRIS payment code" referrerPolicy="no-referrer" className="w-72 max-w-full h-auto bg-white rounded-lg" onError={()=>{setFailed(true);setLocal(null);}}/>:<p role="alert">No usable QR is available. Do not create another charge. Check status or ask an administrator to investigate.</p>}{payment.expiresAt&&<p className="text-sm">Provider expiry (Jakarta): {dateTime(payment.expiresAt)}. Time alone does not confirm expiry; only server status can release this attempt.</p>}</div>;
}
export default function CashierCheckout({data,disabled=false,onRefresh}){
 const pos=useCashier(),auth=useAuth(),id=data.order.id,saved=pos.paymentIntents[id];
 const [method,setMethod]=useState('CASH'),[cash,setCash]=useState(''),[confirmation,setConfirmation]=useState(null),[receipt,setReceipt]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[snapshot,setSnapshot]=useState(null),[checks,setChecks]=useState(0),[invalidEvidence,setInvalidEvidence]=useState('');
 const guard=useRef(false),mounted=useRef(true),controllers=useRef(new Set()),latest=useRef(null),budget=useRef(0);
 const history=saved?.history||snapshot?.history||data.history;
 let reviewed,issue='';
 try{reviewed=reviewPaymentHistory(history,id,auth.user.id);issue=reviewed.issue;}catch(e){issue=e.message;}
 try{issue=reviewPaymentHistory(data.history,id,auth.user.id).issue||issue;}catch(e){issue=e.message;}
 issue=saved?.verificationIssue||invalidEvidence||issue;
 const order=reviewed?.order||data.order;
 const payment=reviewed&&!issue
  ? (saved?history.payments.find(p=>p.requestId===saved.intent.requestId):history.payments.find(p=>['PENDING','PAID'].includes(p.status)))
  : null;
 const state=saved?.status||payment?.status.toLowerCase();
 const active=payment?.method==='QRIS'&&payment.status==='PENDING'&&!issue;
 const retryBlocked=disabled||!!pos.orderChanges[id]||!!issue||!!data.blocked||data.order.checkoutVersion!==saved?.intent.checkoutVersion;
 const blocked=disabled||!!pos.orderChanges[id]||!!issue||!!data.blocked||!!saved||order.status!=='PENDING';
 let amounts=null,inputError='';
 try{amounts=paymentEstimate(order.totalAmount,method==='CASH'?cash:undefined);if(method==='QRIS'&&!amounts.qrisAllowed)inputError='QRIS amount must be IDR 1–10000000';}catch(e){inputError=e.message;}
 const completion=payment?.status==='PAID'&&order.status==='COMPLETED'&&!issue;
 latest.current={active,saved,payment,pos};
 useEffect(()=>{
  mounted.current=true;
  const timer=setInterval(()=>{
   if(document.visibilityState!=='visible'||!latest.current.active||guard.current||budget.current>=12)return;
   budget.current++;setChecks(budget.current);checkStatus(true);
  },10000);
  return()=>{mounted.current=false;clearInterval(timer);for(const controller of controllers.current)controller.abort();controllers.current.clear();};
 },[id]);
 function report(e){if(mounted.current&&e.code!=='SESSION_CHANGED'&&e.name!=='AbortError'){setError(e.message);toast.error(e.message);}}
 async function checkStatus(automatic=false){
  if(guard.current)return;
  guard.current=true;setBusy(true);setError('');
  const controller=new AbortController();controllers.current.add(controller);
  try{
   const current=latest.current;
   if(current.saved)await current.pos.verifyPayment(id,{signal:controller.signal,reconcile:current.saved.intent.method==='QRIS'});
   else{
    let providerError;
    if(current.payment?.method==='QRIS')try{await cashierApi.reconcilePayment(id,current.payment.id,{signal:controller.signal});}catch(e){providerError=e;}
    controller.signal.throwIfAborted();
    const fresh=await current.pos.readOrder(id,{signal:controller.signal});
    controller.signal.throwIfAborted();
    const review=reviewPaymentHistory(fresh.history,id,auth.user.id);
    if(mounted.current){setSnapshot(fresh);setInvalidEvidence(review.issue);}
    if(providerError)throw providerError;
   }
  }catch(e){
   if(mounted.current&&e.code==='INVALID_PAYMENT_EVIDENCE')setInvalidEvidence(e.message);
   if(!automatic||e.name!=='AbortError')report(e);
  }
  finally{controllers.current.delete(controller);guard.current=false;if(mounted.current)setBusy(false);}
 }
 async function review(){
  if(guard.current||blocked||inputError)return;
  guard.current=true;setBusy(true);setError('');
  try{
   const fresh=await pos.readOrder(id);
   if(fresh.blocked||pos.orderChanges[id])throw Error(fresh.blocked||'Resolve order change before payment');
   if(fresh.order.checkoutVersion!==data.order.checkoutVersion)throw Error('Order changed. Refresh details before paying.');
   const preview=paymentEstimate(fresh.order.totalAmount,method==='CASH'?cash:undefined);
   if(method==='QRIS'&&!preview.qrisAllowed)throw Error('QRIS amount must be IDR 1–10000000');
   const intent=pos.preparePayment(id,{method,checkoutVersion:fresh.order.checkoutVersion,...(method==='CASH'?{cashReceived:preview.cashReceived}:{})});
   if(mounted.current)setConfirmation({intent,amounts:preview});
  }catch(e){report(e);}finally{guard.current=false;if(mounted.current)setBusy(false);}
 }
 async function reviewSaved(){
  if(guard.current)return;
  guard.current=true;setBusy(true);setError('');
  try{
   const fresh=await pos.readOrder(id);
   if(fresh.blocked||fresh.order.checkoutVersion!==saved.intent.checkoutVersion||pos.orderChanges[id])throw Error(fresh.blocked||'Order changed. Review details before paying.');
   if(mounted.current)setConfirmation({intent:saved.intent,amounts:paymentEstimate(fresh.order.totalAmount,saved.intent.method==='CASH'?saved.intent.cashReceived:undefined)});
  }catch(e){report(e);}finally{guard.current=false;if(mounted.current)setBusy(false);}
 }
 async function pay(){
  if(guard.current)return;
  guard.current=true;setBusy(true);setError('');
  try{
   const result=await pos.submitPayment(id);
   if(mounted.current&&result.order.status==='COMPLETED')onRefresh();
  }catch(e){report(e);}finally{guard.current=false;if(mounted.current){setBusy(false);setConfirmation(null);}}
 }
 function discard(){
  try{pos.discardPaymentIntent(id);setConfirmation(null);setSnapshot(null);setError('');onRefresh();}catch(e){report(e);}
 }
 async function download(){
  if(guard.current)return;
  guard.current=true;setBusy(true);setError('');
  try{
   const fresh=await pos.readOrder(id),review=reviewPaymentHistory(fresh.history,id,auth.user.id);
   if(review.issue||review.order.status!=='COMPLETED')throw Error(review.issue||'Receipt requires verified completion');
   if(receipt==='generate'){await adminApi.generateReceipt(id);if(mounted.current)toast.success('Receipt generated or existing receipt retained.');}
   const blob=await adminApi.downloadReceipt(id);
   if(mounted.current)downloadBlob(blob,{filename:`order_${id}_receipt.pdf`,mime:'application/pdf'});
  }catch(e){report(e);}finally{guard.current=false;if(mounted.current){setBusy(false);setReceipt(null);}}
 }
 return <Card title="Checkout"><div className="space-y-4"><FormError error={error}/>{issue&&<p role="alert">{issue}</p>}
  {completion&&<><p role="status">Payment completion verified.</p><Money amounts={payment}/><div className="flex flex-wrap gap-3"><button className={secondary} disabled={busy} onClick={()=>setReceipt('generate')}>Generate and download receipt</button><button className={secondary} disabled={busy} onClick={()=>setReceipt('download')}>Download existing receipt</button></div></>}
  {payment&&<><p role="status">Server payment status: {payment.status}</p>{active&&<Qr key={payment.id} payment={payment}/>}</>}
  {saved&&!payment&&<p role="status">Saved payment: {state}. Do not create a replacement charge. Check payment history first.</p>}
  {saved?.error&&<FormError error={saved.error.message}/>}
  {saved?.status==='ready'&&!confirmation&&<button className={secondary} disabled={busy} onClick={reviewSaved}>Review saved payment</button>}
  {saved?.status==='ready'&&!confirmation&&<button className={secondary} disabled={busy} onClick={discard}>Discard unsent payment</button>}
  {(active||(!saved&&!!issue)||(saved&&!['ready','rejected'].includes(state)))&&<button className={secondary} disabled={busy||['checking','submitting'].includes(state)} onClick={()=>checkStatus()}>Check payment status</button>}
  {active&&<p className="text-sm">{checks>=12?'Automatic checks stopped. Manual checks remain available.':`Automatic status checks every 10 seconds while visible (${checks}/12).`} No new charge is created by checking.</p>}
  {saved?.status==='uncertain'&&saved.retryAllowed&&<button className={primary} disabled={busy||retryBlocked} onClick={pay}>Retry identical payment</button>}
  {saved&&!saved.verificationIssue&&['rejected','failed','expired'].includes(state)&&<button className={secondary} disabled={busy} onClick={discard}>Review new attempt</button>}
  {!saved&&!payment&&<><Field label="Payment method">{fieldId=><select id={fieldId} className="form-select w-full" value={method} disabled={busy||blocked} onChange={e=>setMethod(e.target.value)}><option value="CASH">CASH</option><option value="QRIS">QRIS</option></select>}</Field>{method==='CASH'&&<Field label="Cash received" value={cash} inputMode="decimal" disabled={busy||blocked} onChange={e=>setCash(e.target.value)}/>}{amounts&&<Money amounts={amounts}/>}<FormError error={inputError}/><button className={primary} disabled={busy||blocked||!!inputError} onClick={review}>Review payment</button></>}
  {confirmation&&<ConfirmDialog title="Confirm payment?" confirmLabel="Confirm payment" busy={busy} onConfirm={pay} onClose={()=>{if(!busy){pos.discardPaymentIntent(id);setConfirmation(null);}}}><p>Order {order.orderNumber} · {confirmation.intent.method}. Confirm the captured total and tender before paying.</p><Money amounts={confirmation.amounts}/></ConfirmDialog>}
  {receipt&&<ConfirmDialog title="Download private receipt?" confirmLabel="Download receipt" busy={busy} onConfirm={download} onClose={()=>setReceipt(null)}><p>Receipt includes cafe, cashier and transaction details. Download only to a trusted device and share only with authorized recipients.</p></ConfirmDialog>}
 </div></Card>;
}
