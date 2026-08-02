// Standalone nightly backup runner (used by Task Scheduler, works even if the app is down).
import { runNightly } from '../src/backup.js';

runNightly();
console.log('[backup] nightly backup complete');
