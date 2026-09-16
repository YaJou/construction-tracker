import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { requireAuth } from "@/lib/auth/requireAuth";
import { assertProjectAccess } from "@/lib/auth/projectAccess";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = Number((await params).id);
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;

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

    const stageIds = (stagesRes.data ?? []).map((s) => s.id);
    let substeps: { stage_id: number; order_index: number; [key: string]: unknown }[] = [];
    if (stageIds.length) {
      const { data: byStages } = await supabase
        .from("stage_substeps")
        .select("*")
        .in("stage_id", stageIds)
        .order("order_index", { ascending: true });
      substeps = (byStages as typeof substeps) ?? [];
    }

    const stages = (stagesRes.data ?? []).map((s) => ({
      ...s,
      substeps: substeps
        .filter((sub) => Number(sub.stage_id) === Number(s.id))
        .sort((a, b) => Number(a.order_index) - Number(b.order_index)),
    }));

    const photos = photosRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    // Same formula as project page /api/projects/[id]
    const totalStages = stages.length;
    const completedStages = stages.filter((s) => s.status === "completed").length;
    const progress =
      totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const budgetRaw = project.budget;
    const budget =
      budgetRaw == null || budgetRaw === "" ? 0 : Number(budgetRaw);
    const hasBudget = Number.isFinite(budget) && budget > 0;

    const authorName =
      auth.ctx.profile.full_name || auth.ctx.user.email || "Пользователь";

    return NextResponse.json(
      {
        project: {
          ...project,
          progress_percent: progress,
          completed_stages: completedStages,
          total_stages: totalStages,
        },
        stages,
        photos,
        expenses,
        total_spent: totalSpent,
        budget: hasBudget ? budget : 0,
        has_budget: hasBudget,
        budget_remaining: hasBudget ? budget - totalSpent : null,
        generated_at: new Date().toISOString(),
        author_name: authorName,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка формирования отчёта" }, { status: 500 });
  }
}
