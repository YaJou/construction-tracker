import fs from "fs";
import path from "path";
import { DEFAULT_STAGES, PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "./constants";
import { hasRemoteDb, sqlClient } from "./remoteDb";

// На Vercel файловая система только для чтения, кроме /tmp — используем его для данных
const isVercel = process.env.VERCEL === "1";
const dataDir = isVercel ? path.join("/tmp", "stroiuchot-data") : path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "store.json");

export type ProjectStatus = "planning" | "construction" | "paused" | "completed";
export type StageStatus = "not_started" | "in_progress" | "completed";

export interface Project {
  id: number;
  name: string;
  client: string;
  address: string;
  phone: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  status: ProjectStatus;
  budget: number;
  manager: string | null;
  foreman?: string | null;
  object_type: string | null;
  area_sqm: number | null;
  note: string | null;
  archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: number;
  project_id: number;
  name: string;
  order_index: number;
  status: StageStatus;
  start_date: string | null;
  end_date: string | null;
  responsible: string | null;
  comment: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface StageSubstep {
  id: number;
  stage_id: number;
  name: string;
  completed: boolean;
  order_index: number;
}

export interface Photo {
  id: number;
  project_id: number;
  stage_id: number | null;
  file_path: string;
  thumbnail_url?: string | null;
  comment: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  project_id: number;
  date: string;
  category: string;
  description: string | null;
  subcategory?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit?: string | null;
  kind?: string | null;
  amount: number;
  added_by: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: number;
  project_id: number;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  user_name: string | null;
  created_at: string;
}

export interface SettingDefaultStage {
  id: number;
  name: string;
  order_index: number;
}

export interface SettingManager {
  id: number;
  name: string;
}

export interface SettingStatusItem {
  key: string;
  label: string;
}

export interface SettingObjectType {
  id: number;
  name: string;
}

export interface SettingsData {
  default_stages: SettingDefaultStage[];
  managers: SettingManager[];
  object_types: SettingObjectType[];
  project_statuses: SettingStatusItem[];
  stage_statuses: SettingStatusItem[];
}

export interface Store {
  projects: Project[];
  stages: Stage[];
  stage_substeps: StageSubstep[];
  photos: Photo[];
  expenses: Expense[];
  activity_log: ActivityLogEntry[];
  settings: SettingsData;
  seq: { projects: number; stages: number; substages: number; photos: number; expenses: number; activity: number; setting_stages: number; setting_managers: number; setting_object_types: number };
}

function now() {
  return new Date().toISOString();
}

function getDefaultStore(): Store {
  const defaultObjectTypes = ["Коттедж", "ЖК", "Таунхаусы", "Коммерческое здание", "Реконструкция"].map((name, i) => ({ id: i + 1, name }));
  const defaultSettings: SettingsData = {
    default_stages: DEFAULT_STAGES.map((name, i) => ({ id: i + 1, name, order_index: i })),
    managers: [],
    object_types: defaultObjectTypes,
    project_statuses: Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => ({ key, label })),
    stage_statuses: Object.entries(STAGE_STATUS_LABELS).map(([key, label]) => ({ key, label })),
  };
  const defaultSeq = { projects: 0, stages: 0, substages: 0, photos: 0, expenses: 0, activity: 0, setting_stages: 1000, setting_managers: 1000, setting_object_types: 1000 };
  return {
    projects: [],
    stages: [],
    stage_substeps: [],
    photos: [],
    expenses: [],
    activity_log: [],
    settings: defaultSettings,
    seq: defaultSeq,
  };
}

