import { col } from '../src/db.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

import { generateEmbedding as generateSimpleEmbedding } from '../src/lib/embeddings.js';

async function run() {
  console.log('🚀 Starting automated PacificDB full database seeder...');

  // 1. Ensure Demo User exists
  let demoUser = await col('users').findOne({ email: 'demo@pacific.io' });
  if (!demoUser) {
    const userId = uuidv4();
    const hash = await bcrypt.hash('password123', 10);
    demoUser = {
      _id: userId,
      email: 'demo@pacific.io',
      name: 'Demo User',
      passwordHash: hash,
      role: 'admin',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=DemoUser`,
      createdAt: new Date().toISOString(),
    };
    await col('users').insertOne(demoUser);
    console.log('✅ Created Demo User: demo@pacific.io / password123');
  } else {
    console.log(`ℹ️  Found existing Demo User (${demoUser.email})`);
  }

  // 2. Ensure Workspace exists
  let ws = await col('workspaces').findOne({ ownerId: demoUser._id });
  if (!ws) {
    const wsId = uuidv4();
    ws = {
      _id: wsId,
      name: "Demo User's Workspace",
      slug: 'demo-workspace',
      ownerId: demoUser._id,
      members: [
        { userId: demoUser._id, role: 'owner' },
        { userId: 'team-alice-chen', role: 'admin' },
        { userId: 'team-bob-miller', role: 'member' },
        { userId: 'team-carol-white', role: 'member' },
      ],
      createdAt: new Date().toISOString(),
    };
    await col('workspaces').insertOne(ws);
    console.log(`✅ Created Workspace: "${ws.name}"`);
  } else {
    console.log(`ℹ️  Using Workspace: "${ws.name}" (${ws._id})`);
  }

  // 3. Ensure Projects exist
  const defaultProjects = [
    { name: 'PacificBoard Dev', description: 'Core full-stack web application powered by PacificDB', color: 'hsl(190, 85%, 45%)' },
    { name: 'Distributed Engine', description: 'Raft consensus, WAL engine, and NDJSON streaming', color: 'hsl(280, 85%, 55%)' },
    { name: 'Mobile App', description: 'React Native companion app for iOS & Android', color: 'hsl(145, 75%, 42%)' },
  ];

  let projects = await col('projects').find({ workspaceId: ws._id });
  if (projects.length === 0) {
    for (const dp of defaultProjects) {
      const pid = uuidv4();
      const pDoc = {
        _id: pid,
        workspaceId: ws._id,
        name: dp.name,
        description: dp.description,
        color: dp.color,
        status: 'active',
        createdBy: demoUser._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await col('projects').insertOne(pDoc);
      projects.push(pDoc);
    }
    console.log(`✅ Created ${projects.length} default projects.`);
  }

  const primaryProject = projects[0];

  // 4. Seed Tasks with Vector Embeddings
  const sampleTasks = [
    {
      title: 'Implement PacificDB Raft consensus monitoring',
      description: 'Track leader terms, commit indices, and follower replication lag in real time.',
      status: 'in_progress',
      priority: 'urgent',
      labels: ['backend', 'raft', 'database'],
    },
    {
      title: 'Design real-time task drag-and-drop Kanban board',
      description: 'Smooth glassmorphism card animations with optimistic UI updates.',
      status: 'done',
      priority: 'high',
      labels: ['frontend', 'ui', 'kanban'],
    },
    {
      title: 'Optimize NDJSON TCP stream socket recycling',
      description: 'Prevent socket exhaustion by eagerly tearing down connections after delimiter.',
      status: 'done',
      priority: 'high',
      labels: ['performance', 'tcp', 'network'],
    },
    {
      title: 'Add semantic vector similarity task search',
      description: 'Store embeddings in PacificDB vectors collection and enable cosine search.',
      status: 'in_progress',
      priority: 'high',
      labels: ['ai', 'vectors', 'search'],
    },
    {
      title: 'Implement workspace role-based access control (RBAC)',
      description: 'Owner, Admin, and Member permission enforcement on all project operations.',
      status: 'todo',
      priority: 'medium',
      labels: ['auth', 'rbac', 'security'],
    },
    {
      title: 'Build distributed Chaos Engineering simulator',
      description: 'Simulate replica crashes, network partitions, and verify automatic failover.',
      status: 'review',
      priority: 'high',
      labels: ['chaos', 'testing', 'devops'],
    },
    {
      title: 'Add live collaborative team chat with media uploads',
      description: 'Support channel discussions, image attachments, and instant notifications.',
      status: 'todo',
      priority: 'medium',
      labels: ['chat', 'media', 'realtime'],
    },
    {
      title: 'Configure automated backup snapshots and point-in-time restore',
      description: 'Verify CRC32 checksums and physical SST table recovery.',
      status: 'todo',
      priority: 'medium',
      labels: ['backup', 'reliability'],
    },
    {
      title: 'Dark mode theme customization and keyboard shortcuts',
      description: 'Add quick navigation shortcuts: Cmd/Ctrl+K search, Cmd+Enter create task.',
      status: 'backlog',
      priority: 'low',
      labels: ['frontend', 'ux'],
    },
    {
      title: 'Fix payment webhook retries on stripe signature failure',
      description: 'Handle idempotent events when processing incoming subscription renewals.',
      status: 'in_progress',
      priority: 'urgent',
      labels: ['billing', 'bugs', 'stripe'],
    },
    {
      title: 'Audit query performance and secondary index usage',
      description: 'Explain find queries and verify index scans vs table scans.',
      status: 'review',
      priority: 'high',
      labels: ['indexes', 'performance'],
    },
    {
      title: 'Create PacificBoard onboarding interactive walkthrough',
      description: 'Guide new team members through workspace creation and board views.',
      status: 'backlog',
      priority: 'low',
      labels: ['onboarding', 'docs'],
    },
  ];

  const existingTasks = await col('tasks').find({ projectId: primaryProject._id });

  if (existingTasks.length < 5) {
    const taskDocs = [];
    const vectorDocs = [];
    for (const t of sampleTasks) {
      const taskId = uuidv4();
      taskDocs.push({
        _id: taskId,
        projectId: primaryProject._id,
        workspaceId: ws._id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeIds: [demoUser._id],
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        labels: t.labels,
        attachmentIds: [],
        createdBy: demoUser._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      vectorDocs.push({
        _id: uuidv4(),
        workspaceId: ws._id,
        taskId: taskId,
        content: `${t.title} ${t.description}`,
        embedding: generateSimpleEmbedding(`${t.title} ${t.description}`),
        createdAt: new Date().toISOString(),
      });
    }
    await col('tasks').insertMany(taskDocs);
    await col('vectors').insertMany(vectorDocs);
    console.log(`✅ Seeded ${taskDocs.length} tasks with vector embeddings into "${primaryProject.name}"`);
  } else {
    console.log(`ℹ️  Found ${existingTasks.length} existing tasks in "${primaryProject.name}"`);
  }

  // 5. Seed Chat Messages
  const existingMsgs = await col('messages').find({ workspaceId: ws._id });
  if (existingMsgs.length < 5) {
    const chatSamples = [
      { ch: 'general', authorId: 'team-alice-chen', authorName: 'Alice Chen', text: 'Welcome to PacificBoard! Powered natively by PacificDB Community Edition 🚀' },
      { ch: 'general', authorId: 'team-bob-miller', authorName: 'Bob Miller', text: 'Hey Alice! Raft 3-node cluster and consensus monitoring are looking great.' },
      { ch: 'general', authorId: 'team-carol-white', authorName: 'Carol White', text: 'Love the dark glassmorphic UI and snappy Kanban board!' },
      { ch: 'dev', authorId: 'team-bob-miller', authorName: 'Bob Miller', text: 'TCP socket recycling is working flawlessly now. P99 latency is sub-5ms.' },
      { ch: 'dev', authorId: 'team-alice-chen', authorName: 'Alice Chen', text: 'Semantic vector search cosine calculations are returning in under 20ms.' },
      { ch: 'design', authorId: 'team-carol-white', authorName: 'Carol White', text: 'Updated the theme tokens in index.css with sleek cyan gradients.' },
      { ch: 'random', authorId: 'team-bob-miller', authorName: 'Bob Miller', text: 'Why do programmers prefer dark mode? Because light attracts bugs! 🐛' },
    ];

    const messageDocs = chatSamples.map(cm => ({
      _id: uuidv4(),
      workspaceId: ws._id,
      channelId: cm.ch,
      authorId: cm.authorId,
      authorName: cm.authorName,
      content: cm.text,
      createdAt: new Date().toISOString(),
    }));

    await col('messages').insertMany(messageDocs);
    console.log(`✅ Seeded ${messageDocs.length} chat messages across #general, #dev, #design, #random`);
  } else {
    console.log(`ℹ️  Found ${existingMsgs.length} existing chat messages in workspace`);
  }

  console.log('\n🎉 Automatic database seeding complete! All data stored directly in PacificDB.');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
