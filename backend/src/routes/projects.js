import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/projects?workspaceId=xxx
router.get('/', requireAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const projects = await col('projects').find({ workspaceId }, { limit: 100 });
    const sorted = projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', requireAuth, async (req, res) => {
  try {
    const { workspaceId, name, description = '', color = '#4f9eff' } = req.body;
    if (!workspaceId || !name) return res.status(400).json({ error: 'workspaceId and name required' });

    const project = {
      _id: uuidv4(),
      workspaceId,
      name,
      description,
      color,
      status: 'active',
      createdBy: req.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await col('projects').insertOne(project);
    
    // Log activity
    await col('activity').insertOne({
      _id: uuidv4(),
      workspaceId,
      userId: req.userId,
      action: 'created_project',
      entityType: 'project',
      entityId: project._id,
      entityName: name,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await col('projects').findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { name, description, color, status } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (status !== undefined) updates.status = status;

    await col('projects').updateOne({ _id: req.params.id }, { $set: updates });
    const updated = await col('projects').findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await col('projects').deleteOne({ _id: req.params.id });
    // Also delete all tasks in this project
    const tasks = await col('tasks').find({ projectId: req.params.id });
    for (const t of tasks) {
      await col('tasks').deleteOne({ _id: t._id });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
