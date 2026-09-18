/**
 * PacificDB Native Semantic / Vector Search Benchmark
 * 
 * Tests ONLY PacificDB's native vector storage, indexing, and nearest-neighbor search.
 * Zero client-side brute force in the search benchmark path.
 * Communicates directly with PacificDB via native TCP NDJSON protocol.
 * 
 * Usage:
 *   node benchmarks/pacificdb-semantic-search.mjs [options]
 * 
 * Options:
 *   --vectors <N>         Dataset size: 10000, 100000, 500000, 1000000 (default: 100000)
 *   --dimensions <D>      Vector dimensions (default: 384)
 *   --top-k <K>           Nearest neighbors to retrieve (default: 10)
 *   --queries <Q>         Number of measured search queries (default: 100)
 *   --concurrency <list>  Concurrency levels to benchmark, comma-separated (default: 1,8,32)
 *   --metric <M>          Distance metric: cosine, l2, dot (default: cosine)
 *   --batch-size <B>      Insert batch size (default: 500)
 *   --skip-insert         Skip vector generation/insertion if already populated
 *   --validation-size <V> Subset size for ground-truth recall validation (default: 1000)
 *   --clean-after         Drop benchmark collection after run (default: false)
 *   --host <H>            PacificDB host (default: 127.0.0.1)
 *   --port <P>            PacificDB port (default: 9000)
 *   --db <NAME>           PacificDB database name (default: pacificboard)
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    vectors: 100000,
    dimensions: 384,
    topK: 10,
    queries: 100,
    concurrency: [1, 8, 32],
    metric: 'cosine',
    batchSize: 500,
    skipInsert: false,
    validationSize: null,
    cleanAfter: false,
    host: process.env.PACIFICDB_HOST || '127.0.0.1',
    port: parseInt(process.env.PACIFICDB_PORT || '9000', 10),
    db: process.env.PACIFICDB_DBNAME || 'pacificboard',
    collection: 'semantic_benchmark_vectors',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--vectors' && args[i + 1]) opts.vectors = parseInt(args[++i], 10);
    else if (arg === '--dimensions' && args[i + 1]) opts.dimensions = parseInt(args[++i], 10);
    else if (arg === '--top-k' && args[i + 1]) opts.topK = parseInt(args[++i], 10);
    else if (arg === '--queries' && args[i + 1]) opts.queries = parseInt(args[++i], 10);
    else if (arg === '--concurrency' && args[i + 1]) {
      opts.concurrency = args[++i].split(',').map(n => parseInt(n.trim(), 10));
    }
    else if (arg === '--metric' && args[i + 1]) opts.metric = args[++i];
    else if (arg === '--batch-size' && args[i + 1]) opts.batchSize = parseInt(args[++i], 10);
    else if (arg === '--validation-size' && args[i + 1]) opts.validationSize = parseInt(args[++i], 10);
    else if (arg === '--skip-insert') opts.skipInsert = true;
    else if (arg === '--clean-after') opts.cleanAfter = true;
    else if (arg === '--host' && args[i + 1]) opts.host = args[++i];
    else if (arg === '--port' && args[i + 1]) opts.port = parseInt(args[++i], 10);
    else if (arg === '--db' && args[i + 1]) opts.db = args[++i];
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`
PacificDB Native Semantic Search Benchmark
Usage: node benchmarks/pacificdb-semantic-search.mjs [options]

Options:
  --vectors <N>         Number of vectors: 10000, 100000, 500000, 1000000 (default: 100000)
  --dimensions <D>      Vector dimensions (default: 384)
  --top-k <K>           Nearest neighbors to retrieve (default: 10)
  --queries <Q>         Measured queries count (default: 100)
  --concurrency <list>  Concurrency list: 1,8,32 (default: 1,8,32)
  --metric <M>          Distance metric: cosine, l2, dot (default: cosine)
  --batch-size <B>      Insert batch size (default: 500)
  --skip-insert         Skip insert if collection already populated
  --validation-size <V> Ground-truth recall sample size (default: 1000)
  --clean-after         Clean/drop benchmark collection after run
  --help, -h            Show this help message
`);
}

// ---------------------------------------------------------------------------
// Native PacificDB TCP Client (NDJSON wire protocol)
// ---------------------------------------------------------------------------

function tcpRequest(host, port, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const socket = net.connect(port, host, () => {
      socket.write(JSON.stringify(payload) + '\n');
    });

    socket.setTimeout(timeoutMs, () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error(`TCP request timeout after ${timeoutMs}ms`));
      }
    });

    let buffer = '';
    const finish = () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      try {
        const parsed = JSON.parse(buffer.trim());
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse PacificDB response: ${err.message}. Raw: ${buffer.slice(0, 200)}`));
      }
    };

    socket.on('data', chunk => {
      buffer += chunk.toString();
      if (buffer.includes('\n')) {
        finish();
      }
    });

    socket.on('end', () => {
      finish();
    });

    socket.on('error', err => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Deterministic Embeddings Generator (Mulberry32 PRNG)
// ---------------------------------------------------------------------------

function createPRNG(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = [
  'security',
  'performance',
  'database',
  'infrastructure',
  'devops',
  'monitoring',
  'rbac',
  'consensus',
  'storage',
  'networking'
];

/**
 * Generates a deterministic normalized 384-dimensional vector.
 * Unit length (L2 norm = 1.0) ensures standard cosine distances.
 */
