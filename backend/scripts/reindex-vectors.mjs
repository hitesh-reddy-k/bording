import { col } from '../src/db.js';
import { generateEmbedding } from '../src/lib/embeddings.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Re-index PacificDB vectors using the position-independent
 * character-trigram embedding engine (384 dimensions).
 */
async function run() {
  console.log('🔄 Re-indexing PacificDB vector embeddings with new trigram model...');

  const t0 = Date.now();

  // 1. Fetch all existing vectors
  const vectors = await col('vectors').find({});
  console.log(`Found ${vectors.length} existing vectors to upgrade.`);

  // 2. Fetch all workspace tasks so we can map titles and workspaceIds
  const wsUser = await col('users').findOne({ email: 'demo@pacific.io' });
  let ws = await col('workspaces').findOne({ _id: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });
  if (!ws && wsUser) ws = await col('workspaces').findOne({ ownerId: wsUser._id });

  const wsId = ws ? ws._id : 'a291450f-ff37-4241-b7c2-ac24486a12d1';
  const wsTasks = await col('tasks').find({ workspaceId: wsId });
  console.log(`Found ${wsTasks.length} tasks in Demo Workspace (${wsId}).`);

  // Map of existing indexed taskIds
  const indexedTaskIds = new Set();

  // 3. Update existing vectors in batches
  const batchSize = 15;
  let updatedCount = 0;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const chunk = vectors.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (v) => {
        if (v.taskId) indexedTaskIds.add(v.taskId);
        const text = v.content || 'Task item';
        const newEmbedding = generateEmbedding(text);

        await col('vectors').updateOne(
          { _id: v._id },
          {
            embedding: newEmbedding,
            content: text,
            workspaceId: v.workspaceId || wsId,
            updatedAt: new Date().toISOString(),
          }
        );
        updatedCount++;
      })
    );
    if ((i + batchSize) % 150 === 0 || i + batchSize >= vectors.length) {
      console.log(`Upgraded: ${Math.min(i + batchSize, vectors.length)} / ${vectors.length} vectors...`);
    }
  }

  // 4. Ensure all workspace tasks have a vector
  let insertedCount = 0;
  for (const t of wsTasks) {
    if (!indexedTaskIds.has(t._id)) {
      const text = `${t.title || ''} ${t.description || ''}`.trim();
      if (!text) continue;

      await col('vectors').insertOne({
        _id: uuidv4(),
        taskId: t._id,
        workspaceId: wsId,
        content: text,
        embedding: generateEmbedding(text),
        createdAt: new Date().toISOString(),
      });
      indexedTaskIds.add(t._id);
      insertedCount++;
    }
  }

  console.log(`\n🎉 Vector re-indexing complete in ${(Date.now() - t0)}ms!`);
  console.log(`✅ Upgraded ${updatedCount} existing vectors.`);
  console.log(`✅ Added ${insertedCount} missing workspace vectors.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Re-indexing failed:', err);
  process.exit(1);
});
