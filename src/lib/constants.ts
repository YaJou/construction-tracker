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
  "Объект завершен",
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
