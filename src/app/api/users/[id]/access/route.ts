import { NextResponse } from "next/server";
import { requireWriteAuth, actorName } from "@/lib/auth/requireAuth";
import { canManageSettings, type AppRole } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * Sync project access for a user: grant listed projects, revoke the rest.
 * Body: { projectIds: number[], role?: AppRole }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  if (!canManageSettings(auth.ctx.profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const userId = (await params).id;
  if (!userId) {
    return NextResponse.json({ error: "Неверный пользователь" }, { status: 400 });
  }

  const body = await request.json();
  const projectIds: number[] = Array.isArray(body.projectIds)
    ? [
        ...new Set(
          (body.projectIds as unknown[])
            .map((n) => Number(n))
            .filter((n): n is number => Number.isFinite(n) && n > 0)
        ),
      ]
    : [];
  if (!Array.isArray(body.projectIds)) {
    return NextResponse.json({ error: "Укажите projectIds" }, { status: 400 });
  }

  const role = (body.role as AppRole) || "manager";
  if (!["owner", "manager", "foreman", "client"].includes(role)) {
    return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const current = new Set<number>(
    (existing ?? []).map((r) => Number(r.project_id)).filter(Boolean)
  );
  const desired = new Set<number>(projectIds);

  const toAdd = projectIds.filter((id: number) => !current.has(id));
  const toRemove = [...current].filter((id) => !desired.has(id));

  if (toAdd.length) {
    const { error } = await auth.ctx.db.from("project_members").upsert(
      toAdd.map((project_id) => ({
        project_id,
        user_id: userId,
        role,
      })),
      { onConflict: "project_id,user_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("user_id", userId)
      .in("project_id", toRemove);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Activity on a few projects (cap noise)
  const actor = actorName(auth.ctx);
  const logAdds = toAdd.slice(0, 8);
  if (logAdds.length) {
    await supabase.from("activity_log").insert(
      logAdds.map((project_id) => ({
        project_id,
        action_type: "updated",
        entity_type: "project",
        entity_id: project_id,
        details: `Выдан доступ участнику (${role})`,
        user_name: actor,
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    added: toAdd.length,
    removed: toRemove.length,
    project_ids: projectIds,
  });
}
