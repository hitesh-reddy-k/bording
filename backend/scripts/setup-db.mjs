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
  'create collection users',
  'create collection workspaces',
  'create collection projects',
  'create collection tasks',
  'create collection messages',
  'create collection comments',
  'create collection files',
  'create collection activity',
  'create collection notifications',
  'create collection vectors',
  'list collections',
  'quit',
];

let i = 0;
function sendNext() {
  if (i < cmds.length) {
    proc.stdin.write(cmds[i++] + '\n');
    setTimeout(sendNext, 600);
  }
}

setTimeout(sendNext, 1500);

await new Promise(r => setTimeout(r, 12000));
console.log('OUTPUT:', out.slice(0, 5000));
proc.kill();
