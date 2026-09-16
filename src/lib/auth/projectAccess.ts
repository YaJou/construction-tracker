import type { AuthContext } from "@/lib/auth/requireAuth";
import { canEditAllProjects } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

export async function getAccessibleProjectIds(ctx: AuthContext): Promise<number[] | "all"> {
  if (canEditAllProjects(ctx.profile.role)) return "all";

  const { data, error } = await ctx.db
    .from("project_members")
    .select("project_id")
    .eq("user_id", ctx.user.id);

  if (error) {
    console.warn("project_members:", error.message);
    // Table missing / RLS — fail closed for non-owners
    return [];
  }
  return (data ?? []).map((r) => Number(r.project_id)).filter(Boolean);
}

export async function assertProjectAccess(
  ctx: AuthContext,
  projectId: number
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (canEditAllProjects(ctx.profile.role)) return { ok: true };

  const { data, error } = await ctx.db
    .from("project_members")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (error) {
    console.warn("assertProjectAccess:", error.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Нет доступа к объекту (проверьте таблицу project_members)" },
        { status: 403 }
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Нет доступа к этому объекту" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export async function addProjectMember(
  ctx: AuthContext,
  projectId: number,
  userId: string,
  role: string
) {
  const { error } = await ctx.db.from("project_members").upsert(
    {
      project_id: projectId,
      user_id: userId,
      role,
    },
    { onConflict: "project_id,user_id" }
  );
  if (error) throw new Error(error.message);
}
