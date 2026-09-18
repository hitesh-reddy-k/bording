import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

interface AdminStats {
  counts: { users: number; projects: number; tasks: number; messages: number; vectors: number; files: number };
  performance: { opsPerSecond: number; totalOps: number; p50: number; p95: number; p99: number; errorCount: number; opHistory: number[] };
  simulator: { running: boolean; userCount: number; targetUserCount: number; uptime: number };
  replication: { nodes: number; healthyNodes: number; status: string; lag: string };
  chaosTests: { leaderFailover: string; followerRecovery: string; backup: string; restore: string; dataIntegrity: string };
}


const USER_LEVELS = [100, 500, 1000, 5000];

function TestBadge({ status }: { status: string }) {
  const cls = status === 'PASS' ? 'test-pass'
    : status === 'FAIL' ? 'test-fail'
    : status === 'RUNNING' ? 'test-running'
    : 'test-pending';

  const icon = status === 'PASS' ? '✓'
    : status === 'FAIL' ? '✗'
    : status === 'RUNNING' ? '⟳'
    : '○';

  return (
    <span className={`test-status ${cls}`}>
      {status === 'RUNNING' && <span className="animate-spin" style={{ display: 'inline-block' }}>{icon}</span>}
      {status !== 'RUNNING' && icon} {status}
    </span>
  );
}

function Sparkline({ data, max }: { data: number[]; max: number }) {
  if (!data.length) return null;
  const h = 56;
  const w = 260;
  const pts = data.slice(-30);
  const m = Math.max(max, ...pts, 1);
  const points = pts.map((v, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * w;
    const y = h - (v / m) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} style={{ width: '100%', height: h }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && (
        <>
          <polyline
            points={points}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon
            points={`0,${h} ${points} ${w},${h}`}
            fill="url(#sparkGrad)"
          />
        </>
      )}
    </svg>
  );
}

