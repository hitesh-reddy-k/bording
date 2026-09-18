const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001';

function getToken() {
  return localStorage.getItem('pb_token');
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data: { name: string; email: string; password: string }) =>
    request('POST', '/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    request('POST', '/api/auth/login', data),
  me: () => request('GET', '/api/auth/me'),

  // Workspaces
  listWorkspaces: () => request('GET', '/api/workspaces'),
  createWorkspace: (name: string) => request('POST', '/api/workspaces', { name }),
  getWorkspace: (id: string) => request('GET', `/api/workspaces/${id}`),
  getWorkspaceStats: (id: string) => request('GET', `/api/workspaces/${id}/stats`),
  getWorkspaceActivity: (id: string, limit = 20) =>
    request('GET', `/api/workspaces/${id}/activity?limit=${limit}`),
  inviteMember: (wsId: string, email: string, role: string) =>
    request('POST', `/api/workspaces/${wsId}/invite`, { email, role }),

  // Projects
  listProjects: (workspaceId: string) =>
    request('GET', `/api/projects?workspaceId=${workspaceId}`),
  createProject: (data: { workspaceId: string; name: string; description?: string; color?: string }) =>
    request('POST', '/api/projects', data),
  updateProject: (id: string, data: Partial<{ name: string; description: string; color: string; status: string }>) =>
    request('PATCH', `/api/projects/${id}`, data),
  deleteProject: (id: string) => request('DELETE', `/api/projects/${id}`),

  // Tasks
  listTasks: (params: { projectId?: string; workspaceId?: string; status?: string; sortBy?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return request('GET', `/api/tasks?${q}`);
  },
  createTask: (data: {
    projectId: string; workspaceId: string; title: string;
    description?: string; priority?: string; status?: string;
    assigneeIds?: string[]; dueDate?: string | null; labels?: string[];
  }) => request('POST', '/api/tasks', data),
  getTask: (id: string) => request('GET', `/api/tasks/${id}`),
  updateTask: (id: string, data: Partial<{ title: string; description: string; priority: string; status: string; assigneeIds: string[]; dueDate: string | null; labels: string[] }>) =>
    request('PATCH', `/api/tasks/${id}`, data),
  deleteTask: (id: string) => request('DELETE', `/api/tasks/${id}`),

  // Comments
  listComments: (taskId: string) => request('GET', `/api/tasks/${taskId}/comments`),
  createComment: (taskId: string, content: string) =>
    request('POST', `/api/tasks/${taskId}/comments`, { content }),

  // Chat
  listChannels: (workspaceId: string) =>
    request('GET', `/api/chat/channels?workspaceId=${workspaceId}`),
  listMessages: (workspaceId: string, channelId: string, limit = 50) =>
    request('GET', `/api/chat/messages?workspaceId=${workspaceId}&channelId=${channelId}&limit=${limit}`),
  sendMessage: (workspaceId: string, channelId: string, content: string) =>
    request('POST', '/api/chat/messages', { workspaceId, channelId, content }),

  // Files
  listFiles: (workspaceId: string) =>
    request('GET', `/api/files?workspaceId=${workspaceId}`),
  deleteFile: (id: string) => request('DELETE', `/api/files/${id}`),
  uploadFile: async (workspaceId: string, file: File, taskId?: string) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);
    if (taskId) formData.append('taskId', taskId);
    const res = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  // Search
  search: (q: string, workspaceId?: string, type = 'all') =>
    request('GET', `/api/search?q=${encodeURIComponent(q)}${workspaceId ? `&workspaceId=${workspaceId}` : ''}&type=${type}`),
  semanticSearch: (q: string, workspaceId?: string, limit = 10) =>
    request('GET', `/api/search/semantic?q=${encodeURIComponent(q)}${workspaceId ? `&workspaceId=${workspaceId}` : ''}&limit=${limit}`),

  // Admin
  getAdminStats: () => request('GET', '/api/admin/stats'),
  startSimulator: (userCount: number) =>
    request('POST', '/api/admin/simulator/start', { userCount }),
  stopSimulator: () => request('POST', '/api/admin/simulator/stop'),
  scaleSimulator: (userCount: number) =>
    request('POST', '/api/admin/simulator/scale', { userCount }),
  chaosKillReplica: () => request('POST', '/api/admin/chaos/kill-replica'),
  chaosKillLeader: () => request('POST', '/api/admin/chaos/kill-leader'),
  chaosBackup: () => request('POST', '/api/admin/chaos/backup'),
  chaosRestore: () => request('POST', '/api/admin/chaos/restore'),
  chaosDataIntegrity: () => request('POST', '/api/admin/chaos/data-integrity'),
  seedData: (data: { users?: number; projects?: number; tasks?: number; messages?: number; workspaceId?: string }) =>
    request('POST', '/api/admin/seed', data),
  getEngineLogs: (tail = 100) =>
    request('GET', `/api/admin/engine-logs?tail=${tail}`),
};

export function setToken(token: string) {
  localStorage.setItem('pb_token', token);
}

export function clearToken() {
  localStorage.removeItem('pb_token');
}

export function hasToken() {
  return !!localStorage.getItem('pb_token');
}
