import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabase as anonSupabase } from "@/lib/supabaseClient";
import type { AppRole, Profile } from "@/lib/auth/roles";
import { canManageSettings, canWrite } from "@/lib/auth/roles";

export type AuthContext = {
  user: { id: string; email?: string };
  profile: Profile;
  /** User-scoped Supabase client (cookie session) */
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  /** Legacy anon client for existing queries until fully migrated */
  db: typeof anonSupabase;
};

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  email?: string | null,
  metaName?: string | null
): Promise<Profile> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (data) {
    return {
      id: data.id,
      full_name: data.full_name,
      role: (data.role as AppRole) || "manager",
      is_active: data.is_active !== false,
    };
  }

  const fullName = metaName || (email ? email.split("@")[0] : null);
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName,
      role: "manager",
      is_active: true,
    })
    .select("id, full_name, role, is_active")
    .single();

  if (error || !inserted) {
    return {
      id: userId,
      full_name: fullName,
      role: "manager",
      is_active: true,
    };
  }

  return {
    id: inserted.id,
    full_name: inserted.full_name,
    role: (inserted.role as AppRole) || "manager",
    is_active: inserted.is_active !== false,
  };
}

export async function requireAuth(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }
> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Требуется вход. Откройте /login" },
          { status: 401 }
        ),
      };
    }

    const profile = await ensureProfile(
      supabase,
      user.id,
      user.email,
      (user.user_metadata?.full_name as string | undefined) ?? null
    );

    if (!profile.is_active) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Аккаунт отключён" }, { status: 403 }),
      };
    }

    return {
      ok: true,
      ctx: {
        user: { id: user.id, email: user.email },
        profile,
        supabase,
        db: anonSupabase,
      },
    };
  } catch (e) {
    console.error("requireAuth", e);
    return {
      ok: false,
      response: NextResponse.json({ error: "Ошибка авторизации" }, { status: 500 }),
    };
  }
}

export async function requireWriteAuth(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!canWrite(auth.ctx.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Недостаточно прав для изменения данных (роль клиента — только просмотр)" },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export async function requireSettingsAuth(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!canManageSettings(auth.ctx.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Справочники доступны руководителю и менеджеру" },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export function actorName(ctx: AuthContext) {
  return ctx.profile.full_name || ctx.user.email || "Пользователь";
}