function normalizeStore(data: Partial<Store> | null | undefined): Store {
  const defaultStore = getDefaultStore();
  const defaultObjectTypes = defaultStore.settings.object_types;
  const defaultSettings = defaultStore.settings;
  if (!data || typeof data !== "object") return defaultStore;

  const storeData = data as Store;
  if (!Array.isArray(storeData.projects)) storeData.projects = [];
  if (!Array.isArray(storeData.stages)) storeData.stages = [];
  if (!Array.isArray(storeData.stage_substeps)) storeData.stage_substeps = [];
  if (!Array.isArray(storeData.photos)) storeData.photos = [];
  if (!Array.isArray(storeData.expenses)) storeData.expenses = [];
  if (!Array.isArray(storeData.activity_log)) storeData.activity_log = [];
  if (!storeData.seq) storeData.seq = { ...defaultStore.seq };
  if (storeData.seq.substages == null) storeData.seq.substages = 0;
  if (!storeData.settings) {
    storeData.settings = defaultSettings;
    storeData.seq.setting_stages = 1000;
    storeData.seq.setting_managers = 1000;
    storeData.seq.setting_object_types = 1000;
  }
  if (!storeData.settings.default_stages?.length)
    storeData.settings.default_stages = defaultSettings.default_stages;
  if (!storeData.settings.project_statuses?.length)
    storeData.settings.project_statuses = defaultSettings.project_statuses;
  if (!storeData.settings.stage_statuses?.length)
    storeData.settings.stage_statuses = defaultSettings.stage_statuses;
  if (!Array.isArray(storeData.settings.managers)) storeData.settings.managers = [];
  if (
    !Array.isArray(storeData.settings.object_types) ||
    !storeData.settings.object_types.length
  ) {
    storeData.settings.object_types = defaultObjectTypes;
  }
  if (storeData.seq.setting_object_types == null) storeData.seq.setting_object_types = 1000;
  if (storeData.seq.setting_stages == null)
    storeData.seq.setting_stages = storeData.settings.default_stages.length
      ? Math.max(...storeData.settings.default_stages.map((s) => s.id), 0) + 1
      : 1000;
  if (storeData.seq.setting_managers == null)
    storeData.seq.setting_managers = storeData.settings.managers.length
      ? Math.max(...storeData.settings.managers.map((m) => m.id), 0) + 1
      : 1000;
  if (storeData.seq.setting_object_types == null)
    storeData.seq.setting_object_types = storeData.settings.object_types?.length
      ? Math.max(...storeData.settings.object_types.map((o) => o.id), 0) + 1
      : 1000;
  if (storeData.seq.projects == null) storeData.seq.projects = storeData.projects.length;
  if (storeData.seq.stages == null) storeData.seq.stages = storeData.stages.length;
  storeData.projects.forEach((p) => {
    if (p.phone === undefined) p.phone = null;
    if (p.object_type === undefined) p.object_type = null;
    if (p.area_sqm === undefined) p.area_sqm = null;
    if (p.note === undefined) p.note = null;
  });
  return storeData;
}

function loadFromFile(): Store {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch {
    return getDefaultStore();
  }
  if (!fs.existsSync(dataFile)) return getDefaultStore();
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(dataFile, "utf-8")));
  } catch {
    return getDefaultStore();
  }
}

function saveToFile(storeData: Store) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(storeData, null, 0), "utf-8");
  } catch (e) {
    console.error("[store] save failed:", e);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __stroiuchot_store_cache: Store | undefined;
  // eslint-disable-next-line no-var
  var __stroiuchot_store_loaded_at: number | undefined;
}

const STORE_READ_TTL_MS = 2500;

let cache: Store | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function getStore(): Store {
  if (globalThis.__stroiuchot_store_cache) {
    cache = globalThis.__stroiuchot_store_cache;
    return cache;
  }
  if (!cache) cache = loadFromFile();
  globalThis.__stroiuchot_store_cache = cache;
  return cache;
}

function touchCache(storeData: Store) {
  cache = storeData;
  globalThis.__stroiuchot_store_cache = storeData;
  globalThis.__stroiuchot_store_loaded_at = Date.now();
}

async function loadFromRemote(): Promise<Store> {
  const sql = sqlClient();
  const rows = (await sql`select data from app_store where id = 1`) as {
    data: Partial<Store> | null;
  }[];
  const remote = rows[0]?.data;
  if (remote && typeof remote === "object" && Object.keys(remote).length > 0) {
    return normalizeStore(remote);
  }
  const fresh = getDefaultStore();
  await sql`
    insert into app_store (id, data, updated_at)
    values (1, ${JSON.stringify(fresh)}::jsonb, now())
    on conflict (id) do update
      set data = excluded.data, updated_at = now()
  `;
  return fresh;
}

async function saveToRemote(storeData: Store) {
  const sql = sqlClient();
  await sql`
    insert into app_store (id, data, updated_at)
    values (1, ${JSON.stringify(storeData)}::jsonb, now())
    on conflict (id) do update
      set data = excluded.data, updated_at = now()
  `;
}

/** Load shared state before local create/list (Neon when available). */
export async function ensureStoreReady() {
  if (!hasRemoteDb()) {
    getStore();
    return;
  }
  const loadedAt = globalThis.__stroiuchot_store_loaded_at ?? 0;
  if (
    globalThis.__stroiuchot_store_cache &&
    Date.now() - loadedAt < STORE_READ_TTL_MS
  ) {
    cache = globalThis.__stroiuchot_store_cache;
    return;
  }
  try {
    touchCache(await loadFromRemote());
  } catch (e) {
    console.error("[store] remote load failed, using file:", e);
    getStore();
    globalThis.__stroiuchot_store_loaded_at = Date.now();
  }
}

