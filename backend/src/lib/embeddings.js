/**
 * High-Performance Domain-Aware Vector Embedding Engine (384 dimensions)
 * Combines stop-word elimination, morphological stemming, dense latent semantic
 * topic clusters, and subword hashing for production-grade semantic search.
 */

const DIMS = 384;

// Common English stop words that cause false semantic collisions
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'did', 'do', 'does', 'doing', 'down', 'during',
  'each',
  'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just',
  'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up',
  'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

// Latent Semantic Topic Clusters for workspace domains
const TOPIC_CLUSTERS = [
  {
    name: 'security_rbac_auth',
    baseDim: 180,
    terms: [
      'security', 'permission', 'permissions', 'rbac', 'access', 'control', 'role', 'roles',
      'auth', 'authentication', 'authorization', 'admin', 'owner', 'member', 'privilege',
      'token', 'jwt', 'password', 'policy', 'credential', 'credentials', 'enforce', 'enforcement',
      'protect', 'protection', 'secure'
    ]
  },
  {
    name: 'database_raft_storage',
    baseDim: 198,
    terms: [
      'database', 'pacificdb', 'raft', 'consensus', 'replica', 'replicas', 'replication',
      'follower', 'leader', 'election', 'term', 'terms', 'commit', 'sst', 'storage', 'engine',
      'cluster', 'wal', 'indices', 'heartbeat', 'fault'
    ]
  },
  {
    name: 'query_index_perf',
    baseDim: 216,
    terms: [
      'query', 'queries', 'index', 'indexes', 'secondary', 'scan', 'scans', 'explain',
      'performance', 'audit', 'optimize', 'optimization', 'speed', 'slow', 'latency', 'p99',
      'throughput', 'benchmark'
    ]
  },
  {
    name: 'payment_billing_stripe',
    baseDim: 234,
    terms: [
      'payment', 'payments', 'billing', 'stripe', 'invoice', 'invoices', 'checkout', 'card',
      'subscription', 'subscriptions', 'webhook', 'webhooks', 'charge', 'refund', 'transaction'
    ]
  },
  {
    name: 'ui_frontend_styling',
    baseDim: 252,
    terms: [
      'ui', 'frontend', 'ux', 'kanban', 'board', 'drag', 'drop', 'animation', 'animations',
      'card', 'cards', 'glassmorphism', 'theme', 'themes', 'styling', 'dark', 'modal', 'layout',
      'responsive', 'hotkey', 'hotkeys', 'shortcuts', 'shortcut', 'css'
    ]
  },
  {
    name: 'networking_tcp_stream',
    baseDim: 270,
    terms: [
      'tcp', 'ndjson', 'socket', 'sockets', 'network', 'stream', 'streaming', 'connection',
      'connections', 'recycling', 'exhaustion', 'pool', 'backpressure', 'keepalive', 'teardown', 'leak'
    ]
  },
  {
    name: 'backup_disaster_recovery',
    baseDim: 288,
    terms: [
      'backup', 'backups', 'snapshot', 'snapshots', 'restore', 'recovery', 'sst', 'checksum',
      'disaster', 'point-in-time', 'crc32', 'automated'
    ]
  },
  {
    name: 'webhooks_notifications_slack',
    baseDim: 306,
    terms: [
      'webhook', 'webhooks', 'slack', 'discord', 'notification', 'notifications', 'alert', 'alerts',
      'endpoint', 'endpoints', 'integration', 'integrations'
    ]
  },
  {
    name: 'chat_collaboration_media',
    baseDim: 324,
    terms: [
      'chat', 'messaging', 'media', 'attachment', 'attachments', 'upload', 'uploads', 'discussion',
      'discussions', 'channel', 'channels', 'sharing', 'collaborative', 'realtime'
    ]
  },
  {
    name: 'onboarding_product_walkthrough',
    baseDim: 342,
    terms: [
      'onboarding', 'walkthrough', 'guide', 'guiding', 'tour', 'tutorial', 'employee', 'employees',
      'product', 'guidance', 'overview'
    ]
  },
  {
    name: 'chaos_resilience_failover',
    baseDim: 360,
    terms: [
      'chaos', 'resilience', 'simulator', 'partition', 'crash', 'failover', 'kill', 'tolerance',
      'recovery'
    ]
  }
];

// Morphological stemmer
function stemWord(w) {
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('tion') && w.length > 6) return w.slice(0, -4);
  return w;
}

// 32-bit FNV-1a hash
function hashToken(str, max) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % max;
}

/**
 * Generates an L2-normalized 384-dimensional vector embedding.
 */
export function generateEmbedding(text) {
  const vec = new Float64Array(DIMS);
  if (!text || typeof text !== 'string') return Array.from(vec);

  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));

  for (const raw of words) {
    const stemmed = stemWord(raw);

    // Feature Space 1: Exact word & morphological stem (dims 0..179)
    const d1 = hashToken(raw, 180);
    vec[d1] += 3.5;
    const d2 = hashToken(stemmed + '_stem', 180);
    vec[d2] += 2.5;

    // Feature Space 2: Semantic Concept Clusters (dims 180..371)
    for (const cluster of TOPIC_CLUSTERS) {
      if (cluster.terms.includes(raw) || cluster.terms.includes(stemmed)) {
        for (let k = 0; k < 16; k++) {
          vec[cluster.baseDim + k] += 3.0;
        }
      }
    }

    // Feature Space 3: Subword character trigrams for typo resilience (dims 372..383)
    if (raw.length >= 4) {
      for (let j = 0; j <= raw.length - 3; j++) {
        const trigram = raw.slice(j, j + 3);
        const tIdx = 372 + hashToken(trigram, 12);
        vec[tIdx] += 0.3;
      }
    }
  }

  // L2-Normalize
  let sumSq = 0;
  for (let i = 0; i < DIMS; i++) sumSq += vec[i] * vec[i];
  const mag = Math.sqrt(sumSq) || 1;

  const res = new Array(DIMS);
  for (let i = 0; i < DIMS; i++) res[i] = vec[i] / mag;
  return res;
}

export const generateSimpleEmbedding = generateEmbedding;

/**
 * Normalized cosine similarity between two unit vectors: dot(a, b)
 */
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, Math.min(1.0, dot));
}

export default { generateEmbedding, generateSimpleEmbedding, cosineSimilarity };
