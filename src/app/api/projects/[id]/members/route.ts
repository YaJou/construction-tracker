import { NextResponse } from "next/server";
import { requireAuth, requireWriteAuth, actorName } from "@/lib/auth/requireAuth";
import { assertProjectAccess, addProjectMember } from "@/lib/auth/projectAccess";
import { canEditAllProjects, canManageSettings, type AppRole } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const projectId = Number((await params).id);
  if (!projectId) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

  const access = await assertProjectAccess(auth.ctx, projectId);
  if (!access.ok) return access.response;

  const { data: members, error } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role")
    .eq("project_id", projectId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить команду" }, { status: 500 });
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await auth.ctx.supabase.from("profiles").select("id, full_name, role").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; role: string }[] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    members: (members ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      full_name: profileMap.get(m.user_id)?.full_name ?? null,
      profile_role: profileMap.get(m.user_id)?.role ?? null,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  if (!canManageSettings(auth.ctx.profile.role) && !canEditAllProjects(auth.ctx.profile.role)) {
    // managers who are project members can also add? Keep to owner/manager profiles
    if (auth.ctx.profile.role === "foreman" || auth.ctx.profile.role === "client") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
  }

  const projectId = Number((await params).id);
  if (!projectId) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

  const access = await assertProjectAccess(auth.ctx, projectId);
  if (!access.ok) return access.response;

  const body = await request.json();
  const userId = String(body.userId || "");
  const role = (body.role as AppRole) || "manager";
  if (!userId) return NextResponse.json({ error: "Укажите пользователя" }, { status: 400 });
  if (!["owner", "manager", "foreman", "client"].includes(role)) {
    return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
  }

  try {
    await addProjectMember(auth.ctx, projectId, userId, role);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка назначения" },
      { status: 500 }
    );
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    action_type: "updated",
    entity_type: "project",
    entity_id: projectId,
    details: `Добавлен участник (${role})`,
    user_name: actorName(auth.ctx),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;

  const projectId = Number((await params).id);
  if (!projectId) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

  const access = await assertProjectAccess(auth.ctx, projectId);
  if (!access.ok) return access.response;

  const body = await request.json();
  const userId = String(body.userId || "");
  if (!userId) return NextResponse.json({ error: "Укажите пользователя" }, { status: 400 });

  if (userId === auth.ctx.user.id && auth.ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "Нельзя удалить себя из объекта" }, { status: 400 });
  }

  if (!canManageSettings(auth.ctx.profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
