import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectId = Number((await params).id);
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error(projectError);
      return NextResponse.json({ error: "Ошибка формирования отчёта" }, { status: 500 });
    }
    if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

    const [stagesRes, photosRes, expensesRes] = await Promise.all([
      supabase
        .from("stages")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true }),
      supabase
        .from("photos")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("expenses")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
    ]);

    const stages = stagesRes.data ?? [];
    const photos = photosRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    const totalStages = stages.length;
    const completedStages = stages.filter((s) => s.status === "completed").length;
    const progress =
      totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const budget = Number(project.budget) ?? 0;

    return NextResponse.json(
      {
        project: { ...project, progress_percent: progress },
        stages,
        photos,
        expenses,
        total_spent: totalSpent,
        budget,
        budget_remaining: budget - totalSpent,
        generated_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка формирования отчёта" }, { status: 500 });
  }
}
