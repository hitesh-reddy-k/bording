async function test() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const queries = [
    'user permissions and security',
    'payment bugs and billing webhook',
    'database performance and query optimization',
    'drag and drop Kanban board',
    'Raft consensus cluster monitoring'
  ];

  for (const q of queries) {
    const res = await fetch(`http://localhost:4001/api/search/semantic?q=${encodeURIComponent(q)}&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=3`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log(`\nQuery: "${q}" (${res.results?.length} results from ${res.vectors_searched} vectors)`);
    res.results.forEach((r, idx) => {
      console.log(`  Rank ${idx + 1}: [${(r.similarity * 100).toFixed(1)}%] ${r.title}`);
    });
  }
}

test().catch(console.error);
