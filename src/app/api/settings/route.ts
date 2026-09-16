import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_STAGES, PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS, normalizeTemplateStageName } from "@/lib/constants";
import { requireAuth, requireSettingsAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

const DEFAULT_OBJECT_TYPES = [
  "Коттедж",
  "ЖК",
  "Таунхаусы",
  "Коммерческое здание",
  "Реконструкция",
];

function settingsTableHint(message: string, table: string) {
  const missing =
    /schema cache|Could not find the table|does not exist|relation .* does not exist/i.test(
      message
    );
  if (missing) {
    return `Таблица ${table} ещё не создана. В Supabase SQL Editor выполните файл supabase/migrations/20260316_create_settings_directories.sql`;
  }
  return `В Supabase SQL Editor: alter table public.${table} disable row level security;`;
}

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
  if (stagesRes.error) {
    console.warn("setting_default_stages:", stagesRes.error.message);
  }
  const default_stages =
    !stagesRes.error && stagesRes.data && stagesRes.data.length > 0
      ? [...stagesRes.data]
          .map((s, i) => ({
            id: Number(s.id),
            name: normalizeTemplateStageName(s.name),
            order_index: typeof s.order_index === "number" ? s.order_index : i,
          }))
          .sort((a, b) => a.order_index - b.order_index)
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
    usage: await loadUsage(managers.map((m) => m.name), object_types.map((o) => o.name)),
  };
}

async function loadUsage(managerNames: string[], typeNames: string[]) {
  const [{ data: projects }, { data: stages }] = await Promise.all([
    supabase.from("projects").select("manager, foreman, object_type"),
    supabase.from("stages").select("responsible"),
  ]);

  const managerUsage: Record<string, number> = {};
  for (const name of managerNames) managerUsage[name] = 0;
  const typeUsage: Record<string, number> = {};
  for (const name of typeNames) typeUsage[name] = 0;

  for (const p of projects ?? []) {
    if (p.manager && managerUsage[p.manager] !== undefined) managerUsage[p.manager]++;
    if (p.foreman && managerUsage[p.foreman] !== undefined) managerUsage[p.foreman]++;
    if (p.object_type && typeUsage[p.object_type] !== undefined) typeUsage[p.object_type]++;
  }
  for (const s of stages ?? []) {
    if (s.responsible && managerUsage[s.responsible] !== undefined) {
      managerUsage[s.responsible]++;
    }
  }

  return { managers: managerUsage, object_types: typeUsage };
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
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
  const auth = await requireSettingsAuth();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();

    if (body.managers !== undefined && Array.isArray(body.managers)) {
      // Rename propagation: keep project/stage assignments when ФИО changes
      const { data: prevManagers } = await supabase
        .from("setting_managers")
        .select("id, name");
      const nextById = new Map<number, string>(
        (body.managers as { id?: number; name: string }[])
          .filter((m) => typeof m.id === "number")
          .map((m) => [m.id as number, m.name])
      );
      for (const prev of prevManagers ?? []) {
        const nextName = nextById.get(prev.id);
        if (nextName && nextName !== prev.name) {
          await Promise.all([
            supabase.from("projects").update({ manager: nextName }).eq("manager", prev.name),
            supabase.from("projects").update({ foreman: nextName }).eq("foreman", prev.name),
            supabase.from("stages").update({ responsible: nextName }).eq("responsible", prev.name),
          ]);
        }
      }

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
      const rows = (body.default_stages as { id?: number; name: string; order_index?: number }[]).map(
        (s, i) => ({
          id: typeof s.id === "number" ? s.id : i + 1,
          name: String(s.name ?? "").trim(),
          order_index: typeof s.order_index === "number" ? s.order_index : i,
        })
      );

      if (rows.some((r) => !r.name)) {
        return NextResponse.json({ error: "Название этапа не может быть пустым" }, { status: 400 });
      }

      // Full replace: update-in-place fails silently under RLS (0 rows, no error).
      const { error: delError } = await supabase
        .from("setting_default_stages")
        .delete()
        .not("id", "is", null);
      if (delError) {
        return NextResponse.json(
          {
            error: `Не удалось обновить этапы: ${delError.message}. ${settingsTableHint(delError.message, "setting_default_stages")}`,
          },
          { status: 500 }
        );
      }

      if (rows.length > 0) {
        const { error: insError } = await supabase.from("setting_default_stages").insert(rows);
        if (insError) {
          return NextResponse.json(
            {
              error: `Не удалось сохранить этапы: ${insError.message}. ${settingsTableHint(insError.message, "setting_default_stages")}`,
            },
            { status: 500 }
          );
        }
      }

      // Verify order actually persisted (RLS can no-op writes without error)
      const { data: verify, error: verifyError } = await supabase
        .from("setting_default_stages")
        .select("id, name, order_index")
        .order("order_index");
      if (verifyError) {
        return NextResponse.json(
          {
            error: `Этапы записаны, но не читаются: ${verifyError.message}. ${settingsTableHint(verifyError.message, "setting_default_stages")}`,
          },
          { status: 500 }
        );
      }
      const got = (verify ?? []).map((r) => `${r.id}:${r.order_index}`).join(",");
      const want = rows.map((r) => `${r.id}:${r.order_index}`).join(",");
      if (got !== want) {
        return NextResponse.json(
          {
            error: `Порядок этапов не сохранился. ${settingsTableHint("schema cache", "setting_default_stages")}`,
          },
          { status: 500 }
        );
      }
    }

    if (body.object_types !== undefined && Array.isArray(body.object_types)) {
      const typesRes = await supabase.from("setting_object_types").select("id").limit(1);
      if (!typesRes.error) {
        const { data: prevTypes } = await supabase
          .from("setting_object_types")
          .select("id, name");
        const nextById = new Map<number, string>(
          (body.object_types as { id?: number; name: string }[])
            .filter((o) => typeof o.id === "number")
            .map((o) => [o.id as number, o.name])
        );
        for (const prev of prevTypes ?? []) {
          const nextName = nextById.get(prev.id);
          if (nextName && nextName !== prev.name) {
            await supabase
              .from("projects")
              .update({ object_type: nextName })
              .eq("object_type", prev.name);
          }
        }

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
