async function run() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const testQueries = [
    'checkout error',
    'speed up database',
    'login issues',
    'payment bugs'
  ];

  for (const q of testQueries) {
    console.log('\n======================================================');
    console.log(`QUERY: "${q}"`);
    console.log('======================================================');

    // 1. Global Search (Exact Keyword Match)
    const globalRes = await fetch(`http://localhost:4001/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log(`🔍 GLOBAL SEARCH (Exact Keyword Substring):`);
    console.log(`   Tasks matched: ${globalRes.tasks?.length}`);
    if (globalRes.tasks?.length === 0) {
      console.log('   ❌ 0 results (the words do not appear verbatim in any task)');
    } else {
      globalRes.tasks.slice(0, 3).forEach(t => console.log(`   ✅ "${t.title}"`));
    }

    // 2. Semantic Search (Vector Embedding Cosine Similarity)
    const semanticRes = await fetch(`http://localhost:4001/api/search/semantic?q=${encodeURIComponent(q)}&limit=3`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log(`⟡ SEMANTIC SEARCH (Vector Cosine Similarity in PacificDB):`);
    console.log(`   Tasks matched: ${semanticRes.results?.length} (from ${semanticRes.totalVectors} vectors)`);
    semanticRes.results.slice(0, 3).forEach(t => {
      console.log(`   ⟡ [${(t._score * 100).toFixed(1)}% match] "${t.title || t._content}"`);
    });
  }
}

run().catch(console.error);
