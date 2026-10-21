import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type ToastMessage = { id: number; message: string; kind: ToastKind };
type ToastContextValue = { notify: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, message, kind }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToasts([]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toasts.length]);

  const contextValue = { notify };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-viewport" role="region" aria-label="الإشعارات" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const Icon = toast.kind === 'success' ? Check : toast.kind === 'error' ? TriangleAlert : Info;
          return (
            <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}>
              <Icon size={19} aria-hidden="true" />
              <p>{toast.message}</p>
              <button type="button" className="toast-dismiss" onClick={() => dismiss(toast.id)} aria-label="إغلاق الإشعار">
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
