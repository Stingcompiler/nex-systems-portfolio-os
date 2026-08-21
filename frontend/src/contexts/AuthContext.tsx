'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, setSessionLostHandler } from '@/lib/api/client';

export interface DashboardUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_display: string;
  preferred_language: string;
  is_email_verified: boolean;
  is_dashboard_user: boolean;
  permissions: string[];
  avatar: string | null;
}

interface AuthContextValue {
  user: DashboardUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<DashboardUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const { data } = await api.get<DashboardUser>('/auth/me/');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // فشل التجديد يعني انتهاء الجلسة نهائيًا — تُنظَّف الحالة فورًا
  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: DashboardUser }>('/auth/login/', {
      email,
      password,
    });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/', {});
    } finally {
      setUser(null);
    }
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.permissions.includes('*')) return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh: loadSession, can }),
    [user, loading, login, logout, loadSession, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  }
  return context;
}
