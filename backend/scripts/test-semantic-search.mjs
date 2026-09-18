async function test() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());

  const token = loginRes.token;
  console.log('Logged in successfully, user:', loginRes.user?.name);

  const queries = [
    'payment bugs',
    'authentication and login issues',
    'Raft consensus monitoring',
    'database performance optimization',
    'drag and drop Kanban board'
  ];

  for (const q of queries) {
    const t0 = Date.now();
    const res = await fetch(`http://localhost:4001/api/search/semantic?q=${encodeURIComponent(q)}&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=3`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    const elapsed = Date.now() - t0;
    console.log(`\nQuery: "${q}" (${elapsed}ms, ${res.results?.length} matches, ${res.totalVectors} vectors indexed)`);
    (res.results || []).slice(0, 3).forEach((r, i) => {
      console.log(`  [${(r._score * 100).toFixed(1)}%] ${r.title || r._content}`);
    });
  }
}

test().catch(console.error);
