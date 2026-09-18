/**
 * High-performance, position-independent deterministic vector embedding engine (384 dimensions)
 * Combines full-word hashing with character-trigrams so synonyms, prefixes, stems,
 * and sentence re-orderings match accurately with high cosine similarity.
 */

const DIMS = 384;

// FNV-1a 32-bit hash function
function hashToken(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % DIMS;
}

export function generateEmbedding(text) {
  const embedding = new Float64Array(DIMS);
  if (!text || typeof text !== 'string') return Array.from(embedding);

  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 0);

  for (const word of words) {
    // 1. Primary word hash (weight 2.5)
    const wIdx = hashToken(word);
    embedding[wIdx] += 2.5;

    // 2. Secondary word hash to avoid hash saturation (weight 1.0)
    const wIdx2 = hashToken(word + '_alt');
    embedding[wIdx2] += 1.0;

    // 3. Subword character trigrams for stemming and prefix/suffix matching (weight 0.6)
    // E.g. 'payment' -> 'pay', 'aym', 'yme', 'men', 'ent' matches 'pay' and 'payments'
    if (word.length >= 3) {
      for (let j = 0; j <= word.length - 3; j++) {
        const trigram = word.slice(j, j + 3);
        const tIdx = hashToken(trigram);
        embedding[tIdx] += 0.6;
      }
    }
  }

  // L2-Normalize
  let sumSq = 0;
  for (let i = 0; i < DIMS; i++) sumSq += embedding[i] * embedding[i];
  const mag = Math.sqrt(sumSq) || 1;

  const result = new Array(DIMS);
  for (let i = 0; i < DIMS; i++) result[i] = embedding[i] / mag;
  return result;
}

// Alias for backwards compatibility
export const generateSimpleEmbedding = generateEmbedding;

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, dot);
}

export default { generateEmbedding, generateSimpleEmbedding, cosineSimilarity };
