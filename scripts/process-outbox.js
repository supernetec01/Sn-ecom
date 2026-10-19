import { openStore } from '../store.js';
import { sha, now } from '../commerce-store.js';
if(!process.env.EMAIL_API_KEY||!process.env.EMAIL_FROM||!process.env.APP_ORIGIN){console.error('Cần EMAIL_API_KEY (Resend), EMAIL_FROM đã xác minh và APP_ORIGIN. Không có email nào được gửi.');process.exitCode=1;}else{
 const db=openStore();try{
  // One worker per database. Provider idempotency key also protects a retry after a lost response.
  for(const row of db.prepare("SELECT * FROM notification_outbox WHERE status='queued' ORDER BY id LIMIT 50").all()){
   try{const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.EMAIL_API_KEY,'Content-Type':'application/json','Idempotency-Key':sha(`${row.id}:${row.recipient}:${row.subject}:${row.body}`)},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[row.recipient],subject:row.subject,text:row.body})});
    if(!response.ok)throw Error('provider');db.prepare("UPDATE notification_outbox SET status='sent',attempts=attempts+1,sent=? WHERE id=?").run(now(),row.id);
   }catch{db.prepare("UPDATE notification_outbox SET attempts=attempts+1,status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'queued' END WHERE id=?").run(row.id);}
  }
  console.log('Đã xử lý hàng đợi email. Kiểm tra trạng thái trong quản trị.');
 }finally{db.close();}
}
