import path from "path";
import fs from "fs";
import type { Store } from "../lib/store";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "store.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DEFAULT_STAGES = [
  "Подготовка участка",
  "Фундамент",
  "Стены",
  "Крыша",
  "Окна и двери",
  "Электрика и сантехника",
  "Внутренняя отделка",
  "Фасад",
  "Благоустройство",
  "Объект завершен",
];

const ts = new Date().toISOString();

const projectsData = [
  {
    name: "ЖК Солнечный, корпус 1",
    client: "ООО Застройщик",
    address: "г. Москва, ул. Строителей, 15",
    start_date: "2024-01-15",
    planned_end_date: "2025-06-30",
    status: "construction" as const,
    budget: 45000000,
    manager: "Иванов П.С.",
  },
  {
    name: "Коттедж семья Петровых",
    client: "Петров А.В.",
    address: "МО, Одинцовский р-н, с. Жаворонки",
    start_date: "2024-03-01",
    planned_end_date: "2024-12-20",
    status: "construction" as const,
    budget: 12000000,
    manager: "Сидорова Е.К.",
  },
  {
    name: "Таунхаусы Парк Авеню",
    client: "Девелопер Парк",
    address: "г. Подольск, Парковая ул., 8",
    start_date: "2024-02-10",
    planned_end_date: "2025-09-01",
    status: "planning" as const,
    budget: 78000000,
    manager: "Козлов Д.И.",
  },
  {
    name: "Реконструкция офиса Альфа",
    client: "ООО Альфа",
    address: "г. Москва, Ленинский пр-т, 45",
    start_date: "2024-04-01",
    planned_end_date: "2024-10-15",
    status: "construction" as const,
    budget: 8500000,
    manager: "Иванов П.С.",
  },
  {
    name: "Дача клиент Сидоров",
    client: "Сидоров М.Н.",
    address: "Ленинградская обл., Выборгский р-н",
    start_date: "2023-09-01",
    planned_end_date: "2024-08-01",
    status: "completed" as const,
    budget: 6500000,
    manager: "Сидорова Е.К.",
  },
];

const projects: Store["projects"] = [];
const stages: Store["stages"] = [];
const stage_substeps: Store["stage_substeps"] = [];
const photos: Store["photos"] = [];
const expenses: Store["expenses"] = [];
const activity_log: Store["activity_log"] = [];

let stageId = 0;
let substageId = 0;
let photoId = 0;
let expenseId = 0;
let activityId = 0;

// Настройки по умолчанию
const defaultObjectTypes = ["Коттедж", "ЖК", "Таунхаусы", "Коммерческое здание", "Реконструкция"].map((name, i) => ({ id: i + 1, name }));

const settings: Store["settings"] = {
  default_stages: DEFAULT_STAGES.map((name, i) => ({ id: i + 1, name, order_index: i })),
  managers: [],
  object_types: defaultObjectTypes,
  project_statuses: [
    { key: "planning", label: "Планирование" },
    { key: "construction", label: "Строительство" },
    { key: "paused", label: "Приостановлен" },
    { key: "completed", label: "Завершен" },
  ],
  stage_statuses: [
    { key: "not_started", label: "Не начат" },
    { key: "in_progress", label: "В процессе" },
    { key: "completed", label: "Завершен" },
  ],
};

projectsData.forEach((p, idx) => {
  const projectId = idx + 1;
  projects.push({
    id: projectId,
    ...p,
    phone: null,
    object_type: null,
    area_sqm: null,
    note: null,
    created_at: ts,
    updated_at: ts,
  });

  DEFAULT_STAGES.forEach((name, i) => {
    let status: "not_started" | "in_progress" | "completed" = "not_started";
    let start_date: string | null = null;
    let end_date: string | null = null;
    let progress_percent = 0;
    let comment: string | null = null;
    
    if (idx === 4) {
      status = "completed";
      progress_percent = 100;
      start_date = "2023-09-01";
      end_date = "2024-07-20";
    } else if (i < 4) {
      status = "completed";
      progress_percent = 100;
      start_date = `2024-0${Math.max(1, i + 1)}-01`;
      end_date = `2024-0${Math.min(4, i + 2)}-15`;
    } else if (i === 4) {
      status = "in_progress";
      progress_percent = 65;
      start_date = "2024-04-20";
      comment = "Идёт монтаж окон";
    }
    
    stageId++;
    stages.push({
      id: stageId,
      project_id: projectId,
      name,
      order_index: i,
      status,
      start_date,
      end_date,
      responsible: "Прораб Васильев",
      comment,
      progress_percent,
      created_at: ts,
      updated_at: ts,
    });

    // Добавляем подэтапы для некоторых этапов
    if (i < 3) {
      for (let j = 0; j < 2; j++) {
        substageId++;
        stage_substeps.push({
          id: substageId,
          stage_id: stageId,
          name: `Подэтап ${j + 1}`,
          completed: status === "completed",
          order_index: j,
        });
      }
    }
  });

  const projectStages = stages.filter((s) => s.project_id === projectId);
  [0, 1, 2, 3].forEach((si) => {
    if (projectStages[si]) {
      photoId++;
      photos.push({
        id: photoId,
        project_id: projectId,
        stage_id: projectStages[si].id,
        file_path: `/placeholder-${idx}-${si}.jpg`,
        comment: "Фото с объекта",
        uploaded_by: "Прораб Васильев",
        created_at: ts,
      });
    }
  });

  for (let month = 1; month <= 3; month++) {
    ["Цемент М500", "Бетон заводской", "Арматура"].forEach((desc, i) => {
      expenseId++;
      expenses.push({
        id: expenseId,
        project_id: projectId,
        date: `2024-0${month}-${10 + i}`,
        category: "Материалы",
        description: desc,
        amount: 150000 + idx * 20000 + month * 10000,
        added_by: "Менеджер",
        created_at: ts,
      });
    });
    
    expenseId++;
    expenses.push({
      id: expenseId,
      project_id: projectId,
      date: `2024-0${month}-05`,
      category: "Работы",
      description: "Строительные работы",
      amount: 500000 + idx * 50000,
      added_by: "Менеджер",
      created_at: ts,
    });
  }

  activityId++;
  activity_log.push(
    { id: activityId++, project_id: projectId, action_type: "updated", entity_type: "stage", entity_id: 1, details: "Этап «Фундамент» завершён", user_name: "Иванов П.С.", created_at: ts },
    { id: activityId++, project_id: projectId, action_type: "created", entity_type: "photo", entity_id: 1, details: "Добавлено фото", user_name: "Прораб Васильев", created_at: ts },
    { id: activityId++, project_id: projectId, action_type: "created", entity_type: "expense", entity_id: 1, details: "Добавлен расход: Материалы", user_name: "Сидорова Е.К.", created_at: ts }
  );
});

const storeData: Store = {
  projects,
  stages,
  stage_substeps,
  photos,
  expenses,
  activity_log,
  settings,
  seq: {
    projects: projects.length + 1,
    stages: stageId + 1,
    substages: substageId + 1,
    photos: photoId + 1,
    expenses: expenseId + 1,
    activity: activityId + 1,
    setting_stages: settings.default_stages.length + 1,
    setting_managers: settings.managers.length + 1,
    setting_object_types: settings.object_types.length + 1,
  },
};

fs.writeFileSync(dataFile, JSON.stringify(storeData, null, 2), "utf-8");
console.log("Seed completed. Projects:", projects.length);
console.log("Stages:", stages.length);
console.log("Substages:", stage_substeps.length);