import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

interface Project {
  _id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  createdAt: string;
}

const PROJECT_COLORS = [
  '#22d3ee', '#3b82f6', '#8b5cf6', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
];

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderLeft: `3px solid ${project.color || '#3b82f6'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.borderColor = project.color || '#3b82f6';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.borderColor = '';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: project.color || '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 800, color: '#030712',
          }}
        >
          {project.name[0]?.toUpperCase()}
        </div>
        <span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
          {project.status}
        </span>
      </div>
      <h4 style={{ marginBottom: '0.375rem' }}>{project.name}</h4>
      {project.description && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {project.description}
        </p>
      )}
      <div style={{ marginTop: '0.875rem', fontSize: '0.68rem', color: 'var(--text-4)' }}>
        Created {new Date(project.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

export function Projects() {
  const { workspace } = useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: PROJECT_COLORS[0] });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const p = await api.listProjects(workspace._id);
      setProjects(p as Project[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspace]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setCreating(true);
    try {
      await api.createProject({ workspaceId: workspace._id, ...form });
      addToast('Project created!', 'success');
      setShowCreate(false);
      setForm({ name: '', description: '', color: PROJECT_COLORS[0] });
      load();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Projects</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            {projects.length} projects in {workspace?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="search-input-wrap" style={{ width: 220 }}>
            <span className="search-input-icon" style={{ fontSize: '0.8rem' }}>◎</span>
            <input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 34 }}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + New Project
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">{search ? 'No matching projects' : 'No projects yet'}</div>
            <div className="empty-state-desc">Create your first project to start organizing tasks.</div>
            {!search && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map((p, i) => (
              <div key={p._id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <ProjectCard
                  project={p}
                  onClick={() => navigate(`/board?projectId=${p._id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Project</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Project Name</label>
                <input
                  placeholder="e.g. Backend API, Mobile App..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required autoFocus
                />
              </div>
              <div>
                <label>Description</label>
                <textarea
                  placeholder="What is this project about?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label>Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {PROJECT_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 28, height: 28,
                        borderRadius: 6,
                        background: c,
                        cursor: 'pointer',
                        border: form.color === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
