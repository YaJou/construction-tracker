import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function getProjectIdFromUrl(url: string): number {
  const segments = new URL(url).pathname.split("/");
  const idx = segments.indexOf("projects");
  return Number(idx >= 0 ? segments[idx + 1] : NaN);
}

export async function POST(request: Request) {
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const body = await request.json();
    const stageId = Number(body.stageId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!stageId || !name) return NextResponse.json({ error: "Укажите stageId и name" }, { status: 400 });

    const { data: stage } = await supabase
      .from("stages")
      .select("id")
      .eq("id", stageId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!stage) return NextResponse.json({ error: "Этап не найден" }, { status: 404 });

    const { data: existing } = await supabase
      .from("stage_substeps")
      .select("order_index")
      .eq("stage_id", stageId)
      .order("order_index", { ascending: false })
      .limit(1);

    const order_index = existing && existing.length ? existing[0].order_index + 1 : 0;

    const { data: inserted, error } = await supabase
      .from("stage_substeps")
      .insert({ stage_id: stageId, name, completed: false, order_index })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка добавления подэтапа" }, { status: 500 });
    }
    return NextResponse.json({ id: inserted.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка добавления подэтапа" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const body = await request.json();
    const substepId = Number(body.substepId);
    if (!substepId) return NextResponse.json({ error: "Укажите substepId" }, { status: 400 });

    const updates: { name?: string; completed?: boolean } = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.completed !== undefined) updates.completed = Boolean(body.completed);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    const { error } = await supabase.from("stage_substeps").update(updates).eq("id", substepId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка обновления подэтапа" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления подэтапа" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const body = await request.json();
    const substepId = Number(body.substepId);
    if (!substepId) return NextResponse.json({ error: "Укажите substepId" }, { status: 400 });

    const { error } = await supabase.from("stage_substeps").delete().eq("id", substepId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка удаления подэтапа" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления подэтапа" }, { status: 500 });
  }
}
