import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../lib/context';

const NAV_ITEMS = [
  { path: '/', icon: '⬡', label: 'Dashboard' },
  { path: '/projects', icon: '◈', label: 'Projects' },
  { path: '/board', icon: '▦', label: 'Kanban Board' },
  { path: '/chat', icon: '◉', label: 'Team Chat' },
  { path: '/files', icon: '◫', label: 'Files' },
  { path: '/search', icon: '◎', label: 'Global Search' },
  { path: '/semantic', icon: '⟡', label: 'Semantic Search' },
];

const ADMIN_ITEMS = [
  { path: '/admin', icon: '◈', label: 'Test Dashboard' },
];

export function Sidebar() {
  const { user, workspace, workspaces, setWorkspace, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [wsPickerOpen, setWsPickerOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">P</div>
        <span className="sidebar-logo-name">PacificBoard</span>
      </div>

      {workspace && (
        <div className="sidebar-workspace" style={{ position: 'relative' }}>
          <div className="sidebar-workspace-label">Workspace</div>
          <div
            className="sidebar-workspace-name"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            onClick={() => setWsPickerOpen(!wsPickerOpen)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workspace.name}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', flexShrink: 0 }}>▾</span>
          </div>
          {wsPickerOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--radius)',
              zIndex: 200,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}>
              {workspaces.map(ws => (
                <div
                  key={ws._id}
                  onClick={() => { setWorkspace(ws); setWsPickerOpen(false); }}
                  style={{
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    background: ws._id === workspace._id ? 'var(--surface-3)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                  className="hover-surface"
                >
                  {ws.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <div
            key={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ fontSize: '1rem', width: '16px', textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        <div className="sidebar-section-label">Admin</div>
        {ADMIN_ITEMS.map(item => (
          <div
            key={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{ borderColor: isActive(item.path) ? 'rgba(34,211,238,0.3)' : 'transparent' }}
          >
            <span style={{ fontSize: '1rem', width: '16px', textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
            {isActive(item.path) && (
              <span style={{ marginLeft: 'auto', fontSize: '0.6rem' }}>
                <span className="live-dot" />
              </span>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-pill" onClick={logout} title="Click to logout">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
              alt={user.name}
              className="avatar"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-pill-name">{user.name}</div>
              <div className="user-pill-email truncate">{user.email}</div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>⏻</span>
          </div>
        )}
      </div>
    </aside>
  );
}
