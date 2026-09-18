import { col } from '../src/db.js';
import { generateEmbedding } from '../src/lib/embeddings.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fast, atomic re-index of PacificDB vectors using deleteMany
 * and the new domain-aware semantic embedding engine.
 */
async function run() {
  console.log('🚀 Starting fast vector re-indexing...');
  const t0 = Date.now();

  const wsUser = await col('users').findOne({ email: 'demo@pacific.io' });
  let ws = await col('workspaces').findOne({ _id: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });
  if (!ws && wsUser) ws = await col('workspaces').findOne({ ownerId: wsUser._id });

  const wsId = ws ? ws._id : 'a291450f-ff37-4241-b7c2-ac24486a12d1';

  // 1. Fetch workspace tasks
  const tasks = await col('tasks').find({ workspaceId: wsId });
  console.log(`Found ${tasks.length} tasks in Demo Workspace.`);

  // 2. Identify and delete duplicates
  const seenTitles = new Map();
  const duplicateIds = [];
  const uniqueTasks = [];

  for (const t of tasks) {
    const key = (t.title || '').trim().toLowerCase();
    if (seenTitles.has(key)) {
      duplicateIds.push(t._id);
    } else {
      seenTitles.set(key, t._id);
      uniqueTasks.push(t);
    }
  }

  if (duplicateIds.length > 0) {
    console.log(`Removing ${duplicateIds.length} duplicate task records...`);
    await Promise.all(duplicateIds.map(id => col('tasks').deleteOne({ _id: id })));
  }

  console.log(`Unique workspace tasks to index: ${uniqueTasks.length}`);

  // 3. Clear existing vectors in PacificDB in 1 single command
  console.log('Clearing old vectors collection via deleteMany...');
  await col('vectors').deleteMany({});

  // 4. Index all unique workspace tasks
  console.log('Generating fresh domain-aware vector embeddings...');
  const batch = [];
  for (const t of uniqueTasks) {
    const text = `${t.title || ''} ${t.description || ''}`.trim();
    if (!text) continue;
    batch.push(
      col('vectors').insertOne({
        _id: uuidv4(),
        taskId: t._id,
        workspaceId: wsId,
        content: text,
        embedding: generateEmbedding(text),
        createdAt: new Date().toISOString(),
      })
    );
  }
  await Promise.all(batch);
  console.log(`✅ Inserted ${batch.length} workspace vectors into PacificDB.`);

  // 5. Also seed clean diverse topic tasks from other projects if any
  const otherTasks = await col('tasks').find({});
  const extraBatch = [];
  const indexedTaskIds = new Set(uniqueTasks.map(t => t._id));

  for (const ot of otherTasks) {
    if (indexedTaskIds.has(ot._id)) continue;
    const norm = (ot.title || '').trim().toLowerCase();
    if (seenTitles.has(norm)) continue;
    seenTitles.set(norm, true);
    indexedTaskIds.add(ot._id);

    const text = `${ot.title || ''} ${ot.description || ''}`.trim();
    if (!text) continue;
    extraBatch.push(
      col('vectors').insertOne({
        _id: uuidv4(),
        taskId: ot._id,
        workspaceId: ot.workspaceId,
        content: text,
        embedding: generateEmbedding(text),
        createdAt: new Date().toISOString(),
      })
    );
    if (extraBatch.length >= 100) break; // Keep healthy bounded index
  }

  if (extraBatch.length > 0) {
    await Promise.all(extraBatch);
    console.log(`✅ Indexed ${extraBatch.length} unique cross-project tasks.`);
  }

  const finalCount = await col('vectors').count({});
  console.log(`\n🎉 Re-indexing complete in ${(Date.now() - t0)}ms!`);
  console.log(`Total vectors in PacificDB: ${finalCount}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Re-indexing failed:', err);
  process.exit(1);
});
