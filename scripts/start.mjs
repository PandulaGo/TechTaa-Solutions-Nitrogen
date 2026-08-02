import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = spawn(process.execPath, ['src/index.js'], { cwd: root, stdio: 'inherit' });
const frontend = spawn(process.execPath, ['src/web/server.js'], { cwd: root, stdio: 'inherit' });

function shutdown() {
  backend.kill();
  frontend.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

backend.on('exit', (code) => {
  console.log(`[start] backend exited (code ${code})`);
  frontend.kill();
  process.exit(code ?? 0);
});
frontend.on('exit', (code) => {
  console.log(`[start] frontend exited (code ${code})`);
  backend.kill();
  process.exit(code ?? 0);
});
