import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoEnvironment, demoDataDir, projectDir, quickTunnelOrigin } from './demo-config.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function findCloudflared() {
  const candidates = ['cloudflared'];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'));
  }
  for (const command of candidates) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (result.status === 0) return { command, args: [] };
  }
  throw new Error('Chưa tìm thấy cloudflared. Trên PowerShell chạy: winget install --id Cloudflare.cloudflared --exact\nSau đó mở PowerShell mới và chạy lại npm.cmd run demo.');
}

async function checkPort(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error(`Cổng ${port} đang được dùng hoặc không thể mở. Thử: npm.cmd run demo -- --port 3031`)));
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}

// Exported so lifecycle tests can run a real server against an isolated DB
// with a simulated tunnel; tests never publish a site or use shop data.
export async function startDemo({ port = 3030, dataDir = demoDataDir, cloudflared, request = fetch, timeoutMs = 90000, log = console.log } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng demo phải từ 1 đến 65535.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Cần Node.js 24 trở lên.');
  await checkPort(port);
  const binary = cloudflared || findCloudflared();
  const temp = mkdtempSync(path.join(tmpdir(), 'sn-demo-tunnel-'));
  const config = path.join(temp, 'config.yml');
  writeFileSync(config, '{}\n', { mode: 0o600 });
  const children = [], exits = [];
  let stopped = false, stopping, failure, origin = '', output = '', webOutput = '';
  const local = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;

  const stop = () => stopping ||= (async () => {
    stopped = true;
    for (const child of [...children].reverse()) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => {
      for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 2500);
    try { await Promise.all(exits); } finally {
      clearTimeout(timer);
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      rmSync(temp, { recursive: true, force: true });
    }
  })();
  const onSignal = () => { void stop(); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  function launch(label, command, args, options) {
    const child = spawn(command, args, { cwd: projectDir, windowsHide: true, ...options });
    children.push(child);
    exits.push(new Promise(resolve => {
      const failed = reason => {
        if (!stopped) {
          failure = new Error(`${label} đã dừng: ${reason}`);
          void stop();
        }
      };
      child.once('error', error => { failed(error.message); resolve(); });
      child.once('exit', (code, signal) => { failed(signal || `mã ${code}`); resolve(); });
    }));
    return child;
  }
  async function until(check, message) {
    while (Date.now() < deadline) {
      if (failure) throw failure;
      if (stopped) throw new Error('Đã dừng demo.');
      if (await check()) return;
      await delay(200);
    }
    throw new Error(message);
  }
  async function healthy(url) {
    try {
      const response = await request(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
      return response.ok && (await response.json()).status === 'ok';
    } catch { return false; }
  }

  try {
    log('Đang tạo đường dẫn HTTPS miễn phí qua Cloudflare…');
    const tunnel = launch('Cloudflare Tunnel', binary.command, [...(binary.args || []), 'tunnel', '--config', config, '--no-autoupdate', '--protocol', 'http2', '--url', local], {
      env: demoEnvironment({ port, dataDir }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    const readTunnel = chunk => {
      output = (output + chunk.toString()).slice(-16000);
      origin ||= quickTunnelOrigin(output) || '';
    };
    tunnel.stdout.on('data', readTunnel); tunnel.stderr.on('data', readTunnel);
    await until(() => Boolean(origin), 'Cloudflare chưa cấp được link. Kiểm tra Internet, VPN hoặc tường lửa rồi thử lại.');
    log('Đang khởi động website và kiểm tra đường dẫn công khai…');
    const server = launch('Website', process.execPath, ['server.js'], {
      env: demoEnvironment({ origin, port, dataDir }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    const readServer = chunk => { webOutput = (webOutput + chunk.toString()).slice(-4000); };
    server.stdout.on('data', readServer); server.stderr.on('data', readServer);
    await until(() => healthy(local + '/healthz'), 'Website chưa khởi động được.');
    await until(() => healthy(origin + '/healthz'), 'Website đã chạy nhưng chưa truy cập được link Cloudflare. Kiểm tra kết nối rồi thử lại.');
    log(`\nLink demo: ${origin}\nQuản trị: ${origin}/#admin\nDữ liệu demo: ${dataDir}\nMở link bằng trình duyệt hoặc gửi cho tester.\nGiữ cửa sổ này mở. Nhấn Ctrl+C để đóng website và tunnel.\nChưa có admin? Mở PowerShell khác và chạy: npm.cmd run demo:admin\n`);
    return { origin, port, stop, done: Promise.all(exits).then(() => { if (failure) throw failure; }) };
  } catch (error) {
    await stop();
    // Only this quick tunnel's logs are captured; no user's named tunnel/config.
    const details = webOutput || output;
    if (details) log(details.trim());
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--port' && /^\d+$/.test(args[1]))) {
    console.error('Cách chạy: npm.cmd run demo [-- --port 3031]'); process.exitCode = 1;
  } else {
    try { const demo = await startDemo({ port: args.length ? Number(args[1]) : 3030 }); await demo.done; }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
