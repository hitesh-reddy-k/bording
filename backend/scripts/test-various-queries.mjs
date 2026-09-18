async function run() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pacific.io', password: 'password123' })
  }).then(r => r.json());
  const token = loginRes.token;

  const queries = [
    // 1. Disaster recovery & backup
    "disaster recovery and snapshot restore",
    // 2. Network socket leak & connection pool
    "connection pool leak and socket exhaustion",
    // 3. Slack/Discord alerting integrations
    "send slack alerts and external notification endpoints",
    // 4. UI shortcuts and dark theme
    "keyboard navigation shortcuts and dark theme",
    // 5. Team messaging and image uploads
    "team messaging channel and file attachment sharing",
    // 6. Cluster fault tolerance and partition simulation
    "simulate node crash and network partition failover",
    // 7. Onboarding guide for new employees
    "guide new team members through the product tutorial"
  ];

  for (const q of queries) {
    const res = await fetch('http://localhost:4001/api/search/semantic?q=' + encodeURIComponent(q) + '&workspaceId=a291450f-ff37-4241-b7c2-ac24486a12d1&limit=3', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log('================================================================');
    console.log(`QUERY: "${q}"`);
    console.log(`Vectors searched: ${res.vectors_searched}`);
    if (!res.results || res.results.length === 0) {
      console.log('No results found.');
    } else {
      res.results.forEach((r, i) => {
        console.log(`  Rank ${i + 1}: [${(r.similarity * 100).toFixed(1)}%] ${r.title}`);
        console.log(`          ${r.description}`);
      });
    }
  }
}

run().catch(console.error);
