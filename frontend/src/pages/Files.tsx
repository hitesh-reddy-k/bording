import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

interface FileRecord {
  _id: string;
  name: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
  url?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const icon = mimeType.startsWith('image/') ? '🖼️'
    : mimeType.includes('pdf') ? '📄'
    : mimeType.includes('video') ? '🎬'
    : mimeType.includes('audio') ? '🎵'
    : mimeType.includes('zip') || mimeType.includes('rar') ? '📦'
    : '📎';
  return <span style={{ fontSize: '1.5rem' }}>{icon}</span>;
}

export function Files() {
  const { workspace, user } = useApp();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const f = await api.listFiles(workspace._id);
      setFiles(f as FileRecord[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspace]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + 15, 90));
    }, 200);

    try {
      await api.uploadFile(workspace._id, file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      addToast(`${file.name} uploaded!`, 'success');
      setTimeout(() => { setUploadProgress(0); setUploading(false); }, 500);
      load();
    } catch (err: any) {
      clearInterval(progressInterval);
      addToast(err.message, 'error');
      setUploading(false);
      setUploadProgress(0);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (fileId: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.deleteFile(fileId);
      addToast('File deleted', 'success');
      load();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const downloadFile = (fileId: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = `http://localhost:4001/api/files/${fileId}/download`;
    a.download = fileName;
    a.click();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Files</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
            {files.length} files · {formatSize(files.reduce((sum, f) => sum + f.size, 0))} total
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className={`btn btn-ghost btn-sm`}
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          >
            {view === 'grid' ? '≡ List' : '⊞ Grid'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
            accept="*/*"
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? `Uploading ${uploadProgress}%` : '↑ Upload File'}
          </button>
        </div>
      </div>

      {uploading && (
        <div style={{ padding: '0 2rem', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--cyan), var(--blue))',
              borderRadius: 2,
              width: `${uploadProgress}%`,
              transition: 'width 0.2s',
            }} />
          </div>
        </div>
      )}

      <div className="page-body">
        {loading ? (
          <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◫</div>
            <div className="empty-state-title">No files uploaded</div>
            <div className="empty-state-desc">Upload files to share them with your team.</div>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              Upload First File
            </button>
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {files.map((f, i) => (
              <div key={f._id} className="card animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <div style={{
                  height: 120,
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.875rem',
                  fontSize: '2.5rem',
                }}>
                  {f.mimeType?.startsWith('image/') ? (
                    <span style={{ fontSize: '2rem' }}>🖼️</span>
                  ) : (
                    <FileIcon mimeType={f.mimeType || ''} />
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                  {formatSize(f.size)}
                </div>
                <div className="flex gap-1 mt-2">
                  <button
                    className="btn btn-ghost btn-sm flex-1"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => downloadFile(f._id, f.name)}
                  >↓ Download</button>
                  {f.uploaderId === user?._id && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => deleteFile(f._id, f.name)}
                    >✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {files.map((f, i) => (
              <div key={f._id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1rem',
                borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <FileIcon mimeType={f.mimeType || ''} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
                    {formatSize(f.size)} · {new Date(f.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(f._id, f.name)}>↓</button>
                  {f.uploaderId === user?._id && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteFile(f._id, f.name)}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
