import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getAccessibleProjectIds } from "@/lib/auth/projectAccess";

export const dynamic = "force-dynamic";

function todayDateStr(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const today = todayDateStr();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const fromIso = todayStart.toISOString();
    const toIso = todayEnd.toISOString();

    const { data: allProjectsRaw, error: projectsError } = await supabase
      .from("projects")
      .select("id, name");

    if (projectsError || !allProjectsRaw) {
      console.error(projectsError);
      return NextResponse.json(
        { error: "Ошибка загрузки активности" },
        { status: 500 }
      );
    }

    const accessible = await getAccessibleProjectIds(auth.ctx);
    const allProjects =
      accessible === "all"
        ? allProjectsRaw
        : allProjectsRaw.filter((p) => accessible.includes(p.id));

    if (allProjects.length === 0) {
      return NextResponse.json(
        { projects: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const projectIds = allProjects.map((p) => p.id);
    const nameById = new Map(allProjects.map((p) => [p.id, p.name]));

    const [photosRes, stagesRes, expensesRes, activityRes] = await Promise.all([
      supabase
        .from("photos")
        .select("id, project_id, created_at")
        .in("project_id", projectIds)
        .gte("created_at", fromIso)
        .lt("created_at", toIso),
      supabase
        .from("stages")
        .select("project_id, name, status, end_date")
        .in("project_id", projectIds)
        .eq("status", "completed")
        .eq("end_date", today),
      supabase
        .from("expenses")
        .select("id, project_id")
        .in("project_id", projectIds)
        .eq("date", today),
      supabase
        .from("activity_log")
        .select("project_id, details, created_at")
        .in("project_id", projectIds)
        .gte("created_at", fromIso)
        .lt("created_at", toIso),
    ]);

    if (photosRes.error) console.error(photosRes.error);
    if (stagesRes.error) console.error(stagesRes.error);
    if (expensesRes.error) console.error(expensesRes.error);
    if (activityRes.error) console.error(activityRes.error);

    const photoCount = new Map<number, number>();
    for (const ph of photosRes.data ?? []) {
      photoCount.set(ph.project_id, (photoCount.get(ph.project_id) || 0) + 1);
    }

    const stagesByProject = new Map<number, string[]>();
    for (const s of stagesRes.data ?? []) {
      const list = stagesByProject.get(s.project_id) || [];
      list.push(s.name);
      stagesByProject.set(s.project_id, list);
    }

    const expenseCount = new Map<number, number>();
    for (const e of expensesRes.data ?? []) {
      expenseCount.set(e.project_id, (expenseCount.get(e.project_id) || 0) + 1);
    }

    const logByProject = new Map<number, string[]>();
    for (const a of activityRes.data ?? []) {
      if (!a.details) continue;
      const list = logByProject.get(a.project_id) || [];
      list.push(a.details);
      logByProject.set(a.project_id, list);
    }

    const result: { id: number; name: string; highlights: string[] }[] = [];

    for (const id of projectIds) {
      const highlights: string[] = [];
      const photos = photoCount.get(id) || 0;
      if (photos > 0) {
        highlights.push(photos === 1 ? "+1 фото" : `+${photos} фото`);
      }

      for (const name of stagesByProject.get(id) || []) {
        highlights.push(`этап «${name}» завершён`);
      }

      const expenses = expenseCount.get(id) || 0;
      if (expenses > 0) {
        highlights.push(
          expenses === 1 ? "добавлен расход" : `+${expenses} расходов`
        );
      }

      const logs = logByProject.get(id) || [];
      if (
        logs.length > 0 &&
        photos === 0 &&
        !(stagesByProject.get(id) || []).length &&
        expenses === 0
      ) {
        for (const d of [...new Set(logs)].slice(0, 2)) highlights.push(d);
      }

      if (highlights.length > 0) {
        result.push({
          id,
          name: nameById.get(id) || "Объект",
          highlights,
        });
      }
    }

    return NextResponse.json(
      { projects: result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Ошибка загрузки активности" },
      { status: 500 }
    );
  }
}
