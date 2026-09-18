import net from 'net';

async function test() {
  const actions = ['delete', 'remove', 'del', 'deleteOne', 'delete_one'];
  for (const a of actions) {
    await new Promise(res => {
      const s = net.connect(9000, '127.0.0.1', () => {
        s.write(JSON.stringify({ dbName: 'pacificboard', collection: 'tasks', action: a, filter: { _id: 'test' } }) + '\n');
      });
      s.on('data', d => {
        console.log(`Action "${a}":`, d.toString().trim());
        s.destroy();
        res();
      });
      s.on('error', () => { s.destroy(); res(); });
    });
  }
}

test();
