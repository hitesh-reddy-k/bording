import { col } from '../src/db.js';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const ws = await col('workspaces').findOne({ _id: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });
  const p = await col('projects').findOne({ _id: '47273cf4-5146-428a-a4f1-742e5b5a017f' });
  const user = await col('users').findOne({ email: 'demo@pacific.io' });

  if (!ws || !p || !user) {
    console.error('Missing workspace, project, or user:', { ws: !!ws, p: !!p, user: !!user });
    process.exit(1);
  }

  console.log('Target WS:', ws.name, '| Project:', p.name, '| User:', user.name);

  // 1. Add Demo User to Bot Test Workspace so they can see it in workspace switcher
  const botWs = await col('workspaces').findOne({ slug: 'bot-workspace' });
  if (botWs) {
    const hasMember = botWs.members?.some(m => m.userId === user._id);
    if (!hasMember) {
      const updatedMembers = [...(botWs.members || []), { userId: user._id, role: 'admin' }];
      await col('workspaces').updateOne({ _id: botWs._id }, { members: updatedMembers });
      console.log('Added Demo User to Bot Test Workspace!');
    }
  }

  // 2. Add realistic tasks to PacificBoard Dev project
  const tasksToSeed = [
    {
      title: 'Implement PacificDB Raft consensus monitoring',
      description: 'Track leader terms, commit indices, and follower replication lag in real time.',
      status: 'in_progress',
      priority: 'urgent',
      labels: ['backend', 'raft', 'database'],
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    },
    {
      title: 'Design real-time task drag-and-drop Kanban board',
      description: 'Smooth glassmorphism card animations with optimistic UI updates.',
      status: 'done',
      priority: 'high',
      labels: ['frontend', 'ui', 'kanban'],
      dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    },
    {
      title: 'Optimize NDJSON TCP stream socket recycling',
      description: 'Prevent socket exhaustion by eagerly tearing down connections after delimiter.',
      status: 'done',
      priority: 'high',
      labels: ['performance', 'tcp', 'network'],
      dueDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    },
    {
      title: 'Add semantic vector similarity task search',
      description: 'Store embeddings in PacificDB vectors collection and enable cosine search.',
      status: 'in_progress',
      priority: 'high',
      labels: ['ai', 'vectors', 'search'],
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    },
    {
      title: 'Implement workspace role-based access control (RBAC)',
      description: 'Owner, Admin, and Member permission enforcement on all project operations.',
      status: 'todo',
      priority: 'medium',
      labels: ['auth', 'rbac', 'security'],
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    },
    {
      title: 'Build distributed Chaos Engineering simulator',
      description: 'Simulate replica crashes, network partitions, and verify automatic failover.',
      status: 'review',
      priority: 'high',
      labels: ['chaos', 'testing', 'devops'],
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    },
    {
      title: 'Add live collaborative team chat with media uploads',
      description: 'Support channel discussions, image attachments, and instant notifications.',
      status: 'todo',
      priority: 'medium',
      labels: ['chat', 'media', 'realtime'],
      dueDate: new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10),
    },
    {
      title: 'Configure automated backup snapshots and point-in-time restore',
      description: 'Verify CRC32 checksums and physical SST table recovery.',
      status: 'todo',
      priority: 'medium',
      labels: ['backup', 'reliability'],
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    },
    {
      title: 'Dark mode theme customization and keyboard shortcuts',
      description: 'Add quick navigation shortcuts: Cmd/Ctrl+K search, Cmd+Enter create task.',
      status: 'backlog',
      priority: 'low',
      labels: ['frontend', 'ux'],
      dueDate: null,
    },
    {
      title: 'Implement webhook notifications for Slack/Discord',
      description: 'Send task assignment and status updates to external webhook endpoints.',
      status: 'backlog',
      priority: 'low',
      labels: ['integrations', 'notifications'],
      dueDate: null,
    },
    {
      title: 'Audit query performance and secondary index usage',
      description: 'Explain find queries and verify index scans vs table scans.',
      status: 'review',
      priority: 'high',
      labels: ['indexes', 'performance'],
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
    },
    {
      title: 'Create PacificBoard onboarding interactive walkthrough',
      description: 'Guide new team members through workspace creation and board views.',
      status: 'backlog',
      priority: 'low',
      labels: ['onboarding', 'docs'],
      dueDate: null,
    },
  ];

  for (const t of tasksToSeed) {
    const taskId = uuidv4();
    await col('tasks').insertOne({
      _id: taskId,
      projectId: p._id,
      workspaceId: ws._id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeIds: [user._id],
      dueDate: t.dueDate,
      labels: t.labels,
      attachmentIds: [],
      createdBy: user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`Successfully seeded ${tasksToSeed.length} tasks into PacificBoard Dev!`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
