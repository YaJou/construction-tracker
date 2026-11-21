import { DEFAULT_STAGES, normalizeTemplateStageName } from "@/lib/constants";
import { STAGE_TEMPLATES, formatSubstepName } from "@/lib/stageTemplates";
import {
  ensureStoreReady,
  flushStore,
  store,
  type Project,
  type ProjectStatus,
} from "@/lib/store";

export type CreateProjectInput = {
  name: string;
  client: string;
  address: string;
  phone?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
  status?: string;
  budget?: number;
  manager?: string | null;
  foreman?: string | null;
  object_type?: string | null;
  area_sqm?: number | null;
  note?: string | null;
  actorName?: string;
};

export async function createProjectLocal(input: CreateProjectInput): Promise<number> {
  await ensureStoreReady();
  const projectId = store.createProject({
    name: input.name,
    client: input.client,
    address: input.address,
    phone: input.phone ?? null,
    start_date: input.start_date ?? null,
    planned_end_date: input.planned_end_date ?? null,
    status: (input.status as ProjectStatus) || "planning",
    budget: input.budget ?? 0,
    manager: input.manager ?? null,
    foreman: input.foreman ?? null,
    object_type: input.object_type ?? null,
    area_sqm: input.area_sqm ?? null,
    note: input.note ?? null,
  });

  const settings = store.getSettings();
  const stageNames =
    settings.default_stages?.length > 0
      ? [...settings.default_stages]
          .sort((a, b) => a.order_index - b.order_index)
          .map((s) => normalizeTemplateStageName(s.name))
      : DEFAULT_STAGES.map((n) => normalizeTemplateStageName(n));

  store.initStagesForProject(projectId, stageNames);

  const stages = store.getStages(projectId);
  for (const stage of stages) {
    const tpl = STAGE_TEMPLATES.find(
      (t) => t.name === stage.name || normalizeTemplateStageName(t.name) === stage.name
    );
    const names = tpl ? tpl.substeps.map((s) => formatSubstepName(s)) : [];
    for (const name of names) {
      store.addSubstep(stage.id, name);
    }
  }

  store.addActivity({
    project_id: projectId,
    action_type: "created",
    entity_type: "project",
    entity_id: projectId,
    details: "Создан проект",
    user_name: input.actorName || "Гость",
  });

  await flushStore();
  return projectId;
}

export async function listProjectsLocal(): Promise<Project[]> {
  await ensureStoreReady();
  return store.getProjects();
}

export async function getProjectLocal(id: number) {
  await ensureStoreReady();
  const project = store.getProject(id);
  if (!project) return null;
  const stages = store.getStages(id).map((s) => ({
    ...s,
    substeps: store.getSubsteps(s.id),
  }));
  const expenses = store.getExpenses(id);
  const activity = store.getActivity(id).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const totalStages = stages.length;
  const completedStages = stages.filter((s) => s.status === "completed").length;
  const progress =
    totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const budget = Number(project.budget) || 0;
  const lastActivity = activity[0] ?? null;

  return {
    ...project,
    progress_percent: progress,
    total_spent: totalSpent,
    budget_remaining: budget - totalSpent,
    stages,
    last_activity: lastActivity
      ? { created_at: lastActivity.created_at, details: lastActivity.details }
      : null,
    timeline_entries: activity.slice(0, 50).map((e) => ({
      created_at: e.created_at,
      details: e.details,
    })),
  };
}
