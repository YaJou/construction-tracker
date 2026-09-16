export const DEFAULT_STAGES = [
  "Подготовка участка",
  "Фундамент",
  "Стены",
  "Крыша",
  "Окна и двери",
  "Электрика и сантехника",
  "Внутренняя отделка",
  "Фасад",
  "Благоустройство",
  "Сдача и приёмка",
];

/** Default checklist for the handover stage on newly created projects only. */
export const HANDOVER_STAGE_SUBSTEPS = [
  "Проверка инженерных систем",
  "Устранение замечаний",
  "Уборка и подготовка объекта",
  "Передача ключей и документации",
  "Подписание акта приёмки",
];

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

export function normalizeTemplateStageName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (/^объект\s+заверш[её]н[аоы]?$/i.test(n)) return "Сдача и приёмка";
  return n;
}

export function objectWord(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "объектов";
  if (n1 === 1) return "объект";
  if (n1 >= 2 && n1 <= 4) return "объекта";
  return "объектов";
}