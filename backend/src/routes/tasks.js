import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];

// GET /api/tasks/count
router.get('/count', requireAuth, async (req, res) => {
  try {
    const { projectId, workspaceId, status } = req.query;
    let filter = {};
    if (projectId) filter.projectId = projectId;
    if (workspaceId) filter.workspaceId = workspaceId;
    if (status) filter.status = status;
    const total = await col('tasks').count(filter);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks?projectId=xxx&status=xxx&assigneeId=xxx
router.get('/', requireAuth, async (req, res) => {
  try {
    const { projectId, workspaceId, status, priority, assigneeId } = req.query;
    let filter = {};
    if (projectId) filter.projectId = projectId;
    if (workspaceId) filter.workspaceId = workspaceId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const taskLimit = Math.min(500, parseInt(req.query.limit, 10) || 150);
    const [rawTasks, totalCount] = await Promise.all([
      col('tasks').find(filter, { limit: taskLimit }),
      col('tasks').count(filter),
    ]);

    let tasks = rawTasks;
    if (assigneeId) {
      tasks = tasks.filter(t => t.assigneeIds?.includes(assigneeId));
    }

    // Sort by createdAt desc by default, due-date if requested
    const sortBy = req.query.sortBy || 'createdAt';
    if (sortBy === 'dueDate') {
      tasks = tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else {
      tasks = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.setHeader('X-Total-Count', totalCount);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', requireAuth, async (req, res) => {
  try {
    const { projectId, workspaceId, title, description = '', priority = 'medium', status = 'todo', assigneeIds = [], dueDate = null, labels = [] } = req.body;
    if (!projectId || !workspaceId || !title) {
      return res.status(400).json({ error: 'projectId, workspaceId, title required' });
    }

    const task = {
      _id: uuidv4(),
      projectId,
      workspaceId,
      title,
      description,
      priority,
      status,
      assigneeIds,
      dueDate,
      labels,
      attachmentIds: [],
      createdBy: req.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await col('tasks').insertOne(task);

    // Store vector embedding (simple text embedding simulation)
    const embedding = generateSimpleEmbedding(title + ' ' + description);
    await col('vectors').insertOne({
      _id: uuidv4(),
      taskId: task._id,
      embedding,
      content: title + ' ' + description,
      createdAt: new Date().toISOString(),
    });

    // Log activity
    await col('activity').insertOne({
      _id: uuidv4(),
      workspaceId,
      userId: req.userId,
      action: 'created_task',
      entityType: 'task',
      entityId: task._id,
      entityName: title,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await col('tasks').findOne({ _id: req.params.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { title, description, priority, status, assigneeIds, dueDate, labels } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = status;
    }
    if (assigneeIds !== undefined) updates.assigneeIds = assigneeIds;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (labels !== undefined) updates.labels = labels;

    await col('tasks').updateOne({ _id: req.params.id }, { $set: updates });
    
    const updated = await col('tasks').findOne({ _id: req.params.id });

    // Update vector if title/description changed
    if (title !== undefined || description !== undefined) {
      const newContent = (updated.title || '') + ' ' + (updated.description || '');
      const embedding = generateSimpleEmbedding(newContent);
      const existing = await col('vectors').findOne({ taskId: req.params.id });
      if (existing) {
        await col('vectors').updateOne({ taskId: req.params.id }, { $set: { embedding, content: newContent } });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await col('tasks').deleteOne({ _id: req.params.id });
    await col('comments').find({ taskId: req.params.id }).then(comments => 
      Promise.all(comments.map(c => col('comments').deleteOne({ _id: c._id })))
    );
    await col('vectors').find({ taskId: req.params.id }).then(vecs =>
      Promise.all(vecs.map(v => col('vectors').deleteOne({ _id: v._id })))
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const comments = await col('comments').find({ taskId: req.params.id });
    const sorted = comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const task = await col('tasks').findOne({ _id: req.params.id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = {
      _id: uuidv4(),
      taskId: req.params.id,
      authorId: req.userId,
      content,
      createdAt: new Date().toISOString(),
    };

    await col('comments').insertOne(comment);

    // Notify task assignees
    for (const assigneeId of (task.assigneeIds || [])) {
      if (assigneeId !== req.userId) {
        await col('notifications').insertOne({
          _id: uuidv4(),
          userId: assigneeId,
          type: 'new_comment',
          data: { taskId: req.params.id, taskTitle: task.title },
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import { generateEmbedding, generateSimpleEmbedding } from '../lib/embeddings.js';

export { generateEmbedding, generateSimpleEmbedding };
export default router;
