const KEY = "stroiuchot-local-projects-v1";

export type ClientLocalProject = {
  id: number;
  name: string;
  client: string;
  address: string;
  phone: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  status: string;
  budget: number;
  manager: string | null;
  foreman?: string | null;
  object_type: string | null;
  area_sqm: number | null;
  note: string | null;
  archived?: boolean;
  created_at: string;
  updated_at: string;
  progress_percent?: number;
  active_stages?: number;
  total_stages?: number;
  completed_stages?: number;
  preview_photos?: { file_path: string; comment: string | null }[];
  last_activity_at?: string | null;
  last_activity_summary?: string | null;
  today_photos_count?: number;
  total_spent?: number;
  budget_remaining?: number;
  stages?: unknown[];
  storage?: string;
};

function readAll(): ClientLocalProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: ClientLocalProject[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listClientLocalProjects(): ClientLocalProject[] {
  return readAll().sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function getClientLocalProject(id: number): ClientLocalProject | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function upsertClientLocalProject(project: ClientLocalProject) {
  const all = readAll().filter((p) => p.id !== project.id);
  all.push({ ...project, storage: "local" });
  writeAll(all);
}

export function setClientLocalArchived(id: number, archived: boolean) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], archived, updated_at: new Date().toISOString() };
  writeAll(all);
}

/** Overwrite device cache from shared server list (keeps phones/PC in sync). */
export function replaceClientLocalProjects(projects: ClientLocalProject[]) {
  writeAll(projects.map((p) => ({ ...p, storage: p.storage || "local" })));
}

export function mergeProjectsWithClientLocal<T extends { id: number; archived?: boolean }>(
  remote: T[]
): Array<T | ClientLocalProject> {
  const local = listClientLocalProjects();
  if (local.length === 0) return remote;
  const remoteIds = new Set(remote.map((p) => p.id));
  // Active list: don't re-inject archived local-only cards
  const extras = local.filter((p) => !remoteIds.has(p.id) && !p.archived);
  return [...extras, ...remote];
}
