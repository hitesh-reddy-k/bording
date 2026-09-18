import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeIds?: string[];
  labels?: string[];
  dueDate?: string;
  projectId: string;
}

interface Project { _id: string; name: string; color: string; }

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: '#64748b' },
  { id: 'todo', label: 'To Do', color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'review', label: 'Review', color: '#8b5cf6' },
  { id: 'done', label: 'Done', color: '#10b981' },
];

const PRIORITY_ICONS: Record<string, string> = {
  low: '▽', medium: '◇', high: '△', urgent: '⚠',
};

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="task-card"
      draggable
      onDragStart={e => { e.dataTransfer.setData('taskId', task._id); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onClick={onClick}
      style={{ opacity: dragging ? 0.5 : 1 }}
    >
      {task.labels && task.labels.length > 0 && (
        <div className="task-card-labels">
          {task.labels.slice(0, 3).map(l => (
            <span key={l} className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '0.1rem 0.375rem' }}>{l}</span>
          ))}
        </div>
      )}
      <div className="task-card-title">{task.title}</div>
      <div className="task-card-meta">
        <span className={`badge priority-${task.priority}`} style={{ fontSize: '0.62rem' }}>
          {PRIORITY_ICONS[task.priority]} {task.priority}
        </span>
        {task.dueDate && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>
            📅 {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { workspace } = useApp();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState('todo');
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });
  const [creating, setCreating] = useState(false);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [taskLimit, setTaskLimit] = useState(200);

  // Load projects
  useEffect(() => {
    if (!workspace) return;
    api.listProjects(workspace._id).then(p => {
      const projList = (p || []) as Project[];
      setProjects(projList);
      if (projList.length > 0) {
        const stillValid = projList.some(pr => pr._id === selectedProject);
        if (!stillValid || !selectedProject) {
          setSelectedProject(projList[0]._id);
        }
      } else {
        setSelectedProject('');
      }
    });
  }, [workspace]);

  // Load tasks
  const loadTasks = async () => {
    if (!selectedProject || !workspace) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('pb_token');
      const res = await fetch(`http://localhost:4001/api/tasks?projectId=${selectedProject}&limit=${taskLimit}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const countHeader = res.headers.get('X-Total-Count');
      if (countHeader) {
        setTotalCount(parseInt(countHeader, 10));
      }
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      const t = await api.listTasks({ projectId: selectedProject });
      setTasks((t || []) as Task[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, [selectedProject, workspace, taskLimit]);

  // Auto-refresh every 6 seconds
  useEffect(() => {
    const interval = setInterval(loadTasks, 6000);
    return () => clearInterval(interval);
  }, [selectedProject, workspace, taskLimit]);

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    const task = tasks.find(t => t._id === taskId);
    if (!task || task.status === status) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status } : t));
    try {
      await api.updateTask(taskId, { status });
    } catch (err: any) {
      addToast('Failed to update task', 'error');
      loadTasks();
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !selectedProject) return;
    setCreating(true);
    try {
      await api.createTask({
        projectId: selectedProject,
        workspaceId: workspace._id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: createStatus,
        dueDate: form.dueDate || null,
      });
      addToast('Task created!', 'success');
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '' });
      loadTasks();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h2 className="page-title">Kanban Board</h2>
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                style={{ width: 'auto', height: 32, fontSize: '0.8rem', fontWeight: 600 }}
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="live-dot" />
            {totalCount !== null && totalCount > tasks.length ? (
              <span>
                Showing <strong>{tasks.length}</strong> of <strong style={{ color: 'var(--primary-light)' }}>{totalCount.toLocaleString()}</strong> tasks in PacificDB
              </span>
            ) : (
              <span><strong>{tasks.length}</strong> tasks in PacificDB</span>
            )}
          </span>

          {totalCount !== null && totalCount > 200 && (
            <select
              value={taskLimit}
              onChange={e => setTaskLimit(Number(e.target.value))}
              style={{ width: 'auto', height: 28, fontSize: '0.72rem', padding: '0 0.5rem' }}
              title="Select maximum tasks to render on board"
            >
              <option value={100}>View 100</option>
              <option value={200}>View 200</option>
              <option value={500}>View 500</option>
            </select>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setCreateStatus('todo'); setShowCreate(true); }}
          >
            + Add Task
          </button>
        </div>
      </div>

      <div className="page-body" style={{ overflow: 'auto' }}>
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="kanban-board">
            {COLUMNS.map(col => (
              <div
                key={col.id}
                className="kanban-col"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className="kanban-col-header">
                  <div className="flex items-center gap-2">
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: col.color, flexShrink: 0,
                    }} />
                    <span className="kanban-col-title" style={{ color: col.color }}>
                      {col.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="kanban-count">{tasksByStatus(col.id).length}</span>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ width: 24, height: 24, fontSize: '1rem' }}
                      onClick={() => { setCreateStatus(col.id); setShowCreate(true); }}
                    >+</button>
                  </div>
                </div>
                <div className="kanban-col-body">
                  {tasksByStatus(col.id).length === 0 ? (
                    <div style={{
                      border: '1px dashed var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1.5rem',
                      textAlign: 'center',
                      color: 'var(--text-4)',
                      fontSize: '0.75rem',
                    }}>
                      Drop tasks here
                    </div>
                  ) : (
                    tasksByStatus(col.id).map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onClick={() => setTaskDetail(task)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Task</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Title</label>
                <input
                  placeholder="Task title..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required autoFocus
                />
              </div>
              <div>
                <label>Description</label>
                <textarea
                  placeholder="Task description..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="grid-2">
                <div>
                  <label>Status</label>
                  <select value={createStatus} onChange={e => setCreateStatus(e.target.value)}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {taskDetail && (
        <TaskDetailModal
          task={taskDetail}
          onClose={() => { setTaskDetail(null); loadTasks(); }}
        />
      )}
    </>
  );
}

function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [localTask, setLocalTask] = useState(task);

  useEffect(() => {
    api.listComments(task._id).then(c => setComments(c as any[]));
    const interval = setInterval(() => {
      api.listComments(task._id).then(c => setComments(c as any[]));
    }, 3000);
    return () => clearInterval(interval);
  }, [task._id]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await api.createComment(task._id, commentText);
      setCommentText('');
      const c = await api.listComments(task._id);
      setComments(c as any[]);
    } finally {
      setPosting(false);
    }
  };

  const updateStatus = async (status: string) => {
    await api.updateTask(task._id, { status });
    setLocalTask(t => ({ ...t, status }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(680px, 95vw)', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <h3 className="modal-title">{localTask.title}</h3>
            <div className="flex gap-2 mt-1">
              <span className={`badge priority-${localTask.priority}`}>{localTask.priority}</span>
              <select
                value={localTask.status}
                onChange={e => updateStatus(e.target.value)}
                style={{ height: 24, fontSize: '0.72rem', padding: '0 0.5rem', width: 'auto' }}
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {localTask.description && (
          <div style={{ marginBottom: '1.25rem', padding: '0.875rem', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
            {localTask.description}
          </div>
        )}

        <div>
          <h4 style={{ marginBottom: '0.875rem', fontSize: '0.85rem' }}>
            Comments ({comments.length})
          </h4>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {comments.map(c => (
              <div key={c._id} style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                padding: '0.75rem',
                fontSize: '0.82rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--cyan)' }}>{c.authorId.slice(0, 8)}</strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-4)' }}>
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{c.content}</div>
              </div>
            ))}
            {comments.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: '0.8rem', padding: '1rem' }}>
                No comments yet
              </div>
            )}
          </div>
          <form onSubmit={postComment} style={{ display: 'flex', gap: '0.625rem' }}>
            <input
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={posting || !commentText.trim()}>
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
