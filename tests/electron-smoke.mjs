import { spawn } from 'child_process';
import { createServer } from 'net';
import { platform } from 'os';

const PORT = 43210;
const TIMEOUT = 30000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.on('error', () => resolve(findAvailablePort(startPort + 1)));
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
  });
}

async function waitForServer(url, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  if (platform() !== 'win32') {
    console.log('Skipping Electron smoke test on non-Windows platform');
    process.exit(0);
  }

  const availablePort = await findAvailablePort(PORT);

  const proc = spawn('npx', ['electron', '.'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DASHBOARD_PORT: String(availablePort) },
    shell: true,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
    console.error('Electron failed to start within timeout');
    process.exit(1);
  }, TIMEOUT);

  const url = `http://127.0.0.1:${availablePort}/api/status`;
  const started = await waitForServer(url, TIMEOUT);

  clearTimeout(timer);

  if (!started) {
    proc.kill();
    console.error(`Server did not respond at ${url} within ${TIMEOUT}ms`);
    process.exit(1);
  }

  const res = await fetch(url);
  const data = await res.json();
  console.log('Health check response:', JSON.stringify(data));

  proc.kill();

  if (data.status === 'running') {
    console.log('Electron smoke test passed');
    process.exit(0);
  } else {
    console.error('Unexpected health check response:', data);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Smoke test error:', err);
  process.exit(1);
});
