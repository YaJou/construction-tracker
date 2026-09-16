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

async function loadStatusOverrides(kind: "project" | "stage") {
  const { data, error } = await supabase
    .from("setting_status_labels")
    .select("key, label")
    .eq("kind", kind);
  if (error) {
    // Table may not exist until migration — fall back to constants
    console.warn("setting_status_labels:", error.message);
    return null;
  }
  return data ?? [];
}

function mergeStatusLabels(
  defaults: Record<string, string>,
  overrides: { key: string; label: string }[] | null
) {
  const map = { ...defaults };
  for (const row of overrides ?? []) {
    if (row.key && row.label) map[row.key] = row.label;
  }
  return Object.entries(map).map(([key, label]) => ({ key, label }));
}

async function loadSettings() {
  const [managersRes, stagesRes, typesRes, projectStatusRes, stageStatusRes] =
    await Promise.all([
      supabase.from("setting_managers").select("id, name").order("id"),
      supabase.from("setting_default_stages").select("id, name, order_index").order("order_index"),
      supabase.from("setting_object_types").select("id, name").order("id"),
      loadStatusOverrides("project"),
      loadStatusOverrides("stage"),
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
    project_statuses: mergeStatusLabels(PROJECT_STATUS_LABELS, projectStatusRes),
    stage_statuses: mergeStatusLabels(STAGE_STATUS_LABELS, stageStatusRes),
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

async function saveStatusLabels(
  kind: "project" | "stage",
  items: { key: string; label: string }[]
) {
  const { error: delError } = await supabase
    .from("setting_status_labels")
    .delete()
    .eq("kind", kind);

  if (delError) {
    // Table missing or RLS blocked
    throw new Error(delError.message);
  }

  if (items.length === 0) return;

  const { error } = await supabase.from("setting_status_labels").insert(
    items.map((item) => ({
      kind,
      key: item.key,
      label: item.label,
    }))
  );
  if (error) throw new Error(error.message);
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

    if (body.project_statuses !== undefined && Array.isArray(body.project_statuses)) {
      try {
        await saveStatusLabels("project", body.project_statuses);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            error: `Не удалось сохранить статусы проекта: ${msg}. В Supabase SQL Editor выполните: alter table public.setting_status_labels disable row level security; (и убедитесь, что таблица создана миграцией).`,
          },
          { status: 500 }
        );
      }
    }

    if (body.stage_statuses !== undefined && Array.isArray(body.stage_statuses)) {
      try {
        await saveStatusLabels("stage", body.stage_statuses);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            error: `Не удалось сохранить статусы этапов: ${msg}. В Supabase SQL Editor выполните: alter table public.setting_status_labels disable row level security;`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(await loadSettings());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сохранения настроек" }, { status: 500 });
  }
}
