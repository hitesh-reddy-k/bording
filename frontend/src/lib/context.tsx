import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, setToken, clearToken } from '../lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  members: { userId: string; role: string }[];
}

interface AppContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setWorkspace: (ws: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pb_token');
    if (token) {
      api.me()
        .then((u) => {
          setUser(u as User);
          return api.listWorkspaces();
        })
        .then((wsList) => {
          const ws = wsList as Workspace[];
          setWorkspaces(ws);
          const savedWs = localStorage.getItem('pb_workspace');
          if (savedWs) {
            const found = ws.find(w => w._id === savedWs);
            if (found) setWorkspaceState(found);
            else if (ws.length > 0) setWorkspaceState(ws[0]);
          } else if (ws.length > 0) {
            setWorkspaceState(ws[0]);
          }
        })
        .catch(() => { clearToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, u: User) => {
    setToken(token);
    setUser(u);
    api.listWorkspaces().then((ws) => {
      const list = ws as Workspace[];
      setWorkspaces(list);
      if (list.length > 0) setWorkspaceState(list[0]);
    });
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('pb_workspace');
    setUser(null);
    setWorkspaceState(null);
    setWorkspaces([]);
  };

  const setWorkspace = (ws: Workspace) => {
    setWorkspaceState(ws);
    localStorage.setItem('pb_workspace', ws._id);
  };

  const refreshWorkspaces = async () => {
    const ws = await api.listWorkspaces() as Workspace[];
    setWorkspaces(ws);
    if (!workspace && ws.length > 0) setWorkspaceState(ws[0]);
  };

  return (
    <AppContext.Provider value={{ user, workspace, workspaces, loading, login, logout, setWorkspace, refreshWorkspaces }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