export function AdminDashboard() {
  const { workspace } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetUsers, setTargetUsers] = useState(100);
  const [chaosLoading, setChaosLoading] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedForm, setSeedForm] = useState({ tasks: 100, messages: 500, projects: 10, users: 50 });
  const [opsDelta, setOpsDelta] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inFlightRef = useRef(false);

  const fetchStats = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const s = await api.getAdminStats() as AdminStats;
      setStats(prev => {
        if (prev) {
          setOpsDelta(s.performance.opsPerSecond - prev.performance.opsPerSecond);
        }
        return s;
      });
    } catch (_err) {
      // Silently ignore - shows when backend is not available
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [logPath, setLogPath] = useState<string>('');
  const [logSizeMb, setLogSizeMb] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<string>('');
  const [tailCount, setTailCount] = useState<number>(100);
  const [logPaused, setLogPaused] = useState<boolean>(false);
  const logTerminalRef = useRef<HTMLDivElement | null>(null);

  const fetchEngineLogs = async () => {
    if (logPaused) return;
    try {
      const res = await api.getEngineLogs(tailCount) as any;
      if (res && res.lines) {
        setEngineLogs(res.lines);
        if (res.path) setLogPath(res.path);
        if (res.sizeMb !== undefined) setLogSizeMb(res.sizeMb);
      }
    } catch (_e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchEngineLogs();
    const logInterval = setInterval(fetchEngineLogs, 2500);
    return () => clearInterval(logInterval);
  }, [logPaused, tailCount]);

  useEffect(() => {
    if (autoScroll && logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [engineLogs, autoScroll]);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const startSim = async () => {
    try {
      if (stats?.simulator.running) {
        await api.scaleSimulator(targetUsers);
        addToast(`Scaling to ${targetUsers} users...`, 'info');
      } else {
        await api.startSimulator(targetUsers);
        addToast(`Load simulator started with ${targetUsers} users`, 'success');
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const stopSim = async () => {
    try {
      await api.stopSimulator();
      addToast('Load simulator stopped', 'info');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const runChaos = async (name: string, fn: () => Promise<any>, label: string) => {
    setChaosLoading(name);
    try {
      const result = await fn();
      addToast(`${label}: ${JSON.stringify(result).slice(0, 60)}`, 'info');
    } catch (err: any) {
      addToast(`${label} failed: ${err.message}`, 'error');
    } finally {
      setChaosLoading(null);
    }
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const result = await api.seedData({ ...seedForm, workspaceId: workspace?._id }) as any;
      addToast(`Seeded: ${result.tasks} tasks, ${result.messages} messages into ${workspace ? workspace.name : 'PacificDB'}`, 'success');
      fetchStats();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const s = stats;
  const opsPerSec = s?.performance.opsPerSecond ?? 0;
  const p50 = s?.performance.p50 ?? 0;
  const p95 = s?.performance.p95 ?? 0;
  const p99 = s?.performance.p99 ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h2 className="page-title">PacificDB Test Dashboard</h2>
            <span className={`live-dot ${loading ? 'live-dot-warn' : ''}`} />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            Real-time stress test · {s?.simulator.running ? (
              <span style={{ color: 'var(--green)' }}>
                ● Simulator running — {s.simulator.userCount} concurrent bots
              </span>
            ) : (
              <span style={{ color: 'var(--text-4)' }}>○ Simulator idle</span>
            )}
          </p>
        </div>
      </div>

      <div className="page-body">
        {/* ── Dataset ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
            Dataset
          </div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {[
              { label: 'Users', value: s?.counts.users, accent: 'var(--cyan)', icon: '◉' },
              { label: 'Projects', value: s?.counts.projects, accent: 'var(--blue)', icon: '◈' },
              { label: 'Tasks', value: s?.counts.tasks, accent: 'var(--violet)', icon: '▣' },
              { label: 'Messages', value: s?.counts.messages, accent: 'var(--green)', icon: '◍' },
              { label: 'Vectors', value: s?.counts.vectors, accent: 'var(--orange)', icon: '⟡' },
              { label: 'Files', value: s?.counts.files, accent: 'var(--pink)', icon: '◫' },
            ].map(item => (
              <div key={item.label} className="stat-card" style={{ '--accent': `linear-gradient(90deg, ${item.accent}, transparent)` } as any}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="stat-label">{item.label}</div>
                  <span style={{ color: item.accent, fontSize: '0.9rem' }}>{item.icon}</span>
                </div>
                <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                  {loading ? '—' : (item.value ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* ── Performance ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4>Performance</h4>
              {s?.simulator.running && <span className="live-dot" />}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginBottom: '0.25rem' }}>Operations / sec</div>
              <div className="ops-counter">{opsPerSec.toLocaleString()}</div>
              {opsDelta !== 0 && (
                <div style={{ fontSize: '0.72rem', color: opsDelta > 0 ? 'var(--green)' : 'var(--red)', marginTop: '0.25rem' }}>
                  {opsDelta > 0 ? '↑' : '↓'} {Math.abs(opsDelta).toLocaleString()} ops/s
                </div>
              )}
            </div>

            <Sparkline data={s?.performance.opHistory ?? []} max={20000} />

            <div style={{ marginTop: '1rem' }}>
              <div className="latency-grid">
                {[
                  { label: 'p50', value: p50 },
                  { label: 'p95', value: p95 },
                  { label: 'p99', value: p99 },
                ].map(l => (
                  <div key={l.label} className="latency-stat">
                    <div className="latency-label">{l.label}</div>
                    <div className="latency-value">{Math.round(l.value)}</div>
                    <div className="latency-unit">ms</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '0.875rem', padding: '0.625rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: '0.75rem' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-3)' }}>Total ops</span>
                <span className="font-mono" style={{ color: 'var(--cyan)' }}>{(s?.performance.totalOps ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ color: 'var(--text-3)' }}>Errors</span>
                <span className="font-mono" style={{ color: (s?.performance.errorCount ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {s?.performance.errorCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ color: 'var(--text-3)' }}>Uptime</span>
                <span className="font-mono" style={{ color: 'var(--text-2)' }}>
                  {s?.simulator.uptime ? `${s.simulator.uptime}s` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Replication + Tests ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <h4 style={{ marginBottom: '0.875rem' }}>Replication</h4>
              <div>
                {[
                  { label: 'Replica nodes', value: `${s?.replication.healthyNodes ?? 3}/${s?.replication.nodes ?? 3}` },
                  { label: 'Replication', value: s?.replication.status ?? 'Healthy' },
                  { label: 'Lag', value: s?.replication.lag ?? '0ms' },
                ].map(row => (
                  <div key={row.label} className="metric-row">
                    <span className="metric-label">{row.label}</span>
                    <span className="metric-value" style={{
                      color: row.value === 'Healthy' ? 'var(--green)' :
                        row.value === 'Degraded' ? 'var(--orange)' :
                        row.value === 'Electing Leader' ? 'var(--orange)' : 'var(--cyan)',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
                {Array.from({ length: s?.replication.nodes ?? 3 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: i < (s?.replication.healthyNodes ?? 3) ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${i < (s?.replication.healthyNodes ?? 3) ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 'var(--radius)',
                      textAlign: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Node {i + 1}</div>
                    <div className={i < (s?.replication.healthyNodes ?? 3) ? 'live-dot' : 'live-dot-red'} style={{ display: 'inline-block' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginBottom: '0.875rem' }}>Chaos Test Results</h4>
              {[
                { label: 'Leader Failover', key: 'leaderFailover' },
                { label: 'Follower Recovery', key: 'followerRecovery' },
                { label: 'Backup', key: 'backup' },
                { label: 'Restore', key: 'restore' },
                { label: 'Data Integrity', key: 'dataIntegrity' },
              ].map(row => (
                <div key={row.key} className="metric-row">
                  <span className="metric-label">{row.label}</span>
                  <TestBadge status={(s?.chaosTests as any)?.[row.key] ?? 'PENDING'} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Load Simulator ── */}
        <div className="card mb-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h4>Load Simulator</h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={stopSim}
                disabled={!s?.simulator.running}
              >
                ■ Stop
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={startSim}
              >
                {s?.simulator.running ? `Scale to ${targetUsers}` : `▶ Start (${targetUsers} users)`}
              </button>
            </div>
          </div>

          {/* User count slider */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ textTransform: 'none', fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>
                Concurrent Users
              </label>
              <span style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '1.1rem',
                fontWeight: 800,
                color: 'var(--cyan)',
              }}>
                {targetUsers.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={5000}
              step={10}
              value={targetUsers}
              onChange={e => setTargetUsers(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              {USER_LEVELS.map(level => (
                <button
                  key={level}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem' }}
                  onClick={() => setTargetUsers(level)}
                >
                  {level.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Current status */}
          {s?.simulator.running && (
            <div style={{
              padding: '0.875rem',
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 'var(--radius)',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>Active bots</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--green)' }}>
                    {s.simulator.userCount}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>Target</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                    {s.simulator.targetUserCount}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>Uptime</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                    {s.simulator.uptime}s
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bot operations */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
            <div style={{ marginBottom: '0.375rem', color: 'var(--text-3)', fontWeight: 600 }}>Bot Operations:</div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {['create_task', 'update_task', 'comment', 'send_message', 'upload_attachment', 'search', 'vector_search', 'read_dashboard'].map(op => (
                <span key={op} style={{
                  padding: '0.2rem 0.5rem',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.68rem',
                  color: s?.simulator.running ? 'var(--cyan)' : 'var(--text-4)',
                  animation: s?.simulator.running ? 'pulse 2s infinite' : 'none',
                  animationDelay: `${Math.random() * 2}s`,
                }}>
                  {op}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chaos Tests ── */}
        <div className="card mb-4">
          <h4 style={{ marginBottom: '1rem' }}>Chaos Engineering Controls</h4>
          <div className="chaos-grid">
            {[
              { id: 'kill-replica', label: 'Kill Replica', desc: 'Terminate a follower node. App continues, follower recovers.', fn: api.chaosKillReplica, icon: '☠' },
              { id: 'kill-leader', label: 'Kill Leader', desc: 'Trigger leader election. Observes failover time.', fn: api.chaosKillLeader, icon: '⚡' },
              { id: 'backup', label: 'Run Backup', desc: 'Full backup while writes continue. Verifies consistency.', fn: api.chaosBackup, icon: '◫' },
              { id: 'restore', label: 'Test Restore', desc: 'Restore from backup, verify record counts & integrity.', fn: api.chaosRestore, icon: '↺' },
              { id: 'integrity', label: 'Data Integrity', desc: 'Verify all records, orphan detection, checksum check.', fn: api.chaosDataIntegrity, icon: '✓' },
            ].map(chaos => (
              <button
                key={chaos.id}
                className="chaos-btn"
                onClick={() => runChaos(chaos.id, chaos.fn, chaos.label)}
                disabled={chaosLoading !== null}
              >
                <span className="chaos-btn-icon" style={{ color: 'var(--red)' }}>
                  {chaosLoading === chaos.id ? <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span> : chaos.icon}
                </span>
                <span className="chaos-btn-name">{chaos.label}</span>
                <span className="chaos-btn-desc">{chaos.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Seed Data ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0 }}>Seed Test Data</h4>
            {workspace && (
              <span style={{ fontSize: '0.75rem', color: 'var(--cyan)', background: 'rgba(34,211,238,0.1)', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid rgba(34,211,238,0.2)' }}>
                Target: {workspace.name}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', marginBottom: '1rem' }}>
            Generate synthetic tasks, messages, and vector embeddings directly in PacificDB for this workspace.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { key: 'projects', label: 'Projects', max: 1000 },
              { key: 'tasks', label: 'Tasks', max: 10000 },
              { key: 'messages', label: 'Messages', max: 50000 },
              { key: 'users', label: 'Users', max: 5000 },
            ].map(f => (
              <div key={f.key}>
                <label>{f.label}</label>
                <input
                  type="number"
                  min={1}
                  max={f.max}
                  value={(seedForm as any)[f.key]}
                  onChange={e => setSeedForm(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={seedData}
            disabled={seeding}
          >
            {seeding ? (
              <><span className="spinner" style={{ width: 14, height: 14 }} /> Seeding...</>
            ) : (
              '⚡ Generate Dataset'
            )}
          </button>
        </div>

        {/* ── Live PacificDB db_engine.exe Logs ── */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <h4 style={{ margin: 0 }}>Live PacificDB Engine Logs (`db_engine.exe`)</h4>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: 999,
                background: logPaused ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: logPaused ? '#ef4444' : '#10b981',
                border: `1px solid ${logPaused ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: logPaused ? '#ef4444' : '#10b981' }} />
                {logPaused ? 'PAUSED' : 'STREAMING (every 2.5s)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {logPath && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {logSizeMb} MB · {logPath.slice(-35)}
                </span>
              )}
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                onClick={() => setLogPaused(p => !p)}
              >
                {logPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                onClick={() => setAutoScroll(s => !s)}
              >
                {autoScroll ? '✓ Auto-scroll' : 'Auto-scroll Off'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                onClick={() => {
                  navigator.clipboard.writeText(engineLogs.join('\n'));
                  addToast('Logs copied to clipboard!', 'success');
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Filter logs (e.g. MEMORY, LSM, connection, BUSY)..."
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              style={{ flex: 1, fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
            />
            <select
              value={tailCount}
              onChange={e => setTailCount(Number(e.target.value))}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', width: 'auto' }}
            >
              <option value={50}>Last 50 lines</option>
              <option value={100}>Last 100 lines</option>
              <option value={200}>Last 200 lines</option>
              <option value={500}>Last 500 lines</option>
            </select>
          </div>

          <div
            ref={logTerminalRef}
            style={{
              backgroundColor: '#0a0f1d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              height: '320px',
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.73rem',
              lineHeight: 1.55,
            }}
          >
            {engineLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                Fetching live engine logs...
              </div>
            ) : (
              engineLogs
                .filter(l => !logFilter || l.toLowerCase().includes(logFilter.toLowerCase()))
                .map((line, idx) => {
                  let color = '#94a3b8';
                  if (line.includes('READ_ONLY_EMERGENCY') || line.includes('ERROR') || line.includes('PRESSURE') || line.includes('timed out')) {
                    color = '#f87171'; // red
                  } else if (line.includes('BUSY') || line.includes('PRESSURE')) {
                    color = '#fbbf24'; // amber
                  } else if (line.includes('NORMAL') || line.includes('OK') || line.includes('completed')) {
                    color = '#34d399'; // green
                  } else if (line.includes('[MEMORY]') || line.includes('[MEMORY_MONITOR]')) {
                    color = '#38bdf8'; // sky cyan
                  } else if (line.includes('[LSM]') || line.includes('[WAL]')) {
                    color = '#a78bfa'; // purple
                  } else if (line.includes('client_connected') || line.includes('client_disconnected')) {
                    color = '#64748b'; // slate
                  }

                  return (
                    <div key={idx} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', userSelect: 'none', marginRight: '0.5rem' }}>
                        {(idx + 1).toString().padStart(3, ' ')}
                      </span>
                      {line}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* ── Terminal log ── */}
        {s?.simulator.running && (
          <div className="terminal mt-4" style={{ marginTop: '1rem' }}>
            <div className="terminal-header">
              <span className="terminal-dot terminal-dot-red" />
              <span className="terminal-dot terminal-dot-yellow" />
              <span className="terminal-dot terminal-dot-green" />
              <span style={{ marginLeft: '0.5rem' }}>PacificDB Load Test Terminal</span>
              <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '0.68rem' }}>● RUNNING</span>
            </div>
            <div className="terminal-body" style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', lineHeight: 1.8 }}>
              <div style={{ color: '#7ee7b8' }}>$ pacificboard load-test --users {s.simulator.userCount} --ops mixed</div>
              <div style={{ color: '#64b8a8' }}>→ ops/sec: <span style={{ color: '#22d3ee' }}>{opsPerSec.toLocaleString()}</span></div>
              <div style={{ color: '#64b8a8' }}>→ p50: <span style={{ color: '#22d3ee' }}>{Math.round(p50)}ms</span> | p95: <span style={{ color: '#22d3ee' }}>{Math.round(p95)}ms</span> | p99: <span style={{ color: '#22d3ee' }}>{Math.round(p99)}ms</span></div>
              <div style={{ color: '#64b8a8' }}>→ total ops: <span style={{ color: '#22d3ee' }}>{(s?.performance.totalOps ?? 0).toLocaleString()}</span></div>
              <div style={{ color: '#64b8a8' }}>→ replication: <span style={{ color: s.replication.status === 'Healthy' ? '#10b981' : '#f59e0b' }}>{s.replication.status} ({s.replication.healthyNodes}/{s.replication.nodes} nodes)</span></div>
              <div style={{ color: '#7ee7b8', opacity: 0.5 }}>
                <span style={{ animation: 'blink 1s infinite', display: 'inline-block' }}>▌</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
