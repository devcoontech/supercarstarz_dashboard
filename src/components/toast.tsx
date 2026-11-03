import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { FiCheckCircle } from 'react-icons/fi';

/** Short confirmation messages shown at the corner of the screen. */

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <div className="toast" role="status">
          <FiCheckCircle size={18} /> {msg}
        </div>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
