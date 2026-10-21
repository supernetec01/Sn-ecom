// Only creates disposable Docker containers/volumes. Never opens the shop's data/.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as pause } from 'node:timers/promises';

const image=process.env.DEPLOY_TEST_IMAGE||'supernet-store:local';
const suffix=randomBytes(6).toString('hex'),name='sn-deploy-test-'+suffix,volume=name+'-data';
const docker=(args,input)=>{
  const result=spawnSync('docker',args,{encoding:'utf8',input,timeout:60000});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(result.stderr||`Docker exited ${result.status}`);
  return result.stdout.trim();
};
const start=async()=>{
  docker(['run','-d','--name',name,'--read-only','--tmpfs','/tmp:size=64m,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges:true','-e','APP_ORIGIN=https://shop.example.test','-p','127.0.0.1::3000','-v',volume+':/var/lib/supernet',image]);
  const port=docker(['port',name,'3000/tcp']).split(':').at(-1),base='http://127.0.0.1:'+port;
  for(let attempt=0;attempt<100;attempt++){
    try{if((await fetch(base+'/healthz',{signal:AbortSignal.timeout(1000)})).ok)return base;}catch{}
    await pause(200);
  }
  throw Error('Container did not become healthy.\n'+docker(['logs',name]));
};
try {
  docker(['volume','create',volume]);
  let base=await start();
  assert.notEqual(docker(['exec',name,'id','-u']),'0');
  const password=randomBytes(20).toString('hex');
  docker(['exec','-i',name,'node','--input-type=module','-e',`import {openStore,hashPassword} from './store.js';let input='';for await(const chunk of process.stdin)input+=chunk;const db=openStore();db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('Deploy QA','deploy@example.test',hashPassword(JSON.parse(input).password));db.close();`],JSON.stringify({password}));
  const login=async()=>{
    const response=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://shop.example.test','Content-Type':'application/json'},body:JSON.stringify({email:'deploy@example.test',password})});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i);
    return {cookie:cookie.split(';')[0],...(await response.json())};
  };
  const session=await login(),headers={Origin:'https://shop.example.test',Cookie:session.cookie,'X-CSRF-Token':session.csrf};
  assert.equal((await fetch(base+'/api/me',{headers})).status,200);
  assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://wrong.example.test','Content-Type':'application/json'},body:'{}'})).status,403);
  const photo=readFileSync(new URL('../public/images/products/coc-su-morning.webp',import.meta.url));
  const upload=await fetch(base+'/api/admin/upload',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:photo});
  assert.equal(upload.status,201);const uploaded=(await upload.json()).url;
  const items=await (await fetch(base+'/api/admin/products',{headers})).json(),product=items.find(p=>p.id===1);
  const changed=await fetch(base+'/api/admin/products/1',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({revision:product.revision,name:'Persistent deployment QA',image:uploaded})});
  assert.equal(changed.status,200);
  docker(['rm','-f','-v',name]);base=await start();
  const restored=await (await fetch(base+'/api/products/1')).json();
  assert.equal(restored.name,'Persistent deployment QA');assert.equal(restored.image,uploaded);
  assert.equal((await fetch(base+uploaded)).status,200);await login();
  docker(['exec',name,'node','scripts/backup.js','/backups']);
  const backup=JSON.parse(docker(['exec',name,'node','--input-type=module','-e',`import {readdirSync,statSync} from 'node:fs';const dir='/backups/'+readdirSync('/backups')[0];console.log(JSON.stringify({bytes:statSync(dir+'/store.sqlite').size,photos:readdirSync(dir+'/uploads').length}));`]));
  assert.ok(backup.bytes>0);assert.ok(backup.photos>0);
  console.log('PASS production container: non-root, read-only filesystem, secure session, origin checks, Sharp upload, account/product/photo persistence after container recreation, SQLite and upload backup.');
} finally {
  spawnSync('docker',['rm','-f','-v',name],{stdio:'ignore'});
  spawnSync('docker',['volume','rm',volume],{stdio:'ignore'});
}
