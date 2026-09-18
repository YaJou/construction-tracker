import { NextResponse } from "next/server";
import { requireAuth, requireWriteAuth } from "@/lib/auth/requireAuth";
import {
  canEditAllProjects,
  canManageSettings,
  ROLE_LABELS,
  type AppRole,
} from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/** List all profiles + their project access (owner/manager). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageSettings(auth.ctx.profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const isOwner = canEditAllProjects(auth.ctx.profile.role);

  let profilesQuery = auth.ctx.supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at")
    .order("created_at", { ascending: false });

  // Managers see active users for team pickers; owners see everyone
  if (!isOwner) {
    profilesQuery = profilesQuery.eq("is_active", true);
  }

  const [profilesRes, membersRes, projectsRes] = await Promise.all([
    profilesQuery,
    supabase.from("project_members").select("project_id, user_id, role"),
    supabase
      .from("projects")
      .select("id, name, status, archived, address")
      .order("updated_at", { ascending: false }),
  ]);

  if (profilesRes.error) {
    console.error(profilesRes.error);
    // email column may be missing before migration
    if (/email/i.test(profilesRes.error.message || "")) {
      const fallback = await auth.ctx.supabase
        .from("profiles")
        .select("id, full_name, role, is_active, created_at")
        .order("created_at", { ascending: false });
      if (fallback.error) {
        return NextResponse.json(
          { error: "Не удалось загрузить пользователей" },
          { status: 500 }
        );
      }
      return buildUsersResponse(
        (fallback.data ?? []).map((p) => ({ ...p, email: null })),
        membersRes.data ?? [],
        projectsRes.data ?? [],
        isOwner
      );
    }
    return NextResponse.json(
      { error: "Не удалось загрузить пользователей" },
      { status: 500 }
    );
  }

  if (membersRes.error) console.error(membersRes.error);
  if (projectsRes.error) console.error(projectsRes.error);

  return buildUsersResponse(
    profilesRes.data ?? [],
    membersRes.data ?? [],
    projectsRes.data ?? [],
    isOwner
  );
}

function buildUsersResponse(
  profiles: {
    id: string;
    full_name: string | null;
    email?: string | null;
    role: string;
    is_active: boolean | null;
    created_at?: string | null;
  }[],
  members: { project_id: number; user_id: string; role: string }[],
  projects: {
    id: number;
    name: string;
    status: string;
    archived: boolean | null;
    address?: string | null;
  }[],
  isOwner: boolean
) {
  const membersByUser = new Map<string, { project_id: number; role: string }[]>();
  for (const m of members) {
    const list = membersByUser.get(m.user_id) || [];
    list.push({ project_id: m.project_id, role: m.role });
    membersByUser.set(m.user_id, list);
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const users = profiles.map((p) => {
    const access = membersByUser.get(p.id) || [];
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email ?? null,
      role: p.role as AppRole,
      role_label: ROLE_LABELS[(p.role as AppRole) || "manager"] || p.role,
      is_active: p.is_active !== false,
      created_at: p.created_at ?? null,
      project_ids: access.map((a) => a.project_id),
      projects: access
        .map((a) => {
          const proj = projectMap.get(a.project_id);
          if (!proj) return null;
          return {
            id: proj.id,
            name: proj.name,
            role: a.role,
          };
        })
        .filter(Boolean),
    };
  });

  return NextResponse.json({
    users,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      archived: !!p.archived,
      address: p.address ?? null,
    })),
    can_manage_roles: isOwner,
  });
}

/** Update profile role / active / name (owner for role & active; manager for name only). */
export async function PATCH(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  if (!canManageSettings(auth.ctx.profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await request.json();
  const userId = String(body.userId || "");
  if (!userId) {
    return NextResponse.json({ error: "Укажите пользователя" }, { status: 400 });
  }

  const isOwner = canEditAllProjects(auth.ctx.profile.role);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.full_name === "string") {
    patch.full_name = body.full_name.trim() || null;
  }

  if (body.role != null) {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Менять роль может только руководитель" },
        { status: 403 }
      );
    }
    const role = String(body.role) as AppRole;
    if (!["owner", "manager", "foreman", "client"].includes(role)) {
      return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
    }
    if (userId === auth.ctx.user.id && role !== "owner") {
      return NextResponse.json(
        { error: "Нельзя снять с себя роль руководителя" },
        { status: 400 }
      );
    }
    patch.role = role;
  }

  if (body.is_active != null) {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Отключать аккаунты может только руководитель" },
        { status: 403 }
      );
    }
    if (userId === auth.ctx.user.id && body.is_active === false) {
      return NextResponse.json(
        { error: "Нельзя отключить свой аккаунт" },
        { status: 400 }
      );
    }
    patch.is_active = Boolean(body.is_active);
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  const { data, error } = await auth.ctx.supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, full_name, email, role, is_active")
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}
