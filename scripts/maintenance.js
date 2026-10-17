import { openStore } from '../store.js';
import { expireOrders } from '../commerce-store.js';
const db=openStore();try{console.log('Đơn hết hạn:',expireOrders(db));db.prepare('DELETE FROM account_tokens WHERE expires<?').run(Date.now());db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE created<?)').run(new Date(Date.now()-30*86400000).toISOString());db.prepare('DELETE FROM chat_sessions WHERE created<?').run(new Date(Date.now()-30*86400000).toISOString());}finally{db.close();}
