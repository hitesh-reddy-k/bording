import { useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let counter = 0;
const listeners: ((toasts: Toast[]) => void)[] = [];
let toastList: Toast[] = [];

function notify() {
  listeners.forEach(l => l([...toastList]));
}

export function addToast(message: string, type: Toast['type'] = 'info') {
  const id = ++counter;
  toastList = [...toastList, { id, message, type }];
  notify();
  setTimeout(() => {
    toastList = toastList.filter(t => t.id !== id);
    notify();
  }, 4000);
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Register listener
  if (!listeners.includes(setToasts)) {
    listeners.push(setToasts);
  }

  return toasts;
}

export function ToastContainer() {
  const toasts = useToasts();
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && '✅'}
          {t.type === 'error' && '❌'}
          {t.type === 'info' && 'ℹ️'}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
