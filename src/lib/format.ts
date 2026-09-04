/**
 * Форматирует строку с числом: оставляет только цифры и разделяет тысячи пробелом.
 * Пример: "25000000" → "25 000 000"
 */
export function formatThousands(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits === "") return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Парсит отформатированное число (убирает пробелы и нечисловые символы).
 */
export function parseFormattedNumber(value: string): number {
  const cleaned = value.replace(/\s/g, "").replace(/\u00A0/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Цифры телефона (макс 10, без 7 в начале). */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^7/, "").slice(0, 10);
  return digits;
}

/** Показать телефон в виде +7 XXX XXX XX XX */
export function formatPhoneDisplay(digits: string): string {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "").replace(/^7/, "").slice(0, 10);
  if (d.length <= 3) return `+7 ${d}`;
  if (d.length <= 6) return `+7 ${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 8) return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** Из 10 цифр в строку для сохранения (с +7). */
export function phoneToStore(digits: string): string | null {
  const d = digits.replace(/\D/g, "").replace(/^7/, "").trim();
  if (d.length < 10) return null;
  return formatPhoneDisplay(d.slice(0, 10));
}

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/**
 * Превращает сырые details из журнала в человекочитаемый текст.
 * В т.ч. старый формат "Этап обновлён: {...}" из API.
 */
export function formatActivityDetails(details: string | null): string {
  if (!details || !details.trim()) return "";
  const match = details.match(/^Этап обновлён:\s*(\{.*\})$/s);
  if (!match) return details;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return details;
  }
  const parts: string[] = [];
  const fmtDate = (dateStr: string) => {
    const [y, m, day] = dateStr.split("-");
    const month = m ? MONTHS_RU[parseInt(m, 10) - 1] : "";
    return month && day ? `${parseInt(day, 10)} ${month}` : dateStr;
  };
  const status = obj.status as string | undefined;
  const endDate = obj.end_date !== undefined ? String(obj.end_date) : "";
  if (status === "completed" && endDate) {
    parts.push(`Этап завершён ${fmtDate(endDate)}`);
  } else if (status !== undefined) {
    if (status === "completed") parts.push("этап завершён");
    else if (status === "in_progress") parts.push("этап в работе");
    else if (status === "not_started") parts.push("этап не начат");
    else parts.push(`статус: ${status}`);
  }
  if (obj.start_date !== undefined) {
    const d = String(obj.start_date);
    if (d) parts.push(`начат ${fmtDate(d)}`);
  }
  if (obj.end_date !== undefined && !(status === "completed" && endDate)) {
    const d = String(obj.end_date);
    if (d) parts.push(`завершён ${fmtDate(d)}`);
  }
  if (obj.progress_percent !== undefined && status !== "completed") {
    parts.push(`прогресс ${obj.progress_percent}%`);
  }
  if (obj.name !== undefined) parts.push("изменено название");
  if (obj.comment !== undefined) parts.push("обновлён комментарий");
  if (obj.responsible !== undefined) parts.push("изменён ответственный");
  if (parts.length === 0) return "Этап обновлён";
  return parts.length === 1 ? parts[0] : "Этап: " + parts.join(", ");
}
