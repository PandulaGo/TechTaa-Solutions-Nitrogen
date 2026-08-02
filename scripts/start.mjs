import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logsDir = path.join(root, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const streams = {
  backend: fs.createWriteStream(path.join(logsDir, 'backend.log'), { flags: 'a' }),
  frontend: fs.createWriteStream(path.join(logsDir, 'frontend.log'), { flags: 'a' }),
};

const children = new Map();
const startedAt = new Map();
let shuttingDown = false;

function launch(name, args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  children.set(name, child);
  startedAt.set(name, Date.now());
  child.stdout.pipe(streams[name]);
  child.stderr.pipe(streams[name]);
  child.on('exit', (code, signal) => {
    children.delete(name);
    const ts = new Date().toISOString();
    if (shuttingDown) return;
    const upFor = Date.now() - (startedAt.get(name) || 0);
    const delay = upFor < 3000 ? 10000 : 3000;
    console.log(`[${ts}] ${name} exited (code=${code} signal=${signal}), restarting in ${delay / 1000}s`);
    setTimeout(() => launch(name, args), delay);
  });
  return child;
}

launch('backend', ['src/index.js']);
launch('frontend', ['src/web/server.js']);

function shutdown() {
  shuttingDown = true;
  for (const child of children.values()) child.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
