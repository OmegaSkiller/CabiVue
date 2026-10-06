import { spawn } from 'node:child_process';
process.env.PORT ||= '3210';
process.env.APP_ORIGIN ||= 'http://localhost:5173';
const children = [
  spawn(process.execPath, ['--watch', '--import', 'tsx', 'src/server/index.ts'], {
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    stdio: 'inherit',
    env: process.env,
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
