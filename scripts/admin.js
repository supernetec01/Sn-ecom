import { openStore, hashPassword } from '../store.js';
import { createInterface } from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
const email=(await rl.question('Email quản trị: ')).trim().toLowerCase();
console.log('Nhập mật khẩu từ 12 ký tự (ký tự nhập được ẩn).');
// Read directly in raw mode to avoid displaying the password.
if(!process.stdin.isTTY) {console.error('Chạy lệnh trong terminal tương tác.');process.exit(1);}
rl.close(); process.stdin.setRawMode(true); process.stdin.resume();
let password='';
process.stdin.on('data',chunk=>{for(const c of chunk.toString()){if(c==='\u0003')process.exit(1);if(c==='\r'||c==='\n'){process.stdin.setRawMode(false);process.stdin.pause();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12){console.error('\nEmail hoặc mật khẩu không hợp lệ.');process.exit(1);} const db=openStore();if(db.prepare('SELECT id FROM users WHERE email=?').get(email)){console.error('\nEmail đã tồn tại; không thay đổi tài khoản.');process.exit(1);}db.prepare("INSERT INTO users(email,name,password,role) VALUES(?,?,?,'admin')").run(email,'Quản trị viên',hashPassword(password));console.log('\nĐã tạo quản trị viên.');process.exit(0);}else if(c==='\u007f'){password=password.slice(0,-1);}else{password+=c;}}});
