async function test() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const res = await fetch('http://localhost:4001/api/search/semantic?q=' + encodeURIComponent('user permissions and security') + '&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=5', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());

  console.log(`Query: "${res.query}"`);
  console.log(`Vectors searched: ${res.vectors_searched}`);
  console.log(`Total results: ${res.results?.length}\n`);

  res.results.forEach((r, idx) => {
    console.log(`Rank ${idx + 1}: [${(r.similarity * 100).toFixed(1)}% similarity] ${r.title}`);
    console.log(`        Desc: ${r.description}`);
    console.log(`        ID:   ${r.id}`);
  });
}

test().catch(console.error);
