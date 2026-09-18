import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

interface Message {
  _id: string;
  channelId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

interface Channel { id: string; name: string; }

function timeStr(date: string) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Chat() {
  const { workspace, user } = useApp();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    api.listChannels(workspace._id).then(c => setChannels(c as Channel[]));
  }, [workspace]);

  const loadMessages = async () => {
    if (!workspace) return;
    const msgs = await api.listMessages(workspace._id, activeChannel, 100);
    setMessages(msgs as Message[]);
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [workspace, activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() || !workspace) return;
    setSending(true);
    const content = msgText;
    setMsgText('');
    try {
      await api.sendMessage(workspace._id, activeChannel, content);
      loadMessages();
    } catch (err: any) {
      addToast('Failed to send message', 'error');
      setMsgText(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', marginLeft: 0 }}>
      {/* Channel list */}
      <div style={{
        width: 200,
        background: 'var(--bg-3)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Channels
          </div>
        </div>
        <div style={{ padding: '0.5rem 0.375rem', flex: 1 }}>
          {channels.map(ch => (
            <div
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: ch.id === activeChannel ? 'var(--text)' : 'var(--text-3)',
                background: ch.id === activeChannel ? 'var(--surface-2)' : 'transparent',
                fontWeight: ch.id === activeChannel ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              # {ch.name}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}>
          <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>#</span>
          <span style={{ fontWeight: 700 }}>{activeChannel}</span>
          <span className="live-dot" style={{ marginLeft: 'auto' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Live</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◉</div>
              <div className="empty-state-title">No messages yet</div>
              <div className="empty-state-desc">Be the first to say something in #{activeChannel}</div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isOwn = msg.authorId === user?._id;
              const showAuthor = i === 0 || messages[i - 1].authorId !== msg.authorId;
              return (
                <div key={msg._id} className="chat-message" style={{ marginBottom: showAuthor ? '0.5rem' : 0 }}>
                  {showAuthor ? (
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.authorId}`}
                      alt=""
                      className="avatar avatar-sm"
                    />
                  ) : (
                    <div style={{ width: 22, flexShrink: 0 }} />
                  )}
                  <div className="chat-message-content">
                    {showAuthor && (
                      <div className="chat-message-header">
                        <span className="chat-message-author" style={{ color: isOwn ? 'var(--cyan)' : 'var(--primary-light)', fontWeight: 600 }}>
                          {isOwn ? 'You' : (msg.authorName || (msg.authorId.startsWith('team-') ? msg.authorId.replace('team-', '').replace(/-/g, ' ') : msg.authorId.slice(0, 8)))}
                        </span>
                        <span className="chat-message-time">{timeStr(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className="chat-message-text">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-bar">
          <form onSubmit={send} style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            <input
              ref={inputRef}
              placeholder={`Message #${activeChannel}...`}
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              style={{ flex: 1 }}
              disabled={sending}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!msgText.trim() || sending}>
              Send →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
