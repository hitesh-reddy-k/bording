import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/context';
import { api } from '../lib/api';

const EXAMPLE_QUERIES = [
  'find tasks related to payment bugs',
  'authentication and login issues',
  'performance optimization database',
  'UI design and user experience',
  'API integration errors',
  'deploy infrastructure issues',
];

export function SemanticSearch() {
  const { workspace } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);

  const search = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setQuery(q);
    try {
      const r = await api.semanticSearch(q, workspace?._id, limit);
      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">⟡ Semantic Search</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            Vector similarity search · {results?.totalVectors?.toLocaleString() ?? '—'} vectors indexed in PacificDB
          </p>
        </div>
      </div>

      <div className="page-body">
        {/* Search bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <span className="search-input-icon">⟡</span>
              <input
                placeholder='e.g. "find tasks related to payment bugs"'
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                style={{ fontSize: '1rem', padding: '0.75rem 1rem 0.75rem 2.5rem' }}
                autoFocus
              />
            </div>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ width: 110 }}
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={() => search()}
              disabled={loading || !query.trim()}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '⟡ Search'}
            </button>
          </div>

          {/* Example queries */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', alignSelf: 'center' }}>Try:</span>
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', border: '1px solid var(--border)' }}
                onClick={() => search(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* How it works */}
        {!results && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { icon: '▣', title: 'Task Embeddings', desc: 'Every task title and description is converted to a 384-dimensional vector and stored in PacificDB' },
              { icon: '◎', title: 'Cosine Similarity', desc: 'Your query is embedded and compared against all stored vectors using cosine similarity' },
              { icon: '⟡', title: 'Semantic Matching', desc: '"payment bugs" finds "checkout error" even without exact keyword matches' },
              { icon: '⚡', title: 'Real-time Index', desc: 'New tasks are embedded and indexed immediately — search is always up to date' },
            ].map(item => (
              <div key={item.title} className="card">
                <div style={{ fontSize: '1.5rem', marginBottom: '0.625rem' }}>{item.icon}</div>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.375rem' }}>{item.title}</h4>
                <p style={{ fontSize: '0.75rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center" style={{ minHeight: 200, flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ fontSize: '0.82rem' }}>Computing vector similarities across {results?.totalVectors?.toLocaleString() ?? 'all'} embeddings...</p>
          </div>
        )}

        {results && !loading && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              padding: '0.875rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              fontSize: '0.8rem',
            }}>
              <span style={{ color: 'var(--cyan)', fontSize: '1.1rem' }}>⟡</span>
              <span>
                Found <strong>{results.results.length}</strong> semantically similar tasks
                for "<strong style={{ color: 'var(--cyan)' }}>{results.query}</strong>"
                · Searched {results.totalVectors?.toLocaleString()} vectors
              </span>
            </div>

            {results.results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No similar tasks found</div>
                <div className="empty-state-desc">
                  Create more tasks to build up the vector index. Currently {results.totalVectors} vectors indexed.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {results.results.map((task: any, i: number) => (
                  <div
                    key={task._id}
                    className="card animate-fade-in"
                    style={{
                      animationDelay: `${i * 40}ms`,
                      cursor: 'pointer',
                      padding: '0.875rem 1rem',
                      borderLeft: `3px solid hsl(${(1 - task._score) * 120}, 70%, 50%)`,
                    }}
                    onClick={() => navigate(`/board?projectId=${task.projectId}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>{task.title}</div>
                        {task.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <span className={`badge priority-${task.priority}`}>{task.priority}</span>
                          <span className={`badge status-${task.status}`}>{task.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          fontFamily: 'JetBrains Mono',
                          color: `hsl(${task._score * 120}, 70%, 60%)`,
                        }}>
                          {(task._score * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>similarity</div>
                      </div>
                    </div>
                    <div style={{
                      marginTop: '0.625rem',
                      height: 3,
                      background: 'var(--surface-2)',
                      borderRadius: 2,
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${task._score * 100}%`,
                        background: `hsl(${task._score * 120}, 70%, 50%)`,
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
