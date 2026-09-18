import express from 'express';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateSimpleEmbedding } from './tasks.js';

const router = express.Router();

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
import { generateEmbedding, cosineSimilarity } from '../lib/embeddings.js';

router.get('/semantic', requireAuth, async (req, res) => {
  try {
    const { q, workspaceId, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    // 1. Generate query embedding via domain-aware semantic model
    const queryEmbedding = generateEmbedding(q);

    // 2. Fetch all indexed vectors from PacificDB
    const vectors = await col('vectors').find({});
    const totalIndexed = vectors.length;

    if (totalIndexed === 0) {
      return res.json({ query: q, vectors_searched: 0, totalVectors: 0, results: [] });
    }

    // 3. Pre-fetch workspace tasks for instant O(1) task resolution
    const taskMap = new Map();
    const wsTaskIds = new Set();
    if (workspaceId) {
      const wsTasks = await col('tasks').find({ workspaceId });
      for (const t of wsTasks) {
        taskMap.set(t._id, t);
        wsTaskIds.add(t._id);
      }
    }

    // 4. Compute cosine similarity for all vectors
    const scored = [];
    for (const vec of vectors) {
      if (!vec.embedding || vec.embedding.length !== 384) continue;
      let score = cosineSimilarity(queryEmbedding, vec.embedding);

      // Workspace boost: slightly prioritize active workspace items if they have semantic overlap
      if (score > 0.10 && (wsTaskIds.has(vec.taskId) || vec.workspaceId === workspaceId)) {
        score = Math.min(1.0, score * 1.08);
      }

      scored.push({
        ...vec,
        score,
        isWorkspaceTask: wsTaskIds.has(vec.taskId) || vec.workspaceId === workspaceId,
      });
    }

    // 5. Sort candidates DESC by similarity score
    scored.sort((a, b) => b.score - a.score);

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
