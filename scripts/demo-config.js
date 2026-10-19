import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectDir = fileURLToPath(new URL('../', import.meta.url));
export const demoDataDir = path.join(projectDir, 'data', 'demo');

export function demoEnvironment({ origin = '', port = 3030, dataDir = demoDataDir } = {}) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('TUNNEL_')));
  return {
    ...inherited,
    DATA_DIR: dataDir,
    PORT: String(port),
    HOST: '127.0.0.1',
    APP_ORIGIN: origin,
    NODE_ENV: 'production',
    TRUST_PROXY: 'loopback',
    // A demo must not accidentally inherit paid providers or a named tunnel.
    EMAIL_API_KEY: '', EMAIL_FROM: '', AI_API_KEY: '', AI_MODEL: '',
    TRANSLATION_API_KEY: '', VNPAY_TMN_CODE: '', VNPAY_HASH_SECRET: '', VNPAY_LIVE: 'false',
  };
}

export function quickTunnelOrigin(text) {
  return text.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com(?=[\s/|"'<>]|$)/i)?.[0];
}
