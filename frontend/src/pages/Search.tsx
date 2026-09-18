import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/context';
import { api } from '../lib/api';

interface SearchResults {
  tasks: any[];
  projects: any[];
  comments: any[];
}

export function Search() {
  const { workspace } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('all');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await api.search(query, workspace?._id, type);
      setResults(r as SearchResults);
    } finally {
      setLoading(false);
    }
  };

  const total = results ? results.tasks.length + results.projects.length + results.comments.length : 0;

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Global Search</h2>
      </div>
      <div className="page-body">
        <form onSubmit={search} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <span className="search-input-icon">◎</span>
              <input
                placeholder="Search tasks, projects, comments..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
                style={{ fontSize: '1rem', padding: '0.75rem 1rem 0.75rem 2.5rem' }}
              />
            </div>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: 130 }}>
              <option value="all">All types</option>
              <option value="tasks">Tasks</option>
              <option value="projects">Projects</option>
              <option value="comments">Comments</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Search'}
            </button>
          </div>
        </form>

        {results === null ? (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">Search across your workspace</div>
            <div className="empty-state-desc">Find tasks, projects, and comments instantly using PacificDB indexes.</div>
          </div>
        ) : total === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No results for "{query}"</div>
            <div className="empty-state-desc">Try different keywords or use Semantic Search for related results.</div>
            <button className="btn btn-ghost" onClick={() => navigate('/semantic')}>
              Try Semantic Search →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
              {total} results for "<strong style={{ color: 'var(--text)' }}>{query}</strong>"
            </div>

            {results.tasks.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>▣ Tasks</span>
                  <span className="badge badge-blue">{results.tasks.length}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {results.tasks.map(t => (
                    <div
                      key={t._id}
                      className="card"
                      style={{ cursor: 'pointer', padding: '0.875rem' }}
                      onClick={() => navigate(`/board?projectId=${t.projectId}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`badge priority-${t.priority}`}>{t.priority}</span>
                        <span className={`badge status-${t.status}`}>{t.status.replace('_', ' ')}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>{t.title}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>→</span>
                      </div>
                      {t.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.projects.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>◈ Projects</span>
                  <span className="badge badge-violet">{results.projects.length}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {results.projects.map(p => (
                    <div
                      key={p._id}
                      className="card"
                      style={{ cursor: 'pointer', padding: '0.875rem', borderLeft: `3px solid ${p.color || '#3b82f6'}` }}
                      onClick={() => navigate(`/board?projectId=${p._id}`)}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{p.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.comments.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>◍ Comments</span>
                  <span className="badge badge-gray">{results.comments.length}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {results.comments.map(c => (
                    <div key={c._id} className="card" style={{ padding: '0.875rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
                        Comment by {c.authorId?.slice(0, 8) || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