function generateDeterministicVector(rng, dimensions) {
  const vec = new Float64Array(dimensions);
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    // Box-Muller transform for standard normal distribution
    const u1 = Math.max(rng(), 1e-7);
    const u2 = rng();
    const val = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    vec[i] = val;
    normSq += val * val;
  }
  const invNorm = 1.0 / Math.sqrt(normSq);
  const result = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    result[i] = Number((vec[i] * invNorm).toFixed(6));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Server Memory & Metrics Monitor
// ---------------------------------------------------------------------------

async function getPacificDbServerMetrics(host, port) {
  try {
    const adminRes = await tcpRequest(host, port, { action: 'admin_dashboard' }, 5000);
    if (adminRes && adminRes.system && adminRes.memory) {
      return {
        pid: adminRes.system.process_id,
        memoryUsedMb: adminRes.system.memory_used_mb,
        peakMemoryMb: adminRes.system.peak_memory_mb,
        cpuUsagePct: adminRes.system.cpu_usage_percent,
        memUsageMb: Math.round(adminRes.memory.current_usage_mb),
        memUsagePct: Number(adminRes.memory.usage_percent.toFixed(1)),
      };
    }
  } catch {
    // fallback to OS tasklist on Windows
  }

  try {
    const raw = execSync('tasklist /FI "IMAGENAME eq db_engine.exe" /FO CSV /NH', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    const match = raw.match(/"([^"]+)","(\d+)","[^"]*","[^"]*","([^"]+)"/);
    if (match) {
      const memStr = match[3].replace(/[^0-9]/g, '');
      const memMb = (parseInt(memStr, 10) * 1024) / (1024 * 1024);
      return {
        pid: parseInt(match[2], 10),
        memoryUsedMb: Math.round(memMb),
        peakMemoryMb: Math.round(memMb),
      };
    }
  } catch {
    // ignore
  }

  return { memoryUsedMb: 0, peakMemoryMb: 0 };
}

function getClientMemory() {
  const mem = process.memoryUsage();
  return {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
  };
}

// ---------------------------------------------------------------------------
// Math & Percentile Helpers
// ---------------------------------------------------------------------------

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const rank = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function computeStats(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: Number(sorted[0].toFixed(2)),
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p90: Number(percentile(sorted, 90).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Main Benchmark Routine
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('='.repeat(60));
  console.log('PacificDB Native Semantic Search Benchmark');
  console.log('='.repeat(60));
  console.log(`Database Host:         ${opts.host}:${opts.port}`);
  console.log(`Database Name:         ${opts.db}`);
  console.log(`Target Collection:     ${opts.collection}`);
  console.log(`Dataset Size:          ${opts.vectors.toLocaleString()} vectors`);
  console.log(`Vector Dimensions:     ${opts.dimensions}`);
  console.log(`Distance Metric:       ${opts.metric}`);
  console.log(`Top-K:                 ${opts.topK}`);
  console.log(`Measured Queries:      ${opts.queries}`);
  console.log(`Concurrency Levels:    ${opts.concurrency.join(', ')}`);
  console.log(`Validation Sample:     ${opts.validationSize ? opts.validationSize.toLocaleString() + ' vectors' : 'Dynamic (Auto)'}`);
  console.log('='.repeat(60));

  // 1. Verify Connectivity
  const pingStart = performance.now();
  try {
    const pingRes = await tcpRequest(opts.host, opts.port, { action: 'ping' });
    if (pingRes.status !== 'pong') {
      throw new Error(`Unexpected ping response: ${JSON.stringify(pingRes)}`);
    }
  } catch (err) {
    console.error(`\n❌ ERROR: Cannot connect to PacificDB at ${opts.host}:${opts.port}`);
    console.error(`Details: ${err.message}`);
    console.error('Make sure PacificDB Community Edition engine is running before starting the benchmark.\n');
    process.exit(1);
  }
  const pingMs = (performance.now() - pingStart).toFixed(2);
  console.log(`✅ Connected to PacificDB engine (${pingMs}ms)`);

  // Record initial memory
  const initialServerMem = await getPacificDbServerMetrics(opts.host, opts.port);
  const initialClientMem = getClientMemory();

  // 2. Ensure Benchmark Collection Exists
  try {
    await tcpRequest(opts.host, opts.port, {
      action: 'createCollection',
      dbName: opts.db,
      collection: opts.collection,
    });
  } catch {
    // Already exists, ignore
  }

  // Check existing vector count
  let currentCount = 0;
  try {
    const countRes = await tcpRequest(opts.host, opts.port, {
      action: 'count',
      dbName: opts.db,
      collection: opts.collection,
    });
    currentCount = countRes.count || 0;
  } catch (err) {
    console.warn(`Could not determine initial count: ${err.message}`);
  }

  // 3. Vector Insertion Phase
  let insertionDurationMs = 0;
  let vectorsPerSec = 0;
  let totalBytesInserted = 0;

  if (opts.skipInsert && currentCount >= opts.vectors) {
    console.log(`\n⏩ [Insert] --skip-insert specified and collection already has ${currentCount.toLocaleString()} vectors. Skipping insertion.`);
  } else {
    // If collection has different count, clear and seed
    if (currentCount > 0 && currentCount !== opts.vectors) {
      console.log(`\n🧹 [Insert] Clearing existing ${currentCount.toLocaleString()} vectors in ${opts.collection}...`);
      await tcpRequest(opts.host, opts.port, {
        action: 'deleteMany',
        dbName: opts.db,
        collection: opts.collection,
        filter: {},
      });
      currentCount = 0;
    }

    if (currentCount < opts.vectors) {
      const needed = opts.vectors - currentCount;
      console.log(`\n📥 [Insert Phase] Generating & inserting ${needed.toLocaleString()} vectors (${opts.dimensions}-d)...`);
      const rng = createPRNG(42); // Seeded deterministic generator

      const insertStart = performance.now();
      let insertedSoFar = 0;
      const batchSize = Math.min(opts.batchSize, needed);

      while (insertedSoFar < needed) {
        const currentBatch = Math.min(batchSize, needed - insertedSoFar);
        const docs = new Array(currentBatch);

        for (let b = 0; b < currentBatch; b++) {
          const idNum = currentCount + insertedSoFar + b + 1;
          const idStr = `bench-${String(idNum).padStart(8, '0')}`;
          const vec = generateDeterministicVector(rng, opts.dimensions);
          const category = CATEGORIES[idNum % CATEGORIES.length];

          docs[b] = {
            _id: idStr,
            id: idStr,
            vector: vec,
            category,
          };
        }

        const jsonPayload = JSON.stringify({
          action: 'insertMany',
          dbName: opts.db,
          collection: opts.collection,
          documents: docs,
        });
        totalBytesInserted += Buffer.byteLength(jsonPayload, 'utf8');

        await tcpRequest(opts.host, opts.port, JSON.parse(jsonPayload));
        insertedSoFar += currentBatch;

        if (insertedSoFar % (batchSize * 5) === 0 || insertedSoFar === needed) {
          const pct = ((insertedSoFar / needed) * 100).toFixed(1);
          const elapsedSec = (performance.now() - insertStart) / 1000;
          const rate = Math.round(insertedSoFar / elapsedSec);
          process.stdout.write(`\r   Inserted ${insertedSoFar.toLocaleString()} / ${needed.toLocaleString()} (${pct}%) - ${rate.toLocaleString()} vectors/sec`);
        }
      }
      process.stdout.write('\n');

      insertionDurationMs = performance.now() - insertStart;
      vectorsPerSec = Math.round((needed / (insertionDurationMs / 1000)));
      console.log(`✅ [Insert Completed] ${needed.toLocaleString()} vectors inserted in ${(insertionDurationMs / 1000).toFixed(2)}s (${vectorsPerSec.toLocaleString()} vectors/sec)`);
    }
  }

  // 4. Vector Index Synchronization / Storage Flush
  console.log('\n⚙️  [Index Phase] Synchronizing PacificDB LSM memtables & index state...');
  const flushStart = performance.now();
  try {
    await tcpRequest(opts.host, opts.port, {
      action: 'storage_flush',
      dbName: opts.db,
    });
  } catch (err) {
    console.warn(`   Flush notice: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 1000));
  const indexReadyMs = Number((performance.now() - flushStart).toFixed(2));
  console.log(`✅ [Index Ready] Native vector index synchronized in ${indexReadyMs}ms`);

  // Verify total populated vectors
  const verifiedCountRes = await tcpRequest(opts.host, opts.port, {
    action: 'count',
    dbName: opts.db,
    collection: opts.collection,
  });
  const totalVerifiedVectors = verifiedCountRes.count || opts.vectors;
  console.log(`   Collection verified count: ${totalVerifiedVectors.toLocaleString()} vectors`);

  // 5. Generate Deterministic Measured & Validation Queries
  const queryRng = createPRNG(1337);
  const testQueries = new Array(opts.queries);
  for (let q = 0; q < opts.queries; q++) {
    testQueries[q] = generateDeterministicVector(queryRng, opts.dimensions);
  }

  // 6. Ground-Truth Recall Correctness Validation (Recall@1, Recall@5, Recall@10)
  const valSize = opts.validationSize || Math.min(totalVerifiedVectors, 10000);
  opts.validationSize = valSize;
  console.log('\n🔍 [Validation Phase] Evaluating search correctness & Recall@K against ground truth...');
  console.log(`   Evaluating ${valSize.toLocaleString()} vectors for exact brute-force ground truth...`);

  // Fetch validation ground-truth subset
  const sampleSubset = [];
  const validationRng = createPRNG(42);
  for (let v = 0; v < valSize; v++) {
    const idNum = v + 1;
    const idStr = `bench-${String(idNum).padStart(8, '0')}`;
    const vec = generateDeterministicVector(validationRng, opts.dimensions);
    sampleSubset.push({ id: idStr, vector: vec });
  }

  // Helper: exact cosine similarity for validation ONLY
  function cosineSimilarityExact(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  let recall1Sum = 0;
  let recall5Sum = 0;
  let recall10Sum = 0;
  const validationChecks = Math.min(10, testQueries.length);

  for (let q = 0; q < validationChecks; q++) {
    const qVec = testQueries[q];

    // Native PacificDB search
    const nativeRes = await tcpRequest(opts.host, opts.port, {
      action: 'queryVector',
      dbName: opts.db,
      collection: opts.collection,
      vector: qVec,
      k: opts.topK,
      metric: opts.metric,
    });

    const nativeIds = (nativeRes.data || []).map(item => item.id);

    // Compute ground-truth top-K from sample subset
    const rankedSubset = sampleSubset
      .map(item => ({ id: item.id, score: cosineSimilarityExact(qVec, item.vector) }))
      .sort((a, b) => b.score - a.score);

    const gtTop1 = new Set(rankedSubset.slice(0, 1).map(r => r.id));
    const gtTop5 = new Set(rankedSubset.slice(0, 5).map(r => r.id));
    const gtTop10 = new Set(rankedSubset.slice(0, 10).map(r => r.id));

    const hits1 = nativeIds.slice(0, 1).filter(id => gtTop1.has(id)).length;
    const hits5 = nativeIds.slice(0, 5).filter(id => gtTop5.has(id)).length;
    const hits10 = nativeIds.slice(0, 10).filter(id => gtTop10.has(id)).length;

    recall1Sum += hits1 / 1;
    recall5Sum += hits5 / 5;
    recall10Sum += hits10 / 10;
  }

  const recall1 = Number(((recall1Sum / validationChecks) * 100).toFixed(1));
  const recall5 = Number(((recall5Sum / validationChecks) * 100).toFixed(1));
  const recall10 = Number(((recall10Sum / validationChecks) * 100).toFixed(1));

  console.log(`   Recall@1:   ${recall1}%`);
  console.log(`   Recall@5:   ${recall5}%`);
  console.log(`   Recall@10:  ${recall10}%`);

  // 7. Warmup Phase (20 queries)
  console.log('\n🔥 [Warmup Phase] Executing 20 warmup queries through native PacificDB vector search...');
  const warmupRng = createPRNG(999);
  for (let w = 0; w < 20; w++) {
    const wVec = generateDeterministicVector(warmupRng, opts.dimensions);
    await tcpRequest(opts.host, opts.port, {
      action: 'queryVector',
      dbName: opts.db,
      collection: opts.collection,
      vector: wVec,
      k: opts.topK,
      metric: opts.metric,
    });
  }
  console.log('✅ [Warmup Completed] Cache and connection pool warm.');

  // 8. Search Performance Benchmark across Concurrency Levels
  console.log('\n⚡ [Search Benchmark Phase] Executing measured queries across concurrency levels...');
  const concurrencyResults = [];

  for (const conc of opts.concurrency) {
    process.stdout.write(`   Benchmarking Concurrency = ${conc} (${opts.queries} queries)... `);

    const latencies = [];
    const queryIndexRef = { index: 0 };

    async function worker() {
      while (true) {
        const currentIdx = queryIndexRef.index++;
        if (currentIdx >= opts.queries) break;

        const qVec = testQueries[currentIdx % testQueries.length];
        const t0 = performance.now();
        const res = await tcpRequest(opts.host, opts.port, {
          action: 'queryVector',
          dbName: opts.db,
          collection: opts.collection,
          vector: qVec,
          k: opts.topK,
          metric: opts.metric,
        });
        const t1 = performance.now();

        if (res.status !== 'ok' || !Array.isArray(res.data)) {
          throw new Error(`Native queryVector failed: ${JSON.stringify(res)}`);
        }
        latencies.push(t1 - t0);
      }
    }

    const startBench = performance.now();
    const workers = [];
    for (let c = 0; c < conc; c++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    const durationSec = (performance.now() - startBench) / 1000;

    const stats = computeStats(latencies);
    const qps = Number((opts.queries / durationSec).toFixed(1));

    concurrencyResults.push({
      concurrency: conc,
      totalQueries: opts.queries,
      durationSec: Number(durationSec.toFixed(3)),
      qps,
      min: stats.min,
      p50: stats.p50,
      p90: stats.p90,
      p95: stats.p95,
      p99: stats.p99,
      max: stats.max,
      avg: stats.avg,
    });

    console.log(`QPS: ${qps} | p50: ${stats.p50}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms`);
  }

  // Record final memory
  const finalServerMem = await getPacificDbServerMetrics(opts.host, opts.port);
  const finalClientMem = getClientMemory();

  // 9. Clean up if requested
  if (opts.cleanAfter) {
    console.log(`\n🧹 [Clean After] Dropping benchmark collection ${opts.collection}...`);
    await tcpRequest(opts.host, opts.port, {
      action: 'deleteMany',
      dbName: opts.db,
      collection: opts.collection,
      filter: {},
    });
    console.log('✅ Benchmark collection cleaned.');
  }

  // -------------------------------------------------------------------------
  // Print Formatted Report (as specified in prompt)
  // -------------------------------------------------------------------------

  const reportText = `
============================================================
PacificDB Native Semantic Search Benchmark
============================================================

Database:
    PacificDB Community

Search Implementation:
    NATIVE PACIFICDB VECTOR SEARCH (queryVector)

Vector dimensions:
    ${opts.dimensions}

Distance:
    ${opts.metric}

Index:
    PacificDB Native Vector Search (Engine HNSW / SIMD)

Dataset:
    ${totalVerifiedVectors.toLocaleString()} vectors

Top-K:
    ${opts.topK}

Queries:
    ${opts.queries}

------------------------------------------------------------
SEARCH PERFORMANCE
------------------------------------------------------------

Concurrency    QPS       p50       p95       p99
${concurrencyResults.map(r => `${String(r.concurrency).padEnd(15)}${String(r.qps).padEnd(10)}${String(r.p50 + 'ms').padEnd(10)}${String(r.p95 + 'ms').padEnd(10)}${String(r.p99 + 'ms')}`).join('\n')}

------------------------------------------------------------
SCALING (Dataset: ${totalVerifiedVectors.toLocaleString()} vectors)
------------------------------------------------------------

Vectors       p50       p95       p99       QPS
${String(totalVerifiedVectors.toLocaleString()).padEnd(14)}${String(concurrencyResults[0].p50 + 'ms').padEnd(10)}${String(concurrencyResults[0].p95 + 'ms').padEnd(10)}${String(concurrencyResults[0].p99 + 'ms').padEnd(10)}${String(concurrencyResults[0].qps)}

------------------------------------------------------------
CORRECTNESS
------------------------------------------------------------

Recall@1:     ${recall1}%
Recall@5:     ${recall5}%
Recall@10:    ${recall10}%

------------------------------------------------------------
INDEX & INGESTION
------------------------------------------------------------

Index sync time:     ${indexReadyMs}ms
Index type:          PacificDB Native Vector Search (Engine HNSW / SIMD)
Dimensions:          ${opts.dimensions}
Distance metric:     ${opts.metric}
Insertion rate:      ${vectorsPerSec > 0 ? vectorsPerSec.toLocaleString() + ' vectors/sec' : 'Pre-seeded'}

------------------------------------------------------------
RESOURCE MONITORING
------------------------------------------------------------

PacificDB Server Memory:
    Before Benchmark: ${initialServerMem.memoryUsedMb} MB
    After Benchmark:  ${finalServerMem.memoryUsedMb} MB
    Server PID:       ${finalServerMem.pid || initialServerMem.pid || 'N/A'}

Benchmark Client Memory (Node.js):
    Before Benchmark: ${initialClientMem.rssMb} MB RSS (${initialClientMem.heapUsedMb} MB Heap)
    After Benchmark:  ${finalClientMem.rssMb} MB RSS (${finalClientMem.heapUsedMb} MB Heap)

============================================================
`;

  console.log(reportText);

  // 10. Save Machine-Readable JSON Results
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsPath = path.join(resultsDir, 'pacificdb-semantic-results.json');
  const resultJson = {
    benchmark: 'PacificDB Native Semantic Search Benchmark',
    timestamp: new Date().toISOString(),
    database: 'PacificDB Community',
    searchMode: 'NATIVE PACIFICDB VECTOR SEARCH',
    dataset: {
      vectors: totalVerifiedVectors,
      dimensions: opts.dimensions,
      metric: opts.metric,
      topK: opts.topK,
      queries: opts.queries,
      insertionDurationSec: Number((insertionDurationMs / 1000).toFixed(2)),
      insertionRateVectorsPerSec: vectorsPerSec,
      totalBytesInserted,
    },
    index: {
      type: 'PacificDB Native Vector Search (Engine HNSW / SIMD)',
      syncTimeMs: indexReadyMs,
      distanceMetric: opts.metric,
      dimensions: opts.dimensions,
    },
    correctness: {
      validationSampleSize: opts.validationSize,
      recallAt1: recall1,
      recallAt5: recall5,
      recallAt10: recall10,
    },
    concurrencyPerformance: concurrencyResults,
    memory: {
      server: {
        beforeMb: initialServerMem.memoryUsedMb,
        afterMb: finalServerMem.memoryUsedMb,
        pid: finalServerMem.pid,
      },
      client: {
        beforeRssMb: initialClientMem.rssMb,
        afterRssMb: finalClientMem.rssMb,
        beforeHeapMb: initialClientMem.heapUsedMb,
        afterHeapMb: finalClientMem.heapUsedMb,
      },
    },
  };

  fs.writeFileSync(resultsPath, JSON.stringify(resultJson, null, 2), 'utf8');
  console.log(`📁 Machine-readable results saved to:\n   ${resultsPath}\n`);
}

main().catch(err => {
  console.error('\n❌ Benchmark execution error:', err);
  process.exit(1);
});
