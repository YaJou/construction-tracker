import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getAccessibleProjectIds } from "@/lib/auth/projectAccess";

export const dynamic = "force-dynamic";

function periodStart(period: string): Date {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = period === "7d" ? 7 : 30;
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";
    const from = periodStart(period);
    const fromIso = from.toISOString();
    const fromDate = from.toISOString().slice(0, 10);
    const monthFrom = monthStart().toISOString();

    const accessible = await getAccessibleProjectIds(auth.ctx);

    const [activeRes, expensesRes, completedRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, budget")
        .eq("archived", false)
        .neq("status", "completed"),
      supabase
        .from("expenses")
        .select("amount, date, project_id")
        .gte("date", fromDate),
      supabase
        .from("stages")
        .select("id, project_id, end_date, updated_at, status")
        .eq("status", "completed")
        .or(`end_date.gte.${monthFrom.slice(0, 10)},and(end_date.is.null,updated_at.gte.${monthFrom})`),
    ]);

    if (activeRes.error) console.error(activeRes.error);
    if (expensesRes.error) console.error(expensesRes.error);
    if (completedRes.error) console.error(completedRes.error);

    const activeProjects =
      accessible === "all"
        ? (activeRes.data ?? [])
        : (activeRes.data ?? []).filter((p) => accessible.includes(p.id));
    const activeIds = new Set(activeProjects.map((p) => p.id));
    const budget = activeProjects.reduce((s, p) => s + Number(p.budget || 0), 0);

    const spentInPeriod = (expensesRes.data ?? [])
      .filter((e) => activeIds.has(e.project_id))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const completedThisMonth = (completedRes.data ?? []).filter((s) =>
      accessible === "all" ? true : accessible.includes(s.project_id)
    ).length;

    return NextResponse.json(
      {
        period,
        period_from: fromIso,
        active_count: activeProjects.length,
        budget,
        spent_in_period: spentInPeriod,
        completed_stages_this_month: completedThisMonth,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка KPI" }, { status: 500 });
  }
}
