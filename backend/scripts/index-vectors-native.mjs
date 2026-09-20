import { col, connectDB } from '../src/db.js';

const PAGE_SIZE = 1000;
const NATIVE_COLLECTION = 'vectors_native';

await connectDB();

let indexed = 0;
let skipped = 0;
const sourceCount = await col('vectors').count({});
console.log(`Source vector documents: ${sourceCount.toLocaleString()}`);
const taskCount = await col('tasks').count({});
const taskWorkspace = new Map();
for (let skip = 0; skip < taskCount; skip += PAGE_SIZE) {
  const tasks = await col('tasks').find({}, { limit: PAGE_SIZE, skip });
  for (const task of tasks) {
    if (task._id && task.workspaceId) taskWorkspace.set(task._id, task.workspaceId);
  }
}
console.log(`Loaded workspace metadata for ${taskWorkspace.size.toLocaleString()} tasks.`);

for (let skip = 0; skip < sourceCount; skip += PAGE_SIZE) {
  const vectors = await col('vectors').find({}, { limit: PAGE_SIZE, skip });
  if (vectors.length === 0) break;

  const nativeDocs = [];
  for (const vectorDoc of vectors) {
    const id = vectorDoc._id || vectorDoc.id;
    const vector = vectorDoc.embedding || vectorDoc.vector;
    if (!id || !Array.isArray(vector) || vector.length !== 384) {
      skipped++;
      continue;
    }
    nativeDocs.push({
      _id: `native:${id}`,
      id,
      kind: 'vector',
      vector,
      taskId: vectorDoc.taskId,
      workspaceId: vectorDoc.workspaceId || taskWorkspace.get(vectorDoc.taskId),
      content: vectorDoc.content || '',
    });
  }

  if (nativeDocs.length > 0) {
    await col(NATIVE_COLLECTION).insertMany(nativeDocs);
    indexed += nativeDocs.length;
  }

  console.log(`Indexed ${indexed.toLocaleString()} vectors (skipped ${skipped})...`);
}

console.log(`Native vector indexing complete in ${NATIVE_COLLECTION}: ${indexed.toLocaleString()} indexed, ${skipped} skipped.`);
