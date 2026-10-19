import { spawn } from 'node:child_process';
import { demoEnvironment, projectDir } from './demo-config.js';

console.log('Tạo admin cho dữ liệu demo riêng trong data/demo.');
const child = spawn(process.execPath, ['scripts/admin.js'], {
  cwd: projectDir, env: demoEnvironment(), stdio: 'inherit',
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
