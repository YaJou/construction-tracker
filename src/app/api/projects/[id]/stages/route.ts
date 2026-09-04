import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function formatStageUpdateDetails(toUpdate: Record<string, unknown>): string {
  const parts: string[] = [];
  const fmtDate = (dateStr: string) => {
    const [y, m, day] = dateStr.split("-");
    const month = m && MONTHS_RU[parseInt(m, 10) - 1];
    return month && day ? `${parseInt(day, 10)} ${month}` : dateStr;
  };
  const status = toUpdate.status as string | undefined;
  const endDate = toUpdate.end_date !== undefined ? String(toUpdate.end_date) : "";
  if (status === "completed" && endDate) {
    parts.push(`Этап завершён ${fmtDate(endDate)}`);
  } else if (status !== undefined) {
    if (status === "completed") parts.push("этап завершён");
    else if (status === "in_progress") parts.push("этап в работе");
    else if (status === "not_started") parts.push("этап не начат");
    else parts.push(`статус: ${status}`);
  }
  if (toUpdate.start_date !== undefined) {
    const d = String(toUpdate.start_date);
    if (d) parts.push(`начат ${fmtDate(d)}`);
  }
  if (toUpdate.end_date !== undefined && !(status === "completed" && endDate)) {
    const d = String(toUpdate.end_date);
    if (d) parts.push(`завершён ${fmtDate(d)}`);
  }
  if (toUpdate.progress_percent !== undefined && status !== "completed") {
    parts.push(`прогресс ${toUpdate.progress_percent}%`);
  }
  if (toUpdate.name !== undefined) parts.push("изменено название");
  if (toUpdate.comment !== undefined) parts.push("обновлён комментарий");
  if (toUpdate.responsible !== undefined) parts.push("изменён ответственный");
  if (parts.length === 0) return "Этап обновлён";
  return parts.length === 1 ? parts[0] : "Этап: " + parts.join(", ");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectId = Number((await params).id);
    const { data, error } = await supabase
      .from("stages")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true });
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка загрузки этапов" }, { status: 500 });
    }
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки этапов" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { stageId, projectId, ...updates } = body;
    if (!stageId || !projectId) {
      return NextResponse.json({ error: "stageId и projectId обязательны" }, { status: 400 });
    }

    const allowed = ["name", "status", "start_date", "end_date", "responsible", "comment", "progress_percent"];
    const toUpdate: Record<string, unknown> = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) toUpdate[k] = updates[k];
    }
    if (Object.keys(toUpdate).length) {
      toUpdate.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from("stages")
        .update(toUpdate)
        .eq("id", Number(stageId))
        .eq("project_id", Number(projectId));
      if (error) {
        console.error(error);
        return NextResponse.json({ error: "Ошибка обновления этапа" }, { status: 500 });
      }
      await supabase.from("activity_log").insert({
        project_id: Number(projectId),
        action_type: "updated",
        entity_type: "stage",
        entity_id: Number(stageId),
        details: formatStageUpdateDetails(toUpdate),
        user_name: (updates.responsible as string) || null,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления этапа" }, { status: 500 });
  }
}
