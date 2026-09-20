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

// Delete the test user with no passwordHash
const cmds = [
  ...(projectId ? [`use project ${projectId}`] : []),
  'use pacificboard',
  'find users {}',
  'delete users {"_id":"u1"}',
  'count users {}',
  'quit',
];

let i = 0;
function sendNext() {
  if (i < cmds.length) { proc.stdin.write(cmds[i++] + '\n'); setTimeout(sendNext, 800); }
}
setTimeout(sendNext, 1500);

await new Promise(r => setTimeout(r, 8000));
console.log(out);
proc.kill();
