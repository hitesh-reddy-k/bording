import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/chat/channels?workspaceId=xxx
router.get('/channels', requireAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    // Return built-in channels
    const channels = [
      { id: 'general', name: 'general', workspaceId, type: 'public' },
      { id: 'random', name: 'random', workspaceId, type: 'public' },
      { id: 'dev', name: 'dev', workspaceId, type: 'public' },
      { id: 'design', name: 'design', workspaceId, type: 'public' },
    ];
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/messages?workspaceId=xxx&channelId=xxx&limit=50&before=timestamp
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const { workspaceId, channelId = 'general', limit = 50, before } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const messageLimit = Math.min(100, parseInt(limit, 10) || 50);
    let messages = await col('messages').find({ workspaceId, channelId }, { limit: messageLimit });

    // Filter by before timestamp for pagination
    if (before) {
      messages = messages.filter(m => new Date(m.createdAt) < new Date(before));
    }

    // Sort by createdAt
    messages = messages
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/messages
router.post('/messages', requireAuth, async (req, res) => {
  try {
    const { workspaceId, channelId = 'general', content } = req.body;
    if (!workspaceId || !content) {
      return res.status(400).json({ error: 'workspaceId and content required' });
    }

    const message = {
      _id: uuidv4(),
      workspaceId,
      channelId,
      authorId: req.userId,
      content,
      createdAt: new Date().toISOString(),
    };

    await col('messages').insertOne(message);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/messages/:id
router.delete('/messages/:id', requireAuth, async (req, res) => {
  try {
    const msg = await col('messages').findOne({ _id: req.params.id });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.authorId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    
    await col('messages').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/messages/count?workspaceId=xxx  (for admin stats)
router.get('/count', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const filter = workspaceId ? { workspaceId } : {};
    const messages = await col('messages').find(filter);
    res.json({ count: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
