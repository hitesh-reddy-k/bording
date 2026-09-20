import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { col } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/files?workspaceId=xxx
router.get('/', requireAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const files = await col('files').find({ workspaceId });
    // Do not send the PacificDB-stored base64 payload with every listing request.
    // Media is loaded only when a user previews it.
    const sorted = files
      .map(({ dataUrl, ...metadata }) => ({
        ...metadata,
        url: `/api/files/${metadata._id}/download`,
        previewUrl: `/api/files/${metadata._id}/preview`,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/upload - upload file (stores metadata in PacificDB, data as base64)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { workspaceId, taskId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const fileId = uuidv4();
    const base64Data = req.file.buffer.toString('base64');

    const fileRecord = {
      _id: fileId,
      workspaceId,
      taskId: taskId || null,
      uploaderId: req.userId,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      // Store small files as base64 data URL, reference for larger ones
      dataUrl: `data:${req.file.mimetype};base64,${base64Data}`,
      createdAt: new Date().toISOString(),
    };

    await col('files').insertOne(fileRecord);

    // If task attached, update task attachments
    if (taskId) {
      const task = await col('tasks').findOne({ _id: taskId });
      if (task) {
        const attachmentIds = [...(task.attachmentIds || []), fileId];
        await col('tasks').updateOne({ _id: taskId }, { $set: { attachmentIds, updatedAt: new Date().toISOString() } });
      }
    }

    const { dataUrl, ...safeRecord } = fileRecord;
    res.status(201).json({ ...safeRecord, url: `/api/files/${fileId}/download` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const file = await col('files').findOne({ _id: req.params.id });
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.dataUrl) {
      const [header, data] = file.dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const buffer = Buffer.from(data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'File data not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id/preview  
router.get('/:id/preview', requireAuth, async (req, res) => {
  try {
    const file = await col('files').findOne({ _id: req.params.id });
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json(file.dataUrl ? { url: file.dataUrl, name: file.name, mimeType: file.mimeType } : { error: 'No preview' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const file = await col('files').findOne({ _id: req.params.id });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploaderId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await col('files').deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
