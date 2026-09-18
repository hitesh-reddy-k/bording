/**
 * Full end-to-end API test for PacificBoard
 * Tests: Register → Login → Workspace → Project → Task → Comment → Search → Chat
 */

const BASE = 'http://localhost:4001/api';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

let pass = 0, fail = 0;
function ok(label) { console.log(`  ✅ ${label}`); pass++; }
function err(label, e) { console.log(`  ❌ ${label}: ${e.message}`); fail++; }

console.log('\n🚀 PacificBoard End-to-End API Tests\n');

// 1. Register
let token, userId, wsId, projId, taskId;
console.log('── Auth ──');
try {
  const r = await req('POST', '/auth/register', { name: 'E2E Test', email: `e2e${Date.now()}@test.io`, password: 'pass1234' });
  token = r.token;
  userId = r.user._id;
  ok(`Register → user ${userId.slice(0,8)}...`);
} catch (e) { err('Register', e); process.exit(1); }

// 2. Login
try {
  const email = `login${Date.now()}@test.io`;
  const r1 = await req('POST', '/auth/register', { name: 'Login Test', email, password: 'pass1234' });
  const r2 = await req('POST', '/auth/login', { email, password: 'pass1234' });
  ok(`Login → token ${r2.token.slice(0,20)}...`);
} catch (e) { err('Login', e); }

// 3. Get /me
try {
  const me = await req('GET', '/auth/me', null, token);
  ok(`/me → ${me.name} <${me.email}>`);
} catch (e) { err('/me', e); }

// 4. List workspaces (auto-created on register)
console.log('\n── Workspaces ──');
try {
  const wsList = await req('GET', '/workspaces', null, token);
  const ws = Array.isArray(wsList) ? wsList[0] : wsList;
  wsId = ws._id;
  ok(`List workspaces → "${ws.name}" (${wsId.slice(0,8)}...)`);
} catch (e) { err('List workspaces', e); process.exit(1); }

// 5. Workspace stats
try {
  const stats = await req('GET', `/workspaces/${wsId}/stats`, null, token);
  ok(`Workspace stats → ${stats.projectCount} projects, ${stats.taskCount} tasks`);
} catch (e) { err('Workspace stats', e); }

// 6. Create project
console.log('\n── Projects ──');
try {
  const proj = await req('POST', '/projects', { workspaceId: wsId, name: 'E2E Project', description: 'Test project' }, token);
  projId = proj._id;
  ok(`Create project → "${proj.name}" (${projId.slice(0,8)}...)`);
} catch (e) { err('Create project', e); process.exit(1); }

// 7. List projects
try {
  const projects = await req('GET', `/projects?workspaceId=${wsId}`, null, token);
  ok(`List projects → ${projects.length} project(s)`);
} catch (e) { err('List projects', e); }

// 8. Create tasks
console.log('\n── Tasks ──');
const statuses = ['todo', 'in_progress', 'done'];
for (const status of statuses) {
  try {
    const task = await req('POST', '/tasks', {
      projectId: projId,
      workspaceId: wsId,
      title: `Task ${status}`,
      description: `A ${status} task`,
      status,
      priority: 'medium',
    }, token);
    if (!taskId) taskId = task._id;
    ok(`Create task [${status}] → ${task._id.slice(0,8)}...`);
  } catch (e) { err(`Create task [${status}]`, e); }
}

// 9. List tasks
try {
  const tasks = await req('GET', `/tasks?projectId=${projId}`, null, token);
  ok(`List tasks → ${tasks.length} task(s)`);
} catch (e) { err('List tasks', e); }

// 10. Update task status
try {
  if (taskId) {
    const updated = await req('PATCH', `/tasks/${taskId}`, { status: 'in_progress' }, token);
    ok(`Update task status → ${updated.status || 'ok'}`);
  }
} catch (e) { err('Update task', e); }

// 11. Add comment to task
console.log('\n── Comments ──');
try {
  if (taskId) {
    const comment = await req('POST', `/tasks/${taskId}/comments`, { text: 'Great progress on this task!' }, token);
    ok(`Add comment → ${comment._id?.slice(0,8) || 'ok'}...`);
  }
} catch (e) { err('Add comment', e); }

// 12. Chat messages
console.log('\n── Chat ──');
try {
  const msg = await req('POST', '/chat/messages', { workspaceId: wsId, content: 'Hello from E2E test!' }, token);
  ok(`Send chat message → ${msg._id?.slice(0,8) || 'ok'}...`);
} catch (e) { err('Send chat message', e); }

try {
  const msgs = await req('GET', `/chat/messages?workspaceId=${wsId}`, null, token);
  ok(`List chat messages → ${msgs.length || msgs.messages?.length || 0} message(s)`);
} catch (e) { err('List chat messages', e); }

// 13. Search
console.log('\n── Search ──');
try {
  const results = await req('GET', `/search?q=E2E&workspaceId=${wsId}`, null, token);
  ok(`Search "E2E" → ${results.total || results.length || JSON.stringify(results).slice(0,50)}`);
} catch (e) { err('Search', e); }

// 14. Admin stats
console.log('\n── Admin ──');
try {
  const stats = await req('GET', '/admin/stats', null, token);
  ok(`Admin stats → p50=${stats.latencyP50 || stats.p50 || 'ok'}`);
} catch (e) { err('Admin stats', e); }

// Summary
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail === 0) {
  console.log('🎉 All tests passed!');
} else {
  console.log(`⚠️  ${fail} test(s) need attention`);
}
