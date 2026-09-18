import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/context';
import { api } from '../lib/api';

interface Stats { memberCount: number; projectCount: number; taskCount: number; messageCount: number; }
interface Activity { _id: string; action: string; entityName: string; entityType: string; userId: string; createdAt: string; }

const ACTION_ICONS: Record<string, string> = {
  created_project: '◈',
  created_task: '▣',
  backup_completed: '◫',
  updated_task: '◉',
  default: '◦',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function Dashboard() {
  const { workspace } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      api.getWorkspaceStats(workspace._id),
      api.getWorkspaceActivity(workspace._id, 20),
    ]).then(([s, a]) => {
      setStats(s as Stats);
      setActivity(a as Activity[]);
    }).finally(() => setLoading(false));
  }, [workspace]);

  if (!workspace) return (
    <div className="empty-state">
      <div className="empty-state-icon">⬡</div>
      <div className="empty-state-title">No workspace selected</div>
      <div className="empty-state-desc">Create or join a workspace to get started</div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            {workspace.name} · {workspace.members?.length ?? 0} members
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
            + New Project
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid mb-6">
          {[
            { label: 'Members', value: stats?.memberCount ?? '—', icon: '◉', accent: 'var(--cyan)' },
            { label: 'Projects', value: stats?.projectCount ?? '—', icon: '◈', accent: 'var(--blue)' },
            { label: 'Tasks', value: stats?.taskCount ?? '—', icon: '▣', accent: 'var(--violet)' },
            { label: 'Messages', value: stats?.messageCount ?? '—', icon: '◍', accent: 'var(--green)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--accent': `linear-gradient(90deg, ${s.accent}, transparent)` } as any}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">
                {loading ? <span className="animate-pulse">—</span> : s.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          {/* Quick actions */}
          <div className="card">
            <h4 style={{ marginBottom: '1rem' }}>Quick Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Open Kanban Board', path: '/board', icon: '▦', desc: 'Manage task statuses' },
                { label: 'Team Chat', path: '/chat', icon: '◉', desc: 'Send a message' },
                { label: 'Upload Files', path: '/files', icon: '◫', desc: 'Share attachments' },
                { label: 'Semantic Search', path: '/semantic', icon: '⟡', desc: 'AI-powered task search' },
                { label: 'Test Dashboard', path: '/admin', icon: '◈', desc: 'Load simulator & chaos tests' },
              ].map(a => (
                <div
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ fontSize: '1.1rem', color: 'var(--cyan)' }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{a.desc}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-4)', fontSize: '0.75rem' }}>→</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="card">
            <h4 style={{ marginBottom: '1rem' }}>Recent Activity</h4>
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-desc">No activity yet. Create a project to get started.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                {activity.map((a, i) => (
                  <div key={a._id} className="animate-fade-in" style={{
                    animationDelay: `${i * 30}ms`,
                    display: 'flex',
                    gap: '0.625rem',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--cyan)', flexShrink: 0, marginTop: '0.1rem' }}>
                      {ACTION_ICONS[a.action] || ACTION_ICONS.default}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        <strong style={{ color: 'var(--text)' }}>{a.action.replace(/_/g, ' ')}</strong>
                        {a.entityName && <span> · {a.entityName}</span>}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>
                        {timeAgo(a.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
