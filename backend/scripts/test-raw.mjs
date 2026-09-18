import { spawn } from 'child_process';

const proc = spawn('C:\\Program Files\\PacificDB Community\\bin\\pacificdb.exe', ['--no-start'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let out = '';
proc.stdout.on('data', d => { out += d.toString(); });
proc.stderr.on('data', d => { out += d.toString(); });

// Use 'explain' to see what query plan is used, and 'request' to see raw format
const cmds = [
  'use project project_6aac82acc9e681fba249ab88',
  'use pacificboard',
  // Try the raw 'request' command to see what parameters the CLI sends
  'request {"action":"find","dbName":"pacificboard","collection":"users","filter":{"name":"Alice Updated"}}',
  'request {"action":"find","dbName":"pacificboard","collection":"users","predicate":{"name":"Alice Updated"}}',
  'request {"action":"find","dbName":"pacificboard","collection":"users","conditions":{"name":"Alice Updated"}}',
  'request {"action":"findOne","dbName":"pacificboard","collection":"users","query":{"name":"Alice Updated"}}',
  'explain users {"name":"Alice Updated"}',
  'quit',
];

let i = 0;
function sendNext() {
  if (i < cmds.length) { proc.stdin.write(cmds[i++] + '\n'); setTimeout(sendNext, 1200); }
}
setTimeout(sendNext, 1500);

await new Promise(r => setTimeout(r, 12000));
console.log(out.slice(0, 8000));
proc.kill();
