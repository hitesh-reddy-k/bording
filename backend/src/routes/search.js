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
// Vector similarity search for tasks powered by PacificDB vectors
import { generateEmbedding, cosineSimilarity } from '../lib/embeddings.js';

router.get('/semantic', requireAuth, async (req, res) => {
  try {
    const { q, workspaceId, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    // Generate query embedding via position-independent character-trigram model
    const queryEmbedding = generateEmbedding(q);

    // Fetch all indexed vectors from PacificDB
    const vectors = await col('vectors').find({});
    const totalIndexed = vectors.length;

    if (totalIndexed === 0) {
      return res.json({ query: q, results: [], totalVectors: 0 });
    }

    // Optional workspace task pre-fetching for instant task resolution
    const taskMap = new Map();
    const wsTaskIds = new Set();
    if (workspaceId) {
      const wsTasks = await col('tasks').find({ workspaceId });
      for (const t of wsTasks) {
        taskMap.set(t._id, t);
        wsTaskIds.add(t._id);
      }
    }

    // Compute cosine similarity for every vector document
    const scored = [];
    for (const vec of vectors) {
      if (!vec.embedding || vec.embedding.length !== 384) continue;
      let score = cosineSimilarity(queryEmbedding, vec.embedding);

      // Boost score if vector belongs to the active workspace
      if (wsTaskIds.has(vec.taskId) || vec.workspaceId === workspaceId) {
        score = Math.min(1.0, score * 1.15);
      }

      if (score > 0.04) {
        scored.push({
          ...vec,
          score,
          isWorkspaceTask: wsTaskIds.has(vec.taskId) || vec.workspaceId === workspaceId,
        });
      }
    }

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);
    const topVectors = scored.slice(0, parseInt(limit, 10) || 10);

    // Fetch tasks that are not yet in taskMap in parallel
    const missingTaskIds = topVectors
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

    // Assemble final rich result objects
    const results = [];
    for (const v of topVectors) {
      const task = taskMap.get(v.taskId);
      if (task) {
        results.push({
          ...task,
          _type: 'task',
          _score: v.score,
          _content: v.content || task.title,
        });
      } else if (v.content) {
        results.push({
          _id: v.taskId || v._id,
          title: v.content,
          description: `Semantic match (${(v.score * 100).toFixed(1)}% similarity)`,
          status: 'todo',
          priority: 'medium',
          _score: v.score,
          _content: v.content,
          _type: 'task',
        });
      }
    }

    res.json({ query: q, results, totalVectors: totalIndexed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
