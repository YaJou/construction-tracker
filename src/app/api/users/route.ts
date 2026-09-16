import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { canManageSettings, ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** List profiles for team assignment (owner/manager). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageSettings(auth.ctx.profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { data, error } = await auth.ctx.supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить пользователей" }, { status: 500 });
  }

  return NextResponse.json({
    users: (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role as AppRole,
      role_label: ROLE_LABELS[(p.role as AppRole) || "manager"] || p.role,
    })),
  });
}
