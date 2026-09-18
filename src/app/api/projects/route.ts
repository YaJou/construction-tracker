import { NextResponse } from "next/server";
import { DEFAULT_STAGES, normalizeTemplateStageName } from "@/lib/constants";
import { STAGE_TEMPLATES, formatSubstepName } from "@/lib/stageTemplates";
import { supabase } from "@/lib/supabaseClient";
import { actorName, requireAuth, requireWriteAuth } from "@/lib/auth/requireAuth";
import { addProjectMember, getAccessibleProjectIds } from "@/lib/auth/projectAccess";

export const dynamic = "force-dynamic";

function getCityFromAddress(address: string): string {
  const part = address.split(",")[0]?.trim() ?? "";
  return part;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase() || "";
    const managerFilter = searchParams.get("manager") ?? "";
    const clientFilter = searchParams.get("client") ?? "";
    const cityFilter = searchParams.get("city") ?? "";
    const foremanFilter = searchParams.get("foreman") ?? "";
    const objectTypeFilter = searchParams.get("object_type") ?? "";
    const list = searchParams.get("list") ?? "active"; // active | completed | archived

    // 1. Все проекты (с фильтром доступа для не-руководителей)
    const { data: allProjectsRaw, error: projectsError } = await supabase
      .from("projects")
      .select("*");

    if (projectsError || !allProjectsRaw) {
      console.error(projectsError);
      return NextResponse.json(
        { error: "Ошибка загрузки проектов" },
        { status: 500 }
      );
    }

    const accessible = await getAccessibleProjectIds(auth.ctx);
    const scopedProjects =
      accessible === "all"
        ? allProjectsRaw
        : allProjectsRaw.filter((p) => accessible.includes(p.id));

    let allProjects = [...scopedProjects];

    // Фильтрация по list
    if (list === "active") {
      allProjects = allProjects.filter(
        (p) => !p.archived && p.status !== "completed"
      );
    } else if (list === "completed") {
      allProjects = allProjects.filter(
        (p) => !p.archived && p.status === "completed"
      );
    } else if (list === "archived") {
      allProjects = allProjects.filter((p) => !!p.archived);
    }

    // Для фильтров — только доступные объекты
    const allProjectsForOptions = scopedProjects;

    // Настройки менеджеров
    const { data: settingManagers, error: managersError } = await supabase
      .from("setting_managers")
      .select("name");

    if (managersError) {
      console.error(managersError);
    }

    const settingsManagers =
      settingManagers?.map((m) => m.name).filter(Boolean) ?? [];

    const fromProjects = allProjectsForOptions
      .map((p) => p.manager)
      .filter(Boolean) as string[];

    const cities = [
      ...new Set(
        allProjectsForOptions
          .map((p) => getCityFromAddress(p.address))
          .filter(Boolean)
      ),
    ].sort();

    // Для responsibles нужно посмотреть в stages
    const { data: allStagesForOptions, error: stagesForOptionsError } =
      await supabase.from("stages").select("project_id,responsible");

    if (stagesForOptionsError) {
      console.error(stagesForOptionsError);
    }

    const responsibles = [
      ...new Set([
        ...settingsManagers,
        ...(allProjectsForOptions
          .map((p) => (p as { foreman?: string | null }).foreman)
          .filter(Boolean) as string[]),
        ...(allStagesForOptions ?? [])
          .map((s) => s.responsible)
          .filter(Boolean) as string[],
      ]),
    ].sort();

    const filter_options = {
      managers: [...new Set([...settingsManagers, ...fromProjects])].sort(),
      clients: [
        ...new Set(
          allProjectsForOptions.map((p) => p.client).filter(Boolean)
        ),
      ] as string[],
      cities,
      responsibles,
    };

    // Доп. фильтры по проектам
    let projects = allProjects;
    if (status) projects = projects.filter((p) => p.status === status);
    if (search) {
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.client.toLowerCase().includes(search) ||
          p.address.toLowerCase().includes(search)
      );
    }
    if (managerFilter)
      projects = projects.filter((p) => p.manager === managerFilter);
    if (clientFilter)
      projects = projects.filter((p) => p.client === clientFilter);
    if (objectTypeFilter)
      projects = projects.filter(
        (p) => (p as { object_type?: string | null }).object_type === objectTypeFilter
      );
    if (cityFilter)
      projects = projects.filter(
        (p) => getCityFromAddress(p.address) === cityFilter
      );

    if (foremanFilter) {
      const matchedIds = new Set<number>();
      for (const p of projects) {
        if ((p as { foreman?: string | null }).foreman === foremanFilter) {
          matchedIds.add(p.id);
        }
      }
      const { data: stagesForFilter, error: stagesForFilterError } =
        await supabase
          .from("stages")
          .select("project_id,responsible")
          .eq("responsible", foremanFilter);

      if (stagesForFilterError) {
        console.error(stagesForFilterError);
      }
      for (const s of stagesForFilter ?? []) matchedIds.add(s.project_id);
      projects = projects.filter((p) => matchedIds.has(p.id));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const projectIds = projects.map((p) => p.id);

    // 2. Batch related rows (avoids N+1 round-trips)
    type StageRow = {
      id: number;
      project_id: number;
      status: string;
      order_index: number;
      updated_at: string;
    };
    type PhotoRow = {
      project_id: number;
      file_path: string;
      thumbnail_url?: string | null;
      comment: string | null;
      created_at: string;
    };
    type ExpenseRow = { project_id: number; amount: number; created_at: string };
    type ActivityRow = {
      project_id: number;
      details: string | null;
      created_at: string;
    };

    let allStages: StageRow[] = [];
    let allPhotos: PhotoRow[] = [];
    let allExpenses: ExpenseRow[] = [];
    let allActivity: ActivityRow[] = [];

    if (projectIds.length > 0) {
      const [stagesRes, photosRes, expensesRes, activityRes] = await Promise.all([
        supabase
          .from("stages")
          .select("id, project_id, status, order_index, updated_at")
          .in("project_id", projectIds),
        supabase
          .from("photos")
          .select("project_id, file_path, thumbnail_url, comment, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("project_id, amount, created_at")
          .in("project_id", projectIds),
        supabase
          .from("activity_log")
          .select("project_id, details, created_at")
          .in("project_id", projectIds)
          .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
          .order("created_at", { ascending: false }),
      ]);

      allStages = (stagesRes.data as StageRow[]) ?? [];
      allPhotos = (photosRes.data as PhotoRow[]) ?? [];
      // thumbnail_url may be missing on older DBs
      if (photosRes.error && /thumbnail_url/i.test(photosRes.error.message || "")) {
        const retry = await supabase
          .from("photos")
          .select("project_id, file_path, comment, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false });
        allPhotos = (retry.data as PhotoRow[]) ?? [];
      }
      allExpenses = (expensesRes.data as ExpenseRow[]) ?? [];
      allActivity = (activityRes.data as ActivityRow[]) ?? [];
    }

    const stagesByProject = new Map<number, StageRow[]>();
    for (const s of allStages) {
      const list = stagesByProject.get(s.project_id) || [];
      list.push(s);
      stagesByProject.set(s.project_id, list);
    }
    const photosByProject = new Map<number, PhotoRow[]>();
    for (const ph of allPhotos) {
      const list = photosByProject.get(ph.project_id) || [];
      list.push(ph);
      photosByProject.set(ph.project_id, list);
    }
    const expensesByProject = new Map<number, ExpenseRow[]>();
    for (const e of allExpenses) {
      const list = expensesByProject.get(e.project_id) || [];
      list.push(e);
      expensesByProject.set(e.project_id, list);
    }
    const activityByProject = new Map<number, ActivityRow[]>();
    for (const a of allActivity) {
      const list = activityByProject.get(a.project_id) || [];
      list.push(a);
      activityByProject.set(a.project_id, list);
    }

    const withProgress = projects.map((p) => {
      const stages = (stagesByProject.get(p.id) || []).sort(
        (a, b) => a.order_index - b.order_index
      );
      const photos = photosByProject.get(p.id) || [];
      const expenses = expensesByProject.get(p.id) || [];
      const activityLog = activityByProject.get(p.id) || [];

      const total = stages.length;
      const completed = stages.filter((s) => s.status === "completed").length;
      const active = stages.filter((s) => s.status === "in_progress").length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      const dates: { date: Date; summary?: string }[] = [
        { date: new Date(p.updated_at), summary: "Обновление проекта" },
        ...activityLog.map((a) => ({
          date: new Date(a.created_at),
          summary: a.details ?? undefined,
        })),
        ...photos.map((ph) => ({ date: new Date(ph.created_at) })),
        ...expenses.map((e) => ({ date: new Date(e.created_at) })),
        ...stages.map((s) => ({ date: new Date(s.updated_at) })),
      ].filter((x) => !Number.isNaN(x.date.getTime()));

      const lastActivity = dates.length
        ? dates.reduce((best, cur) => (cur.date > best.date ? cur : best))
        : null;
      const last_activity_at = lastActivity?.date.toISOString() ?? null;
      const last_activity_summary = lastActivity?.summary ?? null;
      const today_photos_count = photos.filter(
        (ph) =>
          new Date(ph.created_at) >= todayStart && new Date(ph.created_at) < todayEnd
      ).length;

      const total_spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      const preview_photos = photos.slice(0, 2).map((ph) => ({
        file_path: ph.thumbnail_url || ph.file_path,
        comment: ph.comment,
      }));

      return {
        ...p,
        progress_percent: progress,
        active_stages: active,
        total_stages: total,
        completed_stages: completed,
        preview_photos,
        last_activity_at,
        last_activity_summary,
        today_photos_count,
        total_spent,
        budget_remaining: Number(p.budget) - total_spent,
      };
    });

    withProgress.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json(
      { projects: withProgress, filter_options },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Ошибка загрузки проектов" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const {
      name,
      client,
      address,
      phone,
      start_date,
      planned_end_date,
      status,
      budget,
      manager,
      foreman,
      object_type,
      area_sqm,
      note,
    } = body;

    if (!name || !client || !address) {
      return NextResponse.json(
        { error: "Укажите название, клиента и адрес" },
        { status: 400 }
      );
    }

    const projectPayload: Record<string, unknown> = {
      name: String(name).trim(),
      client: String(client).trim(),
      address: String(address).trim(),
      phone:
        phone != null && String(phone).trim()
          ? String(phone).trim()
          : null,
      start_date: start_date || null,
      planned_end_date: planned_end_date || null,
      status: status || "planning",
      budget: budget ?? 0,
      manager: manager || null,
      object_type:
        object_type != null && String(object_type).trim()
          ? String(object_type).trim()
          : null,
      area_sqm:
        area_sqm != null && area_sqm !== "" ? Number(area_sqm) : null,
      note:
        note != null && String(note).trim()
          ? String(note).trim()
          : null,
    };
    if (foreman !== undefined) {
      projectPayload.foreman =
        foreman != null && String(foreman).trim() ? String(foreman).trim() : null;
    }

    // 1. Создаём проект
    let { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert(projectPayload)
      .select("id")
      .single();

    // Backward-compatible if foreman column not migrated yet
    if (insertError && String(insertError.message || "").includes("foreman")) {
      delete projectPayload.foreman;
      ({ data: inserted, error: insertError } = await supabase
        .from("projects")
        .insert(projectPayload)
        .select("id")
        .single());
    }

    if (insertError || !inserted) {
      console.error(insertError);
      return NextResponse.json(
        { error: "Ошибка создания проекта" },
        { status: 500 }
      );
    }

    const projectId = inserted.id as number;

    // Creator becomes project member
    try {
      const memberRole =
        auth.ctx.profile.role === "owner"
          ? "owner"
          : auth.ctx.profile.role === "foreman"
            ? "foreman"
            : "manager";
      await addProjectMember(auth.ctx, projectId, auth.ctx.user.id, memberRole);
    } catch (e) {
      console.warn("project_members insert:", e);
    }

    // 2. Этапы из справочника (+ подэтапы шаблона)
    const { data: settingsStages, error: settingsStagesError } = await supabase
      .from("setting_default_stages")
      .select("id, name, order_index")
      .order("order_index", { ascending: true });

    if (settingsStagesError) {
      console.error(settingsStagesError);
    }

    const stageTemplates =
      settingsStages && settingsStages.length > 0
        ? [...settingsStages]
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => ({
              id: Number(s.id),
              name: normalizeTemplateStageName(s.name),
            }))
        : DEFAULT_STAGES.map((name, i) => ({ id: i + 1, name }));

    const { data: settingSubsteps } = await supabase
      .from("setting_default_substeps")
      .select("stage_id, name, order_index")
      .order("order_index", { ascending: true });

    const subByStage = new Map<number, { name: string; order_index: number }[]>();
    for (const row of settingSubsteps ?? []) {
      const list = subByStage.get(Number(row.stage_id)) ?? [];
      list.push({ name: row.name, order_index: row.order_index ?? list.length });
      subByStage.set(Number(row.stage_id), list);
    }

    function substepsForTemplateStage(stageId: number, stageName: string) {
      const fromDb = subByStage.get(stageId);
      if (fromDb && fromDb.length > 0) {
        return [...fromDb].sort((a, b) => a.order_index - b.order_index).map((s) => s.name);
      }
      const tpl = STAGE_TEMPLATES.find((t) => t.name === stageName);
      return tpl ? tpl.substeps.map((s) => formatSubstepName(s)) : [];
    }

    // 3. Создаём этапы и копируем подэтапы из шаблона
    if (stageTemplates.length > 0) {
      const now = new Date().toISOString();
      const rows = stageTemplates.map((s, idx) => ({
        project_id: projectId,
        name: s.name,
        order_index: idx,
        status: "not_started",
        start_date: null,
        end_date: null,
        responsible: null,
        comment: null,
        progress_percent: 0,
        created_at: now,
        updated_at: now,
      }));
      const { data: insertedStages, error: stagesInsertError } = await supabase
        .from("stages")
        .insert(rows)
        .select("id, name, order_index");
      if (stagesInsertError) {
        console.error(stagesInsertError);
      } else {
        const subRows: {
          stage_id: number;
          name: string;
          completed: boolean;
          order_index: number;
          not_required?: boolean;
          on_review?: boolean;
        }[] = [];
        for (const created of insertedStages ?? []) {
          const tpl = stageTemplates.find(
            (t) => t.name === created.name || normalizeTemplateStageName(t.name) === created.name
          );
          const names = substepsForTemplateStage(tpl?.id ?? -1, created.name);
          names.forEach((name, j) => {
            subRows.push({
              stage_id: created.id,
              name,
              completed: false,
              order_index: j,
              not_required: false,
              on_review: false,
            });
          });
        }
        if (subRows.length > 0) {
          const { error: subErr } = await supabase.from("stage_substeps").insert(subRows);
          if (subErr) {
            // Columns not_required/on_review may be missing — retry minimal shape
            console.warn("stage_substeps insert:", subErr.message);
            const { error: retryErr } = await supabase.from("stage_substeps").insert(
              subRows.map(({ stage_id, name, completed, order_index }) => ({
                stage_id,
                name,
                completed,
                order_index,
              }))
            );
            if (retryErr) console.error(retryErr);
          }
        }
      }
    }

    // 4. Лог активности
    const { error: activityError } = await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "project",
      entity_id: projectId,
      details: "Создан проект",
      user_name: actorName(auth.ctx),
    });

    if (activityError) {
      console.error(activityError);
    }

    return NextResponse.json({ id: projectId });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Ошибка создания проекта" },
      { status: 500 }
    );
  }
}