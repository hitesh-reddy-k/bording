import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/workspaces - list workspaces user belongs to
router.get('/', requireAuth, async (req, res) => {
  try {
    // Find workspaces where user is a member
    const all = await col('workspaces').find({});
    const userWorkspaces = all.filter(ws =>
      ws.members?.some(m => m.userId === req.userId)
    );
    res.json(userWorkspaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces - create workspace
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const wsId = uuidv4();
    const workspace = {
      _id: wsId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + wsId.slice(0, 6),
      ownerId: req.userId,
      members: [{ userId: req.userId, role: 'owner' }],
      createdAt: new Date().toISOString(),
    };

    await col('workspaces').insertOne(workspace);
    res.status(201).json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const ws = await col('workspaces').findOne({ _id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:id/stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const wsId = req.params.id;
    const projects = await col('projects').find({ workspaceId: wsId });
    const ws = await col('workspaces').findOne({ _id: wsId });
    const projectIds = projects.map(p => p._id);

    let taskCount = 0;
    let messageCount = 0;

    // Count tasks across all projects
    for (const pid of projectIds) {
      const c = await col('tasks').count({ projectId: pid });
      taskCount += c;
    }

    messageCount = await col('messages').count({ workspaceId: wsId });

    res.json({
      memberCount: ws?.members?.length || 0,
      projectCount: projects.length,
      taskCount,
      messageCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:id/invite
router.post('/:id/invite', requireAuth, async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    const ws = await col('workspaces').findOne({ _id: req.params.id });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    // Check caller is owner/admin
    const callerMember = ws.members?.find(m => m.userId === req.userId);
    if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Find user by email
    const user = await col('users').findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check already a member
    if (ws.members?.some(m => m.userId === user._id)) {
      return res.status(409).json({ error: 'Already a member' });
    }

    const updatedMembers = [...(ws.members || []), { userId: user._id, role }];
    await col('workspaces').updateOne(
      { _id: req.params.id },
      { $set: { members: updatedMembers } }
    );

    // Create notification for invited user
    await col('notifications').insertOne({
      _id: uuidv4(),
      userId: user._id,
      type: 'workspace_invite',
      data: { workspaceId: req.params.id, workspaceName: ws.name },
      read: false,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, member: { userId: user._id, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:id/activity
router.get('/:id/activity', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await col('activity').find({ workspaceId: req.params.id });
    // Sort by createdAt desc and limit
    const sorted = activities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
