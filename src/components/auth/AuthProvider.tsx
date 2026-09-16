"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

async function fetchProfileViaApi(): Promise<Profile | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.profile?.id) return null;
    return {
      id: json.profile.id,
      full_name: json.profile.full_name ?? null,
      role: (json.profile.role as AppRole) || "manager",
      is_active: json.profile.is_active !== false,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const supabase = createBrowserSupabase();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u);

      if (!u) {
        setProfile(null);
        return;
      }

      // Always load role from API (server reads DB correctly); never invent "manager"
      const p = await fetchProfileViaApi();
      if (p) {
        setProfile(p);
      } else {
        // Keep previous profile if temporary fetch failed while logged in
        setProfile((prev) =>
          prev && prev.id === u.id
            ? prev
            : {
                id: u.id,
                full_name: (u.user_metadata?.full_name as string) || null,
                role: "manager",
                is_active: true,
              }
        );
      }
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let mounted = true;

    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Skip noisy token refresh storms; still refresh on sign in/out
      if (event === "TOKEN_REFRESHED") return;
      refresh();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
      roleLabel: loading ? "…" : role ? ROLE_LABELS[role] : "Гость",
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
