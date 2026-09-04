import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (projectError) {
      console.error(projectError);
      return NextResponse.json({ error: "Ошибка загрузки проекта" }, { status: 500 });
    }
    if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

    const [stagesRes, expensesRes, activityRes] = await Promise.all([
      supabase
        .from("stages")
        .select("*")
        .eq("project_id", id)
        .order("order_index", { ascending: true }),
      supabase.from("expenses").select("*").eq("project_id", id),
      supabase
        .from("activity_log")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

    const stageRows = stagesRes.data ?? [];
    const stageIds = stageRows.map((s) => s.id);
    let substages: { id: number; stage_id: number; name: string; completed: boolean; order_index: number }[] = [];
    if (stageIds.length > 0) {
      const substagesRes = await supabase
        .from("stage_substeps")
        .select("*")
        .in("stage_id", stageIds);
      if (!substagesRes.error) substages = substagesRes.data ?? [];
    }

    const stages = stageRows.map((s) => ({
      ...s,
      substeps: substages
        .filter((sub) => sub.stage_id === s.id)
        .sort((a, b) => a.order_index - b.order_index),
    }));
    const totalStages = stages.length;
    const completedStages = stages.filter((s) => s.status === "completed").length;
    const progress =
      totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

    const expenses = expensesRes.data ?? [];
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const budget = Number(project.budget) || 0;

    const sortedActivity = activityRes.data ?? [];
    const lastActivity = sortedActivity[0] ?? null;
    const timeline_entries = sortedActivity.slice(0, 50).map((e) => ({
      created_at: e.created_at,
      details: e.details,
    }));

    return NextResponse.json(
      {
        ...project,
        progress_percent: progress,
        total_spent: totalSpent,
        budget_remaining: budget - totalSpent,
        stages,
        last_activity: lastActivity
          ? { created_at: lastActivity.created_at, details: lastActivity.details }
          : null,
        timeline_entries,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки проекта" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const body = await request.json();
    const fields = [
      "name",
      "client",
      "address",
      "phone",
      "start_date",
      "planned_end_date",
      "status",
      "budget",
      "manager",
      "object_type",
      "area_sqm",
      "note",
      "archived",
    ];
    const updates: Record<string, unknown> = {};
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: id,
      action_type: "updated",
      entity_type: "project",
      entity_id: id,
      details: "Обновлена информация по проекту",
      user_name: (body.manager as string) || null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}
