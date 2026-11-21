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
import { guestProfile, isGuestAccessEnabled } from "@/lib/auth/guest";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  displayName: string;
  roleLabel: string;
  role: AppRole | null;
  isGuest: boolean;
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
      let u: User | null = null;
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        u = authUser;
      } catch {
        u = null;
      }
      setUser(u);

      if (!u) {
        setProfile(isGuestAccessEnabled() ? guestProfile() : null);
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
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();

    try {
      const supabase = createBrowserSupabase();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "TOKEN_REFRESHED") return;
        refresh();
      });
      subscription = data.subscription;
    } catch {
      // Auth client unavailable — guest mode still works
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setProfile(isGuestAccessEnabled() ? guestProfile() : null);
    window.location.href = isGuestAccessEnabled() ? "/dashboard" : "/login";
  }, []);

  const value = useMemo<AuthState>(() => {
    const role = profile?.role ?? null;
    const isGuest = !user && isGuestAccessEnabled();
    return {
      user,
      profile,
      loading,
      displayName: isGuest
        ? "Гость"
        : displayName(profile, user?.email),
      roleLabel: loading ? "…" : isGuest ? "Гость" : role ? ROLE_LABELS[role] : "Гость",
      role: isGuest ? "owner" : role,
      isGuest,
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
