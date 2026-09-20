import express from 'express';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateSimpleEmbedding } from './tasks.js';

const router = express.Router();
const NATIVE_VECTOR_COLLECTION = 'vectors_native';
let cachedVectorCount = 0;
let cachedVectorCountAt = 0;

async function getVectorCount() {
  const now = Date.now();
  if (now - cachedVectorCountAt > 60000) {
    cachedVectorCount = await col('vectors').count({});
    cachedVectorCountAt = now;
  }
  return cachedVectorCount;
}

// GET /api/search?q=query&workspaceId=xxx&type=all|tasks|projects|comments
router.get('/', requireAuth, async (req, res) => {
  try {
    const { q, workspaceId, type = 'all' } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    const query = q.toLowerCase();
    const results = { tasks: [], projects: [], comments: [] };

    if (type === 'all' || type === 'tasks') {
      const tasks = workspaceId
        ? await col('tasks').find({ workspaceId })
        : await col('tasks').find({});
      results.tasks = tasks
        .filter(t => t.title?.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query))
        .slice(0, 20)
        .map(t => ({ ...t, _type: 'task' }));
    }

    if (type === 'all' || type === 'projects') {
      const projects = workspaceId
        ? await col('projects').find({ workspaceId })
        : await col('projects').find({});
      results.projects = projects
        .filter(p => p.name?.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query))
        .slice(0, 20)
        .map(p => ({ ...p, _type: 'project' }));
    }

    if (type === 'all' || type === 'comments') {
      const comments = await col('comments').find({});
      results.comments = comments
        .filter(c => c.content?.toLowerCase().includes(query))
        .slice(0, 20)
        .map(c => ({ ...c, _type: 'comment' }));
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/semantic?q=query&workspaceId=xxx&limit=10
// Production-grade Vector similarity search powered by PacificDB vectors
import { generateEmbedding } from '../lib/embeddings.js';

router.get('/semantic', requireAuth, async (req, res) => {
  try {
    const { q, workspaceId, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    // 1. Generate query embedding via domain-aware semantic model
    const queryEmbedding = generateEmbedding(q);

    // 2. Query PacificDB's native vector index. The index stores vectors using
    // the engine's insertVector/queryVector protocol, so the API does not need
    // to transfer or score the full collection in Node.js.
    const nativeResults = await col(NATIVE_VECTOR_COLLECTION).queryVector(queryEmbedding, {
      k: Math.min(100, maxResults * 10),
      metric: 'cosine',
      // Keep the original behavior: search globally, then resolve/boost the
      // active workspace when task metadata is available. Older vector records
      // may not carry workspaceId in the native metadata.
      filter: {},
    });
    // Native vector records are stored in an engine-managed index and are not
    // included reliably by ordinary collection count; report source coverage.
    const totalIndexed = await getVectorCount();

    if (nativeResults.length === 0) {
      return res.json({ query: q, vectors_searched: totalIndexed, totalVectors: totalIndexed, results: [] });
    }

    // 3. Resolve only the returned task IDs. Full task documents are never
    // loaded for the entire workspace.
    const taskMap = new Map();
    const scored = nativeResults.map(vec => ({
      _id: vec._id || vec.id,
      taskId: vec.taskId,
      workspaceId: vec.workspaceId,
      content: vec.content,
      score: Math.max(0, Math.min(1, Number(vec.score) || 0)),
    }));

    // 4. Native results are already sorted by similarity.

    // 6. Deduplicate by taskId and normalized task title
    const seenTaskIds = new Set();
    const seenTitles = new Set();
    const uniqueCandidates = [];

    // Relevance threshold: drop non-semantic noise (< 0.15)
    for (const cand of scored) {
      if (cand.score < 0.15) break;

      // Extract title/content to deduplicate duplicate seed runs
      const normalizedTitle = (cand.content || '').trim().toLowerCase();
      if (cand.taskId && seenTaskIds.has(cand.taskId)) continue;
      if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;

      if (cand.taskId) seenTaskIds.add(cand.taskId);
      if (normalizedTitle) seenTitles.add(normalizedTitle);

      uniqueCandidates.push(cand);
      if (uniqueCandidates.length >= maxResults) break;
    }

    // 7. Parallel fetch missing tasks not in workspace map
    const missingTaskIds = uniqueCandidates
      .map(v => v.taskId)
      .filter(id => id && !taskMap.has(id));

    if (missingTaskIds.length > 0) {
      const fetchedTasks = await Promise.all(
        missingTaskIds.slice(0, 15).map(id => col('tasks').findOne({ _id: id }).catch(() => null))
      );
      for (const t of fetchedTasks) {
        if (t) taskMap.set(t._id, t);
      }
    }

    // 8. Assemble structured result objects with clean similarity metric
    const results = uniqueCandidates.map(v => {
      const task = taskMap.get(v.taskId);
      const title = task?.title || v.content || 'Untitled Task';
      const description = task?.description || '';
      const sim = Number(v.score.toFixed(3));

      return {
        id: task?._id || v.taskId || v._id,
        _id: task?._id || v.taskId || v._id,
        title,
        description,
        similarity: sim,
        _score: sim,
        priority: task?.priority || 'medium',
        status: task?.status || 'todo',
        projectId: task?.projectId,
        workspaceId: task?.workspaceId || v.workspaceId,
        labels: task?.labels || [],
        _type: 'task',
      };
    });

    res.json({
      query: q,
      vectors_searched: totalIndexed,
      totalVectors: totalIndexed,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
