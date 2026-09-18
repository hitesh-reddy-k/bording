import net from 'net';
function send(data) {
  return new Promise((resolve) => {
    const s = net.connect(9000, '127.0.0.1');
    s.on('connect', () => { s.write(JSON.stringify(data) + '\n'); });
    let buf = '';
    s.on('data', d => { buf += d.toString(); });
    s.on('end', () => resolve(buf));
    s.on('error', e => resolve('ERR: ' + e.message));
    setTimeout(() => { resolve(buf || 'TIMEOUT'); s.destroy(); }, 5000);
  });
}

// Test different query/filter formats
const formats = [
  { label: 'query field', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', query: { email: 'alice@test.com' } } },
  { label: 'filter field', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', filter: { email: 'alice@test.com' } } },
  { label: 'where field', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', where: { email: 'alice@test.com' } } },
  { label: 'query _id', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', query: { _id: 'u1' } } },
  { label: 'filter _id', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', filter: { _id: 'u1' } } },
  { label: 'no match email', payload: { action: 'find', dbName: 'pacificboard', collection: 'users', query: { email: 'nobody@test.com' } } },
];

for (const { label, payload } of formats) {
  const r = JSON.parse(await send(payload));
  console.log(`${label}: count=${r.count} email=${r.data?.[0]?.email || 'none'}`);
}

// Also test the explain action
const exp = JSON.parse(await send({ action: 'explain', dbName: 'pacificboard', collection: 'users', query: { email: 'alice@test.com' } }));
console.log('explain:', JSON.stringify(exp).slice(0, 300));
