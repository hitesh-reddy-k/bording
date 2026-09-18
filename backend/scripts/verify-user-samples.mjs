async function verify() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const samples = [
    'user permissions and security',
    'speed up database',
    'UI animations',
    'login issues'
  ];

  for (const q of samples) {
    console.log(`\n=== Testing query: "${q}" ===`);
    const g = await fetch(`http://localhost:4001/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());
    console.log(`Global Search (/search):   ${g.tasks?.length} matches`);

    const s = await fetch(`http://localhost:4001/api/search/semantic?q=${encodeURIComponent(q)}&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=2`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());
    console.log(`Semantic Search (/semantic): ${s.results?.length} matches -> Top match: "${s.results?.[0]?.title}" (${(s.results?.[0]?._score * 100).toFixed(1)}%)`);
  }
}

verify().catch(console.error);
