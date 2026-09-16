import { STAGE_TEMPLATES } from "./stageTemplates";

export { defaultStagesWithSubsteps, formatSubstepName, normalizeTemplateStageName, STAGE_TEMPLATES } from "./stageTemplates";

export const DEFAULT_STAGES = STAGE_TEMPLATES.map((t) => t.name);

/** @deprecated Prefer STAGE_TEMPLATES / setting_default_substeps — kept for fallbacks */
export const HANDOVER_STAGE_SUBSTEPS =
  STAGE_TEMPLATES.find((t) => t.name === "Сдача и приёмка")?.substeps.map((s) =>
    s.group ? `${s.group} · ${s.name}` : s.name
  ) ?? [];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Планирование",
  construction: "В строительстве",
  paused: "Пауза",
  completed: "Завершен",
};

export const STAGE_STATUS_LABELS: Record<string, string> = {
  not_started: "Не начат",
  in_progress: "В работе",
  completed: "Завершен",
};

export const EXPENSE_CATEGORIES = ["Материалы", "Работы", "Проект", "Прочее"];

export function objectWord(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "объектов";
  if (n1 === 1) return "объект";
  if (n1 >= 2 && n1 <= 4) return "объекта";
  return "объектов";
}

export function substepWord(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "подэтапов";
  if (n1 === 1) return "подэтап";
  if (n1 >= 2 && n1 <= 4) return "подэтапа";
  return "подэтапов";
}
