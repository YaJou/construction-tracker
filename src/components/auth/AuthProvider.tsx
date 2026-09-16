"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  displayName,
  ROLE_LABELS,
  type AppRole,
  type Profile,
} from "@/lib/auth/roles";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  displayName: string;
  roleLabel: string;
  role: AppRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createBrowserSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name,
    role: (data.role as AppRole) || "manager",
    is_active: data.is_active !== false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    setUser(u);
    if (u) {
      const p = await fetchProfile(u.id);
      if (p) {
        setProfile(p);
      } else {
        setProfile({
          id: u.id,
          full_name: (u.user_metadata?.full_name as string) || null,
          role: "manager",
          is_active: true,
        });
      }
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    refresh().finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthState>(() => {
    const role = profile?.role ?? null;
    return {
      user,
      profile,
      loading,
      displayName: displayName(profile, user?.email),
      roleLabel: role ? ROLE_LABELS[role] : "Гость",
      role,
      refresh,
      signOut,
    };
  }, [user, profile, loading, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
