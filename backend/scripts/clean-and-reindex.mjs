import { col } from '../src/db.js';
import { generateEmbedding } from '../src/lib/embeddings.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Clean up duplicate tasks in the workspace and re-index all PacificDB vectors
 * with the production-grade domain-aware embedding model.
 */
async function run() {
  console.log('🧹 Starting database cleanup and vector re-indexing...');

  const wsUser = await col('users').findOne({ email: 'demo@pacific.io' });
  let ws = await col('workspaces').findOne({ _id: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });
  if (!ws && wsUser) ws = await col('workspaces').findOne({ ownerId: wsUser._id });

  const wsId = ws ? ws._id : 'a291450f-ff37-4241-b7c2-ac24486a12d1';
  console.log(`Target Workspace: "${ws?.name}" (${wsId})`);

  // 1. Fetch all tasks in this workspace
  const tasks = await col('tasks').find({ workspaceId: wsId });
  console.log(`Found ${tasks.length} tasks in workspace.`);

  // 2. Identify duplicate tasks by normalized title
  const seenTitles = new Map();
  const duplicateTaskIds = [];
  const uniqueTasks = [];

  for (const t of tasks) {
    const key = (t.title || '').trim().toLowerCase();
    if (seenTitles.has(key)) {
      duplicateTaskIds.push(t._id);
    } else {
      seenTitles.set(key, t._id);
      uniqueTasks.push(t);
    }
  }

  console.log(`Unique tasks to keep: ${uniqueTasks.length}`);
  console.log(`Duplicate task records to delete: ${duplicateTaskIds.length}`);

  // 3. Delete duplicate tasks and their vectors
  for (const dupId of duplicateTaskIds) {
    await col('tasks').deleteOne({ _id: dupId });
    await col('vectors').deleteOne({ taskId: dupId });
  }

  // 4. Clean up any existing vectors for this workspace to prevent orphans
  const existingVectors = await col('vectors').find({ workspaceId: wsId });
  for (const v of existingVectors) {
    await col('vectors').deleteOne({ _id: v._id });
  }
  console.log(`Cleaned up old workspace vectors.`);

  // 5. Insert clean, fresh vector embeddings for all unique workspace tasks
  console.log(`Embedding ${uniqueTasks.length} unique workspace tasks...`);
  for (const t of uniqueTasks) {
    const text = `${t.title || ''} ${t.description || ''}`.trim();
    const vec = generateEmbedding(text);
    await col('vectors').insertOne({
      _id: uuidv4(),
      taskId: t._id,
      workspaceId: wsId,
      content: text,
      embedding: vec,
      createdAt: new Date().toISOString(),
    });
  }

  // 6. Also update remaining synthetic vectors from other workspaces if any
  const remainingVectors = await col('vectors').find({});
  console.log(`Updating remaining ${remainingVectors.length} total vectors in PacificDB...`);
  const batchSize = 15;
  for (let i = 0; i < remainingVectors.length; i += batchSize) {
    const chunk = remainingVectors.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(v => {
        const text = v.content || 'Task';
        return col('vectors').updateOne(
          { _id: v._id },
          { embedding: generateEmbedding(text), updatedAt: new Date().toISOString() }
        );
      })
    );
  }

  console.log(`\n🎉 Cleanup and re-indexing successfully completed!`);
  console.log(`Unique tasks in workspace: ${uniqueTasks.length}`);
  const finalVectorCount = await col('vectors').count({});
  console.log(`Total vectors in PacificDB: ${finalVectorCount}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
