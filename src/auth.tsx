import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, login as apiLogin, setUnauthorizedHandler, tokenStore } from './api';

export type Staff = { id: string; email: string; name: string; role: string };
type Ctx = { staff: Staff | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => void };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setStaff(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) { setReady(true); return; }
    api<Staff>('/me').then(setStaff).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, [signOut]);

  const value = useMemo<Ctx>(() => ({
    staff, ready, signOut,
    signIn: async (email, password) => {
      const r = await apiLogin(email, password);
      tokenStore.set(r.token);
      setStaff(r.staff);
    },
  }), [staff, ready, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
};
