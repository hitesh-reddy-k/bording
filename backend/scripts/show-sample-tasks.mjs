import { col } from '../src/db.js';

async function run() {
  const wsTasks = await col('tasks').find({ workspaceId: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });
  console.log(`\nFound ${wsTasks.length} tasks in Demo Workspace:`);
  wsTasks.forEach((t, i) => {
    console.log(`${i + 1}. Title: "${t.title}"`);
    if (t.description) console.log(`   Desc:  "${t.description}"`);
  });
  process.exit(0);
}

run().catch(console.error);
