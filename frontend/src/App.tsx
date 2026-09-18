import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/context';
import { ToastContainer } from './lib/toast';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { KanbanBoard } from './pages/KanbanBoard';
import { Chat } from './pages/Chat';
import { Files } from './pages/Files';
import { Search } from './pages/Search';
import { SemanticSearch } from './pages/SemanticSearch';
import { AdminDashboard } from './pages/AdminDashboard';
import './index.css';

function AppRoutes() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 48, height: 48,
          background: 'linear-gradient(135deg, var(--cyan), var(--blue))',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontWeight: 900, color: '#030712',
          animation: 'glow 2s ease infinite',
        }}>P</div>
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Connecting to PacificDB...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/board" element={<KanbanBoard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/files" element={<Files />} />
          <Route path="/search" element={<Search />} />
          <Route path="/semantic" element={<SemanticSearch />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
