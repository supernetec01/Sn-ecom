import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { transact, now, event, notifyOrder, commerceSettings, audit } from './commerce-store.js';
export const paymentConfigured=()=>Boolean(process.env.VNPAY_TMN_CODE&&process.env.VNPAY_HASH_SECRET&&process.env.APP_ORIGIN);
const encode=s=>encodeURIComponent(String(s)).replaceAll('%20','+');
export const paymentQuery=data=>Object.keys(data).sort().map(k=>encode(k)+'='+encode(data[k])).join('&');
export const signPayment=data=>createHmac('sha512',process.env.VNPAY_HASH_SECRET).update(paymentQuery(data)).digest('hex');
const vnDate=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date).replace(/[^0-9]/g,'');
export function installPayments(app,db,{optionalCsrf,getOrder,write}){
 app.post('/api/orders/:id/payment-link',optionalCsrf,write((req,res)=>{
  if(!paymentConfigured())return res.status(503).json({error:'Chưa cấu hình tài khoản thanh toán VNPay.'});
  const o=getOrder(req);if(o.payment!=='vnpay'||o.status==='cancelled'||o.payment_status!=='unpaid'||o.total<=0)return res.status(400).json({error:'Đơn không đủ điều kiện thanh toán trực tuyến.'});
  const existing=db.prepare('SELECT * FROM payment_intents WHERE order_id=? AND expires>? ORDER BY created DESC LIMIT 1').get(o.id,Date.now());
  const ref=existing?.reference||`${o.id}-${randomBytes(12).toString('hex')}`,created=existing?.created||Date.now(),expires=existing?.expires||Date.now()+15*60000;
  if(!existing)db.prepare('INSERT INTO payment_intents VALUES(?,?,?,?,?)').run(ref,o.id,o.total,created,expires);
  const data={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:process.env.VNPAY_TMN_CODE,vnp_Amount:String(o.total*100),vnp_CurrCode:'VND',vnp_TxnRef:ref,vnp_OrderInfo:`Thanh toan don SN${o.id}`,vnp_OrderType:'other',vnp_Locale:'vn',vnp_ReturnUrl:process.env.APP_ORIGIN.replace(/\/$/,'')+'/thanh-toan',vnp_IpAddr:req.ip?.replace('::ffff:','')||'127.0.0.1',vnp_CreateDate:vnDate(new Date(created)),vnp_ExpireDate:vnDate(new Date(expires))};
  const host=process.env.VNPAY_LIVE==='true'?'https://pay.vnpay.vn/vpcpay.html':'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';res.json({url:host+'?'+paymentQuery(data)+'&vnp_SecureHash='+signPayment(data),sandbox:process.env.VNPAY_LIVE!=='true'});
 }));
 app.get('/api/payments/vnpay/ipn',(req,res)=>{
  const reply=(RspCode,Message)=>res.json({RspCode,Message});if(!paymentConfigured())return reply('99','Not configured');
  const params=Object.fromEntries(Object.entries(req.query).filter(([k])=>k.startsWith('vnp_')&&!['vnp_SecureHash','vnp_SecureHashType'].includes(k)));
  if(Object.values(params).some(v=>typeof v!=='string'))return reply('97','Invalid signature');const signature=req.query.vnp_SecureHash;
  if(typeof signature!=='string'||!/^[a-f0-9]{128}$/i.test(signature)||!timingSafeEqual(Buffer.from(signature.toLowerCase(),'hex'),Buffer.from(signPayment(params),'hex')))return reply('97','Invalid signature');
  if(params.vnp_TmnCode!==process.env.VNPAY_TMN_CODE)return reply('97','Invalid merchant');
  try{const result=transact(db,()=>{
   const intent=db.prepare('SELECT * FROM payment_intents WHERE reference=?').get(params.vnp_TxnRef);if(!intent)return ['01','Order not found'];const o=db.prepare('SELECT * FROM orders WHERE id=?').get(intent.order_id);
   if(!/^[0-9]+$/.test(params.vnp_Amount)||Number(params.vnp_Amount)!==intent.amount*100||o.total!==intent.amount)return ['04','Invalid amount'];
   if(params.vnp_ResponseCode!=='00'||params.vnp_TransactionStatus!=='00')return ['00','Payment was not successful'];
   if(!/^[0-9A-Za-z_-]{1,100}$/.test(params.vnp_TransactionNo||''))return ['99','Missing transaction reference'];
   const reference='vnpay:'+params.vnp_TransactionNo,prior=db.prepare('SELECT * FROM payment_transactions WHERE reference=?').get(reference);if(prior)return prior.order_id===o.id&&prior.amount===o.total?['00','Confirm Success']:['02','Already confirmed'];
   // A late payment on a released/cancelled order requires merchant reconciliation, never silent restocking.
   if(o.status==='cancelled'||o.payment_status!=='unpaid'||o.payment!=='vnpay')return ['02','Order requires reconciliation'];
   db.prepare("INSERT INTO payment_transactions(order_id,kind,amount,reference,actor,created) VALUES(?,'receipt',?,?,NULL,?)").run(o.id,o.total,reference,now());db.prepare("UPDATE orders SET payment_status='paid',expires=NULL WHERE id=?").run(o.id);
   const c=commerceSettings(db);if(c.rewardsEnabled&&o.status==='completed'&&db.prepare('SELECT role FROM users WHERE id=?').get(o.user_id)?.role!=='guest')db.prepare('INSERT OR IGNORE INTO loyalty_ledger(user_id,order_id,reason,points,created) VALUES(?,?,?,?,?)').run(o.user_id,o.id,'earn',Math.floor(Math.max(0,o.total-o.shipping)/c.pointsPer),now());
   event(db,o.id,null,'payment','Đã xác minh thanh toán VNPay.');audit(db,null,'vnpay_receipt',o.id,reference);notifyOrder(db,o,'Đã nhận thanh toán VNPay');return ['00','Confirm Success'];
  });return reply(...result);}catch{return reply('99','Unable to process');}
 });
 // The browser return is informational. Only a verified server IPN can change payment status.
 app.get('/thanh-toan',(_req,res)=>res.type('html').send('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kiểm tra thanh toán</title><h1>Kiểm tra thanh toán</h1><p>Cửa hàng sẽ cập nhật sau khi xác minh giao dịch. Trang chuyển hướng này không phải xác nhận đã thu tiền.</p><a href="/#account">Xem đơn trong tài khoản</a><p>Khách vãng lai dùng mã đơn và mã tra cứu riêng đã lưu.</p><a href="/#order/0">Tra cứu đơn</a></html>'));
}
