import { backup } from 'node:sqlite';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { openStore } from '../store.js';
const data=path.resolve(process.env.DATA_DIR||'./data'),root=process.argv[2]&&path.resolve(process.argv[2]);
if(!root||root===data||root.startsWith(data+path.sep))throw Error('Cung cấp thư mục sao lưu nằm ngoài DATA_DIR.');
const target=path.join(root,new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(target,{recursive:true,mode:0o700});
const db=openStore(data);try{await backup(db,path.join(target,'store.sqlite'));if(existsSync(path.join(data,'uploads')))cpSync(path.join(data,'uploads'),path.join(target,'uploads'),{recursive:true,errorOnExist:true,force:false});console.log('Đã tạo bản sao lưu tại '+target);}finally{db.close();}
