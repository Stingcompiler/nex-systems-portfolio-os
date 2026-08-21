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

/**
 * جلسة العضو على الموقع العام.
 *
 * منفصلة عن `AuthContext` الخاص بلوحة التحكم: هذا يغلّف مزوّد الموقع
 * ويُحمَّل بكسل عند الحاجة فقط، فلا يجلب المستخدم في كل صفحة عامة إلا
 * حين يوجد كوكي جلسة فعلًا.
 */
export interface Member {
  id: number;
  email: string;
  full_name: string;
  is_email_verified: boolean;
  preferred_language: string;
  avatar: string | null;
  profile: {
    bio_ar: string;
    bio_en: string;
    website: string;
    country: string;
    city: string;
    newsletter_opt_in: boolean;
    notify_on_comment_reply: boolean;
  } | null;
}

interface MemberContextValue {
  member: Member | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Member>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setMember: (member: Member | null) => void;
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Member>('/auth/me/');
      setMember(data);
    } catch {
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSessionLostHandler(() => setMember(null));
    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: Member }>('/auth/login/', { email, password });
    setMember(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/', {});
    } finally {
      setMember(null);
    }
  }, []);

  const value = useMemo(
    () => ({ member, loading, login, logout, refresh: load, setMember }),
    [member, loading, login, logout, load],
  );

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember() {
  const context = useContext(MemberContext);
  if (!context) {
    throw new Error('useMember يجب أن يُستخدم داخل MemberProvider');
  }
  return context;
}