export async function flushStore() {
  await persistQueue;
}

function persist() {
  if (!cache) return;
  touchCache(cache);
  saveToFile(cache);
  if (hasRemoteDb()) {
    const snapshot = cache;
    persistQueue = persistQueue
      .then(() => saveToRemote(snapshot))
      .catch((e) => console.error("[store] remote save failed:", e));
  }
}

// Экспортируем объект store со всеми методами
export const store = {
  getProjects() {
    return getStore().projects;
  },
  
  getProject(id: number) {
    return getStore().projects.find((p) => p.id === id) ?? null;
  },
  
  createProject(data: Omit<Project, "id" | "created_at" | "updated_at">) {
    const s = getStore();
    const id = ++s.seq.projects;
    const ts = now();
    const project: Project = {
      ...data,
      phone: data.phone ?? null,
      object_type: data.object_type ?? null,
      area_sqm: data.area_sqm ?? null,
      note: data.note ?? null,
      foreman: data.foreman ?? null,
      id,
      created_at: ts,
      updated_at: ts,
    };
    s.projects.push(project);
    persist();
    return id;
  },
  
  updateProject(id: number, data: Partial<Project>) {
    const s = getStore();
    const p = s.projects.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, data, { updated_at: now() });
    persist();
  },
  
  getStages(projectId: number) {
    return getStore().stages.filter((s) => s.project_id === projectId).sort((a, b) => a.order_index - b.order_index);
  },
  
  updateStage(stageId: number, data: Partial<Stage>) {
    const s = getStore();
    const st = s.stages.find((x) => x.id === stageId);
    if (!st) return;
    Object.assign(st, data, { updated_at: now() });
    persist();
  },
  
  getSubsteps(stageId: number) {
    return getStore().stage_substeps.filter((x) => x.stage_id === stageId).sort((a, b) => a.order_index - b.order_index);
  },
  
  addSubstep(stageId: number, name: string) {
    const s = getStore();
    const existing = s.stage_substeps.filter((x) => x.stage_id === stageId);
    const order_index = existing.length ? Math.max(...existing.map((x) => x.order_index)) + 1 : 0;
    const id = ++s.seq.substages;
    s.stage_substeps.push({ id, stage_id: stageId, name, completed: false, order_index });
    persist();
    return id;
  },
  
  updateSubstep(substepId: number, data: Partial<Pick<StageSubstep, "name" | "completed">>) {
    const s = getStore();
    const sub = s.stage_substeps.find((x) => x.id === substepId);
    if (!sub) return;
    Object.assign(sub, data);
    persist();
  },
  
  removeSubstep(substepId: number) {
    const s = getStore();
    s.stage_substeps = s.stage_substeps.filter((x) => x.id !== substepId);
    persist();
  },
  
  getPhotos(projectId: number) {
    return getStore()
      .photos.filter((p) => p.project_id === projectId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  },

  getPhoto(photoId: number, projectId: number) {
    return (
      getStore().photos.find(
        (p) => p.id === photoId && p.project_id === projectId
      ) ?? null
    );
  },
  
  addPhoto(data: Omit<Photo, "id" | "created_at">) {
    const s = getStore();
    const id = ++s.seq.photos;
    const photo: Photo = { ...data, id, created_at: now() };
    s.photos.push(photo);
    persist();
    return id;
  },
  
  removePhoto(photoId: number) {
    const s = getStore();
    s.photos = s.photos.filter((p) => p.id !== photoId);
    persist();
  },
  
  updatePhoto(
    photoId: number,
    data: Partial<Pick<Photo, "comment" | "stage_id" | "thumbnail_url">>
  ) {
    const s = getStore();
    const photo = s.photos.find((p) => p.id === photoId);
    if (!photo) return false;
    Object.assign(photo, data);
    persist();
    return true;
  },
  
  getExpenses(projectId: number) {
    return getStore()
      .expenses.filter((e) => e.project_id === projectId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  },

  clearExpenses(projectId: number) {
    const s = getStore();
    s.expenses = s.expenses.filter((e) => e.project_id !== projectId);
    persist();
  },
  
  addExpense(data: Omit<Expense, "id" | "created_at">) {
    const s = getStore();
    const id = ++s.seq.expenses;
    const expense: Expense = { ...data, id, created_at: now() };
    s.expenses.push(expense);
    persist();
    return id;
  },

  addExpensesBulk(rows: Omit<Expense, "id" | "created_at">[]) {
    const s = getStore();
    const ids: number[] = [];
    const ts = now();
    for (const row of rows) {
      const id = ++s.seq.expenses;
      s.expenses.push({ ...row, id, created_at: ts });
      ids.push(id);
    }
    persist();
    return ids;
  },
  
  removeExpense(expenseId: number) {
    const s = getStore();
    s.expenses = s.expenses.filter((e) => e.id !== expenseId);
    persist();
  },
  
  updateExpense(
    expenseId: number,
    data: Partial<
      Pick<
        Expense,
        | "date"
        | "category"
        | "description"
        | "subcategory"
        | "quantity"
        | "unit_price"
        | "unit"
        | "kind"
        | "amount"
      >
    >
  ) {
    const s = getStore();
    const exp = s.expenses.find((e) => e.id === expenseId);
    if (!exp) return false;
    Object.assign(exp, data);
    persist();
    return true;
  },

  getExpense(expenseId: number, projectId: number) {
    return (
      getStore().expenses.find(
        (e) => e.id === expenseId && e.project_id === projectId
      ) ?? null
    );
  },
  
  getActivity(projectId: number) {
    return getStore().activity_log.filter((a) => a.project_id === projectId);
  },
  
  addActivity(data: Omit<ActivityLogEntry, "id" | "created_at">) {
    const s = getStore();
    const id = ++s.seq.activity;
    const entry: ActivityLogEntry = { ...data, id, created_at: now() };
    s.activity_log.push(entry);
    persist();
  },
  
  initStagesForProject(projectId: number, stageNames: string[]) {
    const s = getStore();
    const ts = now();
    stageNames.forEach((name, i) => {
      const id = ++s.seq.stages;
      s.stages.push({
        id,
        project_id: projectId,
        name,
        order_index: i,
        status: "not_started",
        start_date: null,
        end_date: null,
        responsible: null,
        comment: null,
        progress_percent: 0,
        created_at: ts,
        updated_at: ts,
      });
    });
    persist();
  },
  
  getSettings(): SettingsData {
    return getStore().settings;
  },
  
  updateSettings(updates: Partial<SettingsData>) {
    const s = getStore();
    if (updates.default_stages !== undefined) s.settings.default_stages = updates.default_stages;
    if (updates.managers !== undefined) s.settings.managers = updates.managers;
    if (updates.object_types !== undefined) s.settings.object_types = updates.object_types;
    if (updates.project_statuses !== undefined) s.settings.project_statuses = updates.project_statuses;
    if (updates.stage_statuses !== undefined) s.settings.stage_statuses = updates.stage_statuses;
    persist();
  },
  
  addSettingDefaultStage(name: string) {
    const s = getStore();
    const id = ++s.seq.setting_stages;
    const order_index = s.settings.default_stages.length ? Math.max(...s.settings.default_stages.map((x) => x.order_index)) + 1 : 0;
    s.settings.default_stages.push({ id, name, order_index });
    persist();
    return id;
  },
  
  updateSettingDefaultStage(id: number, data: { name?: string; order_index?: number }) {
    const s = getStore();
    const item = s.settings.default_stages.find((x) => x.id === id);
    if (!item) return;
    if (data.name !== undefined) item.name = data.name;
    if (data.order_index !== undefined) item.order_index = data.order_index;
    persist();
  },
  
  removeSettingDefaultStage(id: number) {
    const s = getStore();
    s.settings.default_stages = s.settings.default_stages.filter((x) => x.id !== id);
    persist();
  },
  
  addSettingManager(name: string) {
    const s = getStore();
    const id = ++s.seq.setting_managers;
    s.settings.managers.push({ id, name });
    persist();
    return id;
  },
  
  updateSettingManager(id: number, name: string) {
    const s = getStore();
    const item = s.settings.managers.find((x) => x.id === id);
    if (!item) return;
    item.name = name;
    persist();
  },
  
  removeSettingManager(id: number) {
    const s = getStore();
    s.settings.managers = s.settings.managers.filter((x) => x.id !== id);
    persist();
  },
  
  updateSettingProjectStatus(key: string, label: string) {
    const s = getStore();
    const item = s.settings.project_statuses.find((x) => x.key === key);
    if (!item) return;
    item.label = label;
    persist();
  },
  
  updateSettingStageStatus(key: string, label: string) {
    const s = getStore();
    const item = s.settings.stage_statuses.find((x) => x.key === key);
    if (!item) return;
    item.label = label;
    persist();
  },
  
  setData(data: Store) {
    cache = data;
    persist();
  },
  
  load() {
    cache = loadFromFile();
    globalThis.__stroiuchot_store_cache = cache;
    return cache;
  },
};