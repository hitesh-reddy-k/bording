/**
 * PacificDB Community Edition - Native TCP Client with Connection Reuse
 * 
 * Protocol: NDJSON over TCP (one JSON line per request, response ends with EOF)
 * Key fields:
 *   - action: 'find' | 'insert' | 'update' | 'delete' | 'count' | 'aggregate' | 'ping' | 'bulk'
 *   - dbName: the database name
 *   - collection: the collection name
 *   - filter: equality predicate object (triggers INDEX_LOOKUP)
 *   - document: for insert
 *   - update: for update
 * Results are in response.data[] (not .documents[])
 */

import net from 'net';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const DB_NAME = process.env.PACIFICDB_DBNAME || 'pacificboard';
const DB_HOST = process.env.PACIFICDB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.PACIFICDB_PORT || '9000', 10);

// Concurrency limiter to prevent exhausting PacificDB connections
const MAX_CONCURRENT = 16;
const MAX_QUEUE = 10000;
let activeConnections = 0;
const requestQueue = [];

function drainQueue() {
  while (activeConnections < MAX_CONCURRENT && requestQueue.length > 0) {
    const item = requestQueue.shift();
    if (item.aborted) continue;
    activeConnections++;
    requestRaw(item.payload, item.retries)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeConnections--;
        drainQueue();
      });
  }
}

/** Send a single NDJSON request through the concurrency limiter. */
function request(payload, retries = 5) {
  return new Promise((resolve, reject) => {
    if (requestQueue.length >= MAX_QUEUE) {
      return reject(new Error('PacificDB query queue full (server busy)'));
    }
    const item = { payload, retries, resolve, reject, aborted: false };
    const queueTimeout = setTimeout(() => {
      item.aborted = true;
      reject(new Error('PacificDB request queue timeout'));
    }, 60000);

    item.resolve = (val) => { clearTimeout(queueTimeout); resolve(val); };
    item.reject = (err) => { clearTimeout(queueTimeout); reject(err); };

    requestQueue.push(item);
    drainQueue();
  });
}

const DB_LOG = process.env.PACIFICDB_LOG !== 'false';

/** Low-level socket request. Destroys socket immediately on complete NDJSON line. */
function requestRaw(payload, retries = 5) {
  return new Promise((resolve, reject) => {
    let remainingRetries = retries;
    const t0 = Date.now();

    let queryDesc = payload.action;
    if (payload.action === 'find') {
      queryDesc = `find(${JSON.stringify(payload.filter || {})}${payload.limit ? `, limit:${payload.limit}` : ''})`;
    } else if (payload.action === 'insert') {
      queryDesc = `insertOne(${payload.document?._id ? payload.document._id.slice(0, 8) + '...' : ''})`;
    } else if (payload.action === 'insertMany') {
      queryDesc = `insertMany(${payload.documents?.length || 0} docs)`;
    } else if (payload.action === 'update') {
      queryDesc = `updateOne(${JSON.stringify(payload.filter || {})})`;
    } else if (payload.action === 'deleteOne' || payload.action === 'deleteMany') {
      queryDesc = `${payload.action}(${JSON.stringify(payload.filter || {})})`;
    } else if (payload.action === 'count') {
      queryDesc = `count(${JSON.stringify(payload.filter || {})})`;
    }

    if (DB_LOG && payload.action !== 'ping') {
      console.log(`\x1b[36m[PacificDB ▶]\x1b[0m \x1b[33m${payload.collection || 'system'}\x1b[0m.${queryDesc}`);
    }

    const attempt = () => {
      const s = net.connect(DB_PORT, DB_HOST);
      let buf = '';
      let done = false;

      const finish = (result, error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        s.destroy();
        const duration = Date.now() - t0;
        if (error) {
          if (DB_LOG && payload.action !== 'ping') {
            console.error(`\x1b[31m[PacificDB ✖]\x1b[0m \x1b[33m${payload.collection || 'system'}\x1b[0m.${payload.action} \x1b[31mFAILED\x1b[0m: ${error.message} (${duration}ms)`);
          }
          reject(error);
        } else {
          if (DB_LOG && payload.action !== 'ping') {
            const countInfo = result.data ? `${result.data.length} docs` : result.inserted !== undefined ? `${result.inserted} inserted` : result.deleted !== undefined ? `${result.deleted} deleted` : result.count !== undefined ? `${result.count} count` : (result.status || 'ok');
            console.log(`\x1b[32m[PacificDB ◀]\x1b[0m \x1b[33m${payload.collection || 'system'}\x1b[0m.${payload.action} → \x1b[32m${countInfo}\x1b[0m (${duration}ms)`);
          }
          resolve(result);
        }
      };

      s.on('connect', () => {
        s.write(JSON.stringify(payload) + '\n');
      });

      s.on('data', (chunk) => {
        buf += chunk.toString();
        // PacificDB responses are NDJSON (one line ending with \n)
        if (buf.includes('\n')) {
          try {
            const parsed = JSON.parse(buf.trim());
            if (parsed.error && parsed.error !== 'ok' && parsed.status !== 'ok') {
              if ((parsed.error === 'server_busy' || parsed.error === 'memory_pressure' || parsed.error === 'write_stalled') && remainingRetries > 0) {
                remainingRetries--;
                done = true;
                clearTimeout(timer);
                s.destroy();
                const baseDelay = parsed.retry_after_ms || (150 * Math.pow(1.8, 5 - remainingRetries));
                const jitter = Math.floor(Math.random() * 50);
                const delay = Math.min(baseDelay + jitter, 2500);
                setTimeout(attempt, delay);
                return;
              }
              const err = new Error(parsed.message || parsed.error);
              err.code = parsed.error;
              finish(null, err);
            } else {
              finish(parsed, null);
            }
          } catch {
            // Buffer may be partially received JSON, wait for remainder
          }
        }
      });

      s.on('end', () => {
        if (!done && buf.trim()) {
          try {
            const parsed = JSON.parse(buf.trim());
            finish(parsed, null);
          } catch (e) {
            finish(null, new Error('Invalid response: ' + buf.slice(0, 200)));
          }
        }
      });

      s.on('error', (err) => {
        if (!done && remainingRetries > 0) {
          remainingRetries--;
          done = true;
          clearTimeout(timer);
          s.destroy();
          const delay = 80 * Math.pow(1.8, 5 - remainingRetries) + Math.floor(Math.random() * 40);
          setTimeout(attempt, delay);
        } else {
          finish(null, err);
        }
      });

      const timer = setTimeout(() => {
        finish(null, new Error('PacificDB request timed out'));
      }, 30000);
    };

    attempt();
  });
}

/** Strip internal engine metadata from a document. */
function cleanDoc(doc) {
  if (!doc) return null;
  const {
    _mvcc_commit_ms, _mvcc_version, _raft_commit_index, _raft_term,
    _visibility_floor, _visibility_state, committed, created_txn,
    deleted_at_ms, deleted_txn, tenant_id, version, created_at_ms,
    ...clean
  } = doc;
  return clean;
}

/** Collection interface */
function collection(name) {
  const base = { dbName: DB_NAME, collection: name };

  return {
    async insertOne(doc) {
      if (!doc._id) doc._id = randomUUID();
      if (!doc.createdAt) doc.createdAt = new Date().toISOString();
      const r = await request({ ...base, action: 'insert', document: doc });
      return { id: doc._id, inserted: r.status === 'ok' };
    },

    async insertMany(docs) {
      if (!Array.isArray(docs) || docs.length === 0) return { inserted: 0 };
      for (const doc of docs) {
        if (!doc._id) doc._id = randomUUID();
        if (!doc.createdAt) doc.createdAt = new Date().toISOString();
      }
      // Chunk in batches of 100 to prevent oversized TCP buffer lines
      const CHUNK_SIZE = 100;
      let totalInserted = 0;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const r = await request({ ...base, action: 'insertMany', documents: chunk });
        totalInserted += (r.inserted ?? chunk.length);
      }
      return { inserted: totalInserted };
    },

    async findOne(filter) {
      const r = await request({ ...base, action: 'find', filter, limit: 1 });
      return cleanDoc(r.data?.[0]) || null;
    },

    async find(filter = {}, opts = {}) {
      const payload = { ...base, action: 'find', filter };
      if (opts.limit) payload.limit = opts.limit;
      if (opts.sort) payload.sort = opts.sort;
      if (opts.skip) payload.skip = opts.skip;
      const r = await request(payload);
      return (r.data || []).map(cleanDoc);
    },

    /** Store a vector in PacificDB's native vector index. */
    async insertVector(id, vector, metadata = {}) {
      const r = await request({
        ...base,
        action: 'insertVector',
        data: { ...metadata, id, kind: 'vector', vector },
      });
      return { id, inserted: r.status === 'ok' };
    },

    /** Query PacificDB's native vector index instead of scanning documents. */
    async queryVector(vector, opts = {}) {
      const r = await request({
        ...base,
        action: 'queryVector',
        vector,
        k: opts.k || 10,
        metric: opts.metric || 'cosine',
        filter: opts.filter || {},
      });
      return r.data || [];
    },

    async updateOne(filter, update) {
      const fields = update.$set ? { ...update, ...update.$set } : update;
      delete fields.$set;
      const r = await request({ ...base, action: 'update', filter, update: fields });
      const ok = r.status === 'updated' || r.status === 'ok';
      return { matched: ok ? 1 : (r.matched_count || 0), modified: ok ? 1 : (r.modified_count || 0) };
    },

    async deleteOne(filter) {
      const r = await request({ ...base, action: 'deleteOne', filter });
      return { deleted: r.status === 'deleted' || r.status === 'ok' };
    },

    async deleteMany(filter = {}) {
      const r = await request({ ...base, action: 'deleteMany', filter });
      return { deleted: r.deleted || 0 };
    },

    async count(filter = {}) {
      const r = await request({ ...base, action: 'count', filter });
      return r.count || 0;
    },

    async createIndex(def) {
      try {
        return await request({ ...base, action: 'create_index', index: def });
      } catch {
        return null;
      }
    },
  };
}

async function ping() {
  const r = await request({ action: 'ping' });
  return r.status === 'pong';
}

export async function connectDB() {
  try {
    await ping();
    console.log(`✅ PacificDB connected at ${DB_HOST}:${DB_PORT} (db=${DB_NAME})`);
  } catch (err) {
    console.error('❌ PacificDB connection failed:', err.message);
    throw err;
  }
}

export function getDB() {
  return { collection };
}

export const col = collection;

export default { connectDB, getDB, collection, col };
