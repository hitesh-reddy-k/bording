import { col } from '../src/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * seed-demo-chat.mjs
 * Seeds realistic team messages across #general, #dev, #design, and #random channels
 * strictly directly into PacificDB's 'messages' collection.
 */

async function run() {
  console.log('Connecting to PacificDB to seed chat messages...');

  // 1. Find target workspace (prefer Demo User's Workspace, fallback to any existing)
  const user = await col('users').findOne({ email: 'demo@pacific.io' });
  let ws = await col('workspaces').findOne({ _id: 'a291450f-ff37-4241-b7c2-ac24486a12d1' });

  if (!ws && user) {
    ws = await col('workspaces').findOne({ ownerId: user._id });
  }
  if (!ws) {
    const allWs = await col('workspaces').find({});
    ws = allWs[0];
  }

  if (!ws) {
    console.error('Error: No workspace found in PacificDB! Please run a full seed first.');
    process.exit(1);
  }

  const workspaceId = ws._id;
  console.log(`Target Workspace: "${ws.name}" (${workspaceId})`);

  // Realistic team participants
  const team = [
    { id: user ? user._id : 'demo-user', name: user ? user.name : 'Demo User' },
    { id: 'team-alice-chen', name: 'Alice Chen' },
    { id: 'team-bob-miller', name: 'Bob Miller' },
    { id: 'team-carol-white', name: 'Carol White' },
    { id: 'team-dave-evans', name: 'Dave Evans' },
    { id: 'team-elena-rostova', name: 'Elena Rostova' },
  ];

  // Channel conversation templates
  const conversations = {
    general: [
      { author: 'team-alice-chen', text: 'Welcome everyone to PacificBoard! Powered natively by PacificDB Community Edition 🚀' },
      { author: 'team-bob-miller', text: 'Hey Alice! Raft 3-node cluster and consensus monitoring are looking rock solid.' },
      { author: 'team-carol-white', text: 'Love the new dark glassmorphic UI. The Kanban board drag-and-drop is super smooth!' },
      { author: 'team-dave-evans', text: 'Just pushed the latest backend connection pool optimizations. P99 query latency is under 5ms.' },
      { author: user?.name ? user._id : 'team-alice-chen', text: 'Awesome progress team. Let’s do a quick sync on the vector search pipeline at 3 PM.' },
      { author: 'team-elena-rostova', text: 'Count me in! I will bring the benchmark numbers on the cosine similarity searches.' },
    ],
    dev: [
      { author: 'team-dave-evans', text: 'Heads up: TCP NDJSON streams now auto-destroy immediately upon receiving newline delimiters.' },
      { author: 'team-bob-miller', text: 'Great fix! That eliminated the socket exhaustion and connection_limit errors completely.' },
      { author: 'team-dave-evans', text: 'Also verified that memory backpressure flags in .env protect PacificDB memory limits.' },
      { author: 'team-alice-chen', text: 'Are task queries utilizing the secondary indexes on (workspaceId, status)?' },
      { author: 'team-bob-miller', text: 'Yes, explain plans confirm index scan coverage. Table scans are 0.' },
    ],
    design: [
      { author: 'team-carol-white', text: 'I updated the color tokens in index.css. Primary cyan is #22d3ee with smooth glow effects.' },
      { author: 'team-elena-rostova', text: 'The contrast on the status pills (backlog, todo, in_progress, review, done) looks super crisp!' },
      { author: 'team-carol-white', text: 'Added subtle micro-animations for card hover states and modal dialog transitions.' },
    ],
    random: [
      { author: 'team-bob-miller', text: 'Why do programmers prefer dark mode? Because light attracts bugs! 🐛' },
      { author: 'team-alice-chen', text: 'Classic Bob 😂' },
      { author: 'team-elena-rostova', text: 'Anyone want coffee from downstairs? Ordering in 5 minutes ☕' },
      { author: 'team-dave-evans', text: 'Double espresso for me please! Thanks Elena.' },
    ],
  };

  // Seed messages with staggered historical timestamps
  const allMessages = [];
  const now = Date.now();

  for (const [channelId, msgs] of Object.entries(conversations)) {
    for (let i = 0; i < msgs.length; i++) {
      const item = msgs[i];
      const member = team.find(m => m.id === item.author) || team[0];
      const createdAt = new Date(now - (msgs.length - i) * 180000).toISOString();

      allMessages.push({
        _id: uuidv4(),
        workspaceId,
        channelId,
        authorId: member.id,
        authorName: member.name,
        content: item.text,
        createdAt,
      });
    }
  }

  await col('messages').insertMany(allMessages);
  console.log(`✅ Successfully seeded ${allMessages.length} chat messages directly into PacificDB!`);
  console.log(`Channels populated: #general, #dev, #design, #random`);
  process.exit(0);
}

run().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
