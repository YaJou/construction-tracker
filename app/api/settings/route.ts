import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_STAGES, PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const DEFAULT_OBJECT_TYPES = [
  "Коттедж",
  "ЖК",
  "Таунхаусы",
  "Коммерческое здание",
  "Реконструкция",
];

async function loadSettings() {
  const [managersRes, stagesRes, typesRes] = await Promise.all([
    supabase.from("setting_managers").select("id, name").order("id"),
    supabase.from("setting_default_stages").select("id, name, order_index").order("order_index"),
    supabase.from("setting_object_types").select("id, name").order("id"),
  ]);

  const managers = managersRes.data ?? [];
  const default_stages =
    stagesRes.data && stagesRes.data.length > 0
      ? stagesRes.data
      : DEFAULT_STAGES.map((name, i) => ({ id: i + 1, name, order_index: i }));
  const object_types =
    typesRes.data && typesRes.data.length > 0
      ? typesRes.data
      : DEFAULT_OBJECT_TYPES.map((name, i) => ({ id: i + 1, name }));

  return {
    default_stages,
    managers,
    object_types,
    project_statuses: Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
    })),
    stage_statuses: Object.entries(STAGE_STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
    })),
  };
}

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки настроек" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (body.managers !== undefined && Array.isArray(body.managers)) {
      await supabase.from("setting_managers").delete().neq("id", 0);
      if (body.managers.length > 0) {
        await supabase.from("setting_managers").insert(
          body.managers.map((m: { id?: number; name: string }, i: number) => ({
            id: typeof m.id === "number" ? m.id : i + 1,
            name: m.name,
          }))
        );
      }
    }

    if (body.default_stages !== undefined && Array.isArray(body.default_stages)) {
      await supabase.from("setting_default_stages").delete().neq("id", 0);
      if (body.default_stages.length > 0) {
        await supabase.from("setting_default_stages").insert(
          body.default_stages.map(
            (s: { id?: number; name: string; order_index?: number }, i: number) => ({
              id: typeof s.id === "number" ? s.id : i + 1,
              name: s.name,
              order_index: s.order_index ?? i,
            })
          )
        );
      }
    }

    if (body.object_types !== undefined && Array.isArray(body.object_types)) {
      const typesRes = await supabase.from("setting_object_types").select("id").limit(1);
      if (!typesRes.error) {
        await supabase.from("setting_object_types").delete().neq("id", 0);
        if (body.object_types.length > 0) {
          await supabase.from("setting_object_types").insert(
            body.object_types.map((o: { id?: number; name: string }, i: number) => ({
              id: typeof o.id === "number" ? o.id : i + 1,
              name: o.name,
            }))
          );
        }
      }
    }

    return NextResponse.json(await loadSettings());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сохранения настроек" }, { status: 500 });
  }
}
