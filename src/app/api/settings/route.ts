import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_STAGES,
  PROJECT_STATUS_LABELS,
  STAGE_STATUS_LABELS,
  defaultStagesWithSubsteps,
  normalizeTemplateStageName,
} from "@/lib/constants";
import { STAGE_TEMPLATES, formatSubstepName } from "@/lib/stageTemplates";
import { requireAuth, requireSettingsAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

const DEFAULT_OBJECT_TYPES = [
  "Коттедж",
  "ЖК",
  "Таунхаусы",
  "Коммерческое здание",
  "Реконструкция",
];

type StageRow = {
  id: number;
  name: string;
  order_index: number;
  substeps: { id: number; name: string; order_index: number }[];
};

function settingsTableHint(message: string, table: string) {
  const missing =
    /schema cache|Could not find the table|does not exist|relation .* does not exist/i.test(
      message
    );
  if (missing) {
    return `Таблица ${table} ещё не создана. В Supabase SQL Editor выполните supabase/migrations/20260316_create_settings_directories.sql и 20260316_setting_default_substeps.sql, затем 20260316_fix_settings_rls.sql`;
  }
  return `В Supabase SQL Editor выполните supabase/migrations/20260316_fix_settings_rls.sql`;
}

function templateSubstepsForStage(stageName: string) {
  const tpl = STAGE_TEMPLATES.find(
    (t) => t.name === normalizeTemplateStageName(stageName)
  );
  if (!tpl) return [];
  return tpl.substeps.map((s, j) => ({
    id: j + 1,
    name: formatSubstepName(s),
    order_index: j,
  }));
}

async function loadStatusOverrides(kind: "project" | "stage") {
  const { data, error } = await supabase
    .from("setting_status_labels")
    .select("key, label")
    .eq("kind", kind);
  if (error) {
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

async function loadDefaultStages(): Promise<StageRow[]> {
  const stagesRes = await supabase
    .from("setting_default_stages")
    .select("id, name, order_index")
    .order("order_index");

  if (stagesRes.error || !stagesRes.data?.length) {
    if (stagesRes.error) console.warn("setting_default_stages:", stagesRes.error.message);
    return defaultStagesWithSubsteps();
  }

  const stages = [...stagesRes.data]
    .map((s, i) => ({
      id: Number(s.id),
      name: normalizeTemplateStageName(s.name),
      order_index: typeof s.order_index === "number" ? s.order_index : i,
    }))
    .sort((a, b) => a.order_index - b.order_index);

  const { data: subRows, error: subErr } = await supabase
    .from("setting_default_substeps")
    .select("id, stage_id, name, order_index")
    .order("order_index");

  if (subErr) {
    console.warn("setting_default_substeps:", subErr.message);
    return stages.map((s) => ({
      ...s,
      substeps: templateSubstepsForStage(s.name),
    }));
  }

  const byStage = new Map<number, { id: number; name: string; order_index: number }[]>();
  for (const row of subRows ?? []) {
    const list = byStage.get(Number(row.stage_id)) ?? [];
    list.push({
      id: Number(row.id),
      name: row.name,
      order_index: typeof row.order_index === "number" ? row.order_index : list.length,
    });
    byStage.set(Number(row.stage_id), list);
  }

  return stages.map((s) => {
    const fromDb = byStage.get(s.id) ?? [];
    return {
      ...s,
      substeps: fromDb.length > 0 ? fromDb.sort((a, b) => a.order_index - b.order_index) : templateSubstepsForStage(s.name),
    };
  });
}

async function loadSettings() {
  const [managersRes, typesRes, projectStatusRes, stageStatusRes, default_stages] =
    await Promise.all([
      supabase.from("setting_managers").select("id, name").order("id"),
      supabase.from("setting_object_types").select("id, name").order("id"),
      loadStatusOverrides("project"),
      loadStatusOverrides("stage"),
      loadDefaultStages(),
    ]);

  const managers = managersRes.data ?? [];
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
      type IncomingStage = {
        id?: number;
        name: string;
        order_index?: number;
        substeps?: { id?: number; name: string; order_index?: number }[];
      };
      const incoming = body.default_stages as IncomingStage[];
      const rows = incoming.map((s, i) => ({
        id: typeof s.id === "number" ? s.id : i + 1,
        name: normalizeTemplateStageName(String(s.name ?? "").trim()),
        order_index: typeof s.order_index === "number" ? s.order_index : i,
        substeps: (s.substeps ?? []).map((sub, j) => ({
          id: typeof sub.id === "number" ? sub.id : (i + 1) * 1000 + j + 1,
          name: String(sub.name ?? "").trim(),
          order_index: typeof sub.order_index === "number" ? sub.order_index : j,
        })),
      }));

      if (rows.some((r) => !r.name)) {
        return NextResponse.json({ error: "Название этапа не может быть пустым" }, { status: 400 });
      }

      // Delete substages first (no cascade if FK missing), then stages
      const { error: delSubError } = await supabase
        .from("setting_default_substeps")
        .delete()
        .not("id", "is", null);
      if (delSubError && !/schema cache|Could not find the table|does not exist/i.test(delSubError.message)) {
        return NextResponse.json(
          {
            error: `Не удалось обновить подэтапы: ${delSubError.message}. ${settingsTableHint(delSubError.message, "setting_default_substeps")}`,
          },
          { status: 500 }
        );
      }

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
        const { error: insError } = await supabase.from("setting_default_stages").insert(
          rows.map(({ id, name, order_index }) => ({ id, name, order_index }))
        );
        if (insError) {
          return NextResponse.json(
            {
              error: `Не удалось сохранить этапы: ${insError.message}. ${settingsTableHint(insError.message, "setting_default_stages")}`,
            },
            { status: 500 }
          );
        }

        const subInserts = rows.flatMap((s) =>
          s.substeps
            .filter((sub) => sub.name)
            .map((sub) => ({
              id: sub.id,
              stage_id: s.id,
              name: sub.name,
              order_index: sub.order_index,
            }))
        );
        if (subInserts.length > 0) {
          const { error: subInsError } = await supabase
            .from("setting_default_substeps")
            .insert(subInserts);
          if (subInsError) {
            return NextResponse.json(
              {
                error: `Не удалось сохранить подэтапы: ${subInsError.message}. ${settingsTableHint(subInsError.message, "setting_default_substeps")}`,
              },
              { status: 500 }
            );
          }
        }
      }

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
