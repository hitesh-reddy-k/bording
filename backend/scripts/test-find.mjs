import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();
const projectId = process.env.PACIFICDB_PROJECT_ID;

const proc = spawn('C:\\Program Files\\PacificDB Community\\bin\\pacificdb.exe', ['--no-start'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let out = '';
proc.stdout.on('data', d => { out += d.toString(); });
proc.stderr.on('data', d => { out += d.toString(); });

const cmds = [
  ...(projectId ? [`use project ${projectId}`] : []),
  'use pacificboard',
  'find users',
  'find users {"name":"Alice Updated"}',
  'find users {"email":"nobody@test.com"}',
  'findOne users {"name":"Alice Updated"}',
  'quit',
];

let i = 0;
function sendNext() {
  if (i < cmds.length) { proc.stdin.write(cmds[i++] + '\n'); setTimeout(sendNext, 1000); }
}
setTimeout(sendNext, 1500);

await new Promise(r => setTimeout(r, 10000));
console.log(out.slice(0, 6000));
proc.kill();
