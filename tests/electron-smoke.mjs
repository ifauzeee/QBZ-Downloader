import { spawn } from 'child_process';
import { createServer } from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT = 30000;

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
  const availablePort = await findAvailablePort(43210);
  const serverEntry = path.resolve(__dirname, '..', 'dist', 'index.js');

  console.log(`Starting server on port ${availablePort}...`);
  const proc = spawn('node', [serverEntry], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      DASHBOARD_PORT: String(availablePort),
      DASHBOARD_HOST: '127.0.0.1',
      QBZ_DESKTOP: '1',
      NODE_ENV: 'test',
    },
  });

  proc.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

  let serverExited = false;
  let serverExitCode = null;
  proc.on('exit', (code) => {
    serverExited = true;
    serverExitCode = code;
  });

  /** Gracefully stop the server and wait for it to exit. */
  async function stopServer() {
    if (serverExited) return;
    proc.kill('SIGTERM');
    // Wait up to 10s for the server to actually exit
    for (let i = 0; i < 100; i++) {
      if (serverExited) break;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    console.error('Server failed to start within timeout');
    stopServer().then(() => process.exit(1));
  }, TIMEOUT);

  const url = `http://127.0.0.1:${availablePort}/api/status`;
  const started = await waitForServer(url, TIMEOUT);

  clearTimeout(timer);

  if (!started) {
    await stopServer();
    console.error(`Server did not respond at ${url} within ${TIMEOUT}ms`);
    process.exit(1);
  }

  const res = await fetch(url);
  const data = await res.json();
  console.log('Status check response:', JSON.stringify(data));

  await stopServer();

  if (data.status === 'running') {
    console.log('Smoke test passed');
    process.exit(0);
  } else {
    console.error('Unexpected status response:', data);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Smoke test error:', err);
  process.exit(1);
});
