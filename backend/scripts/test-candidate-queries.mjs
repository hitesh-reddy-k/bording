async function test() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const candidateQueries = [
    'disaster recovery and snapshot restore',
    'network socket leak and connection pool',
    'slack integrations and external alerts',
    'dark theme styling and hotkeys',
    'team messaging and file sharing',
    'distributed replica failure and resilience testing',
    'guide new employees and product tour'
  ];

  for (const q of candidateQueries) {
    const res = await fetch(`http://localhost:4001/api/search/semantic?q=${encodeURIComponent(q)}&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=2`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log(`\nQuery: "${q}"`);
    if (!res.results || res.results.length === 0) {
      console.log('  No results');
    } else {
      res.results.forEach((r, idx) => {
        console.log(`  Rank ${idx + 1}: [${(r.similarity * 100).toFixed(1)}%] ${r.title}`);
        console.log(`          Desc: ${r.description}`);
      });
    }
  }
}

test().catch(console.error);
