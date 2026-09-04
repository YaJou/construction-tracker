import { NextResponse } from "next/server";
import { DEFAULT_STAGES } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function getCityFromAddress(address: string): string {
  const part = address.split(",")[0]?.trim() ?? "";
  return part;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase() || "";
    const managerFilter = searchParams.get("manager") ?? "";
    const clientFilter = searchParams.get("client") ?? "";
    const cityFilter = searchParams.get("city") ?? "";
    const foremanFilter = searchParams.get("foreman") ?? "";
    const list = searchParams.get("list") ?? "active"; // active | completed | archived

    // 1. Все проекты
    const { data: allProjectsRaw, error: projectsError } = await supabase
      .from("projects")
      .select("*");

    if (projectsError || !allProjectsRaw) {
      console.error(projectsError);
      return NextResponse.json(
        {
          error: "Ошибка загрузки проектов",
          detail: projectsError?.message ?? "no data",
          hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          hasKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        },
        { status: 500 }
      );
    }

    let allProjects = [...allProjectsRaw];

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

    // Для фильтров нужно посмотреть во все проекты (включая завершённые/архив)
    const allProjectsForOptions = allProjectsRaw;

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
    if (cityFilter)
      projects = projects.filter(
        (p) => getCityFromAddress(p.address) === cityFilter
      );

    if (foremanFilter) {
      // Берём id проектов, у которых есть этап с нужным responsible
      const { data: stagesForFilter, error: stagesForFilterError } =
        await supabase
          .from("stages")
          .select("project_id,responsible")
          .eq("responsible", foremanFilter);

      if (stagesForFilterError) {
        console.error(stagesForFilterError);
      }

      const allowedProjectIds = new Set(
        (stagesForFilter ?? []).map((s) => s.project_id)
      );
      projects = projects.filter((p) => allowedProjectIds.has(p.id));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 2. Для каждого проекта подтягиваем стадии, фото, расходы, активность
    const withProgress = await Promise.all(
      projects.map(async (p) => {
        const [stagesRes, photosRes, expensesRes, activityRes] =
          await Promise.all([
            supabase
              .from("stages")
              .select("*")
              .eq("project_id", p.id)
              .order("order_index", { ascending: true }),
            supabase
              .from("photos")
              .select("*")
              .eq("project_id", p.id)
              .order("created_at", { ascending: true }),
            supabase
              .from("expenses")
              .select("*")
              .eq("project_id", p.id)
              .order("created_at", { ascending: true }),
            supabase
              .from("activity_log")
              .select("*")
              .eq("project_id", p.id)
              .order("created_at", { ascending: true }),
          ]);

        const stages = stagesRes.data ?? [];
        const photos = photosRes.data ?? [];
        const expenses = expensesRes.data ?? [];
        const activityLog = activityRes.data ?? [];

        const total = stages.length;
        const completed = stages.filter(
          (s) => s.status === "completed"
        ).length;
        const active = stages.filter(
          (s) => s.status === "in_progress"
        ).length;
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
            new Date(ph.created_at) >= todayStart &&
            new Date(ph.created_at) < todayEnd
        ).length;

        const total_spent = expenses.reduce(
          (sum, e) => sum + Number(e.amount),
          0
        );

        const preview_photos = photos.slice(0, 2).map((ph) => ({
          file_path: ph.file_path,
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
      })
    );

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

    // 1. Создаём проект
    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert({
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
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error(insertError);
      return NextResponse.json(
        { error: "Ошибка создания проекта" },
        { status: 500 }
      );
    }

    const projectId = inserted.id as number;

    // 2. Получаем настройки этапов (setting_default_stages) или DEFAULT_STAGES
    const { data: settingsStages, error: settingsStagesError } =
      await supabase
        .from("setting_default_stages")
        .select("name, order_index")
        .order("order_index", { ascending: true });

    if (settingsStagesError) {
      console.error(settingsStagesError);
    }

    const stageNames =
      settingsStages && settingsStages.length > 0
        ? settingsStages
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => s.name)
        : DEFAULT_STAGES;

    // 3. Создаём этапы
    if (stageNames.length > 0) {
      const now = new Date().toISOString();
      const rows = stageNames.map((name, idx) => ({
        project_id: projectId,
        name,
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
      const { error: stagesInsertError } = await supabase
        .from("stages")
        .insert(rows);
      if (stagesInsertError) {
        console.error(stagesInsertError);
      }
    }

    // 4. Лог активности
    const { error: activityError } = await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "project",
      entity_id: projectId,
      details: "Создан проект",
      user_name: manager || null,
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