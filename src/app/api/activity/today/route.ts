import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
  try {
    const today = todayDateStr();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const { data: allProjects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name");

    if (projectsError || !allProjects) {
      console.error(projectsError);
      return NextResponse.json(
        { error: "Ошибка загрузки активности" },
        { status: 500 }
      );
    }

    const result: { id: number; name: string; highlights: string[] }[] = [];

    for (const project of allProjects) {
      const highlights: string[] = [];

      const [photosRes, stagesRes, expensesRes, activityRes] = await Promise.all([
        supabase
          .from("photos")
          .select("id, created_at")
          .eq("project_id", project.id)
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", todayEnd.toISOString()),
        supabase
          .from("stages")
          .select("name, status, end_date")
          .eq("project_id", project.id)
          .eq("status", "completed")
          .eq("end_date", today),
        supabase
          .from("expenses")
          .select("id")
          .eq("project_id", project.id)
          .eq("date", today),
        supabase
          .from("activity_log")
          .select("details, created_at")
          .eq("project_id", project.id)
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", todayEnd.toISOString()),
      ]);

      const todayPhotos = photosRes.data ?? [];
      if (todayPhotos.length > 0) {
        highlights.push(
          todayPhotos.length === 1 ? "+1 фото" : `+${todayPhotos.length} фото`
        );
      }

      for (const s of stagesRes.data ?? []) {
        highlights.push(`этап «${s.name}» завершён`);
      }

      const todayExpenses = expensesRes.data ?? [];
      if (todayExpenses.length > 0) {
        highlights.push(
          todayExpenses.length === 1
            ? "добавлен расход"
            : `+${todayExpenses.length} расходов`
        );
      }

      const todayLog = activityRes.data ?? [];
      const hasOtherActivity =
        todayLog.length > 0 &&
        todayPhotos.length === 0 &&
        (stagesRes.data ?? []).length === 0 &&
        todayExpenses.length === 0;
      if (hasOtherActivity) {
        const distinct = todayLog
          .map((a) => a.details)
          .filter(Boolean) as string[];
        const unique = [...new Set(distinct)];
        for (const d of unique.slice(0, 2)) highlights.push(d);
      }

      if (highlights.length > 0) {
        result.push({ id: project.id, name: project.name, highlights });
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
