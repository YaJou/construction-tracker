import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "@/lib/constants";

export type ReportPdfInput = {
  project: {
    name: string;
    client: string;
    address: string;
    start_date: string | null;
    planned_end_date: string | null;
    status: string;
    manager: string | null;
    foreman?: string | null;
    progress_percent: number;
    note?: string | null;
  };
  stages: {
    id: number;
    name: string;
    status: string;
    progress_percent: number;
    comment: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }[];
  expenses: { date: string; category: string; description: string | null; amount: number }[];
  total_spent: number;
  budget: number;
  budget_remaining: number;
  generated_at: string;
};

type ReportMode = "full" | "client";

let fontCache: { regular: string; bold: string } | null = null;
let fontsReady: Promise<void> | null = null;

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice) as unknown as number[]);
  }
  return binary;
}

async function ensureFonts(doc: jsPDF) {
  if (!fontsReady) {
    fontsReady = (async () => {
      const [regular, bold] = await Promise.all([
        fetch("/fonts/DejaVuSans.ttf").then((r) => {
          if (!r.ok) throw new Error("Не удалось загрузить шрифт");
          return r.arrayBuffer();
        }),
        fetch("/fonts/DejaVuSans-Bold.ttf").then((r) => {
          if (!r.ok) throw new Error("Не удалось загрузить шрифт");
          return r.arrayBuffer();
        }),
      ]);
      fontCache = {
        regular: arrayBufferToBinaryString(regular),
        bold: arrayBufferToBinaryString(bold),
      };
    })().catch((err) => {
      fontsReady = null;
      fontCache = null;
      throw err;
    });
  }
  await fontsReady;
  if (!fontCache) throw new Error("Шрифт PDF не загружен");
  doc.addFileToVFS("DejaVuSans.ttf", fontCache.regular);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fontCache.bold);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
  doc.setFont("DejaVuSans", "normal");
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function fmtDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  try {
    return format(new Date(value), pattern, { locale: ru });
  } catch {
    return value;
  }
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*]+/g, "").trim().slice(0, 60);
  return cleaned || "otchet";
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Always save as a file. Web Share is skipped — on Windows it opens and immediately closes. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, filename);

    // iOS Safari often ignores download= — also open the PDF so user can save it.
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent || "")) {
      window.open(url, "_blank");
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
}

export async function downloadProjectReportPdf(
  data: ReportPdfInput,
  mode: ReportMode = "full"
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await ensureFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = margin;
  const isClient = mode === "client";

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const setNormal = (size = 10) => {
    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(size);
    doc.setTextColor(23, 32, 29);
  };

  const setBold = (size = 10) => {
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(size);
    doc.setTextColor(23, 32, 29);
  };

  const setMuted = (size = 9) => {
    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(size);
    doc.setTextColor(111, 123, 118);
  };

  const writeWrapped = (text: string, x: number, maxWidth: number, lineH = 5) => {
    const lines = doc.splitTextToSize(text || "—", maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, x, y);
      y += lineH;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(12);
    y += 2;
    setBold(12);
    doc.setTextColor(23, 63, 52);
    doc.text(title, margin, y);
    y += 7;
    setNormal();
  };

  const kv = (label: string, value: string) => {
    ensureSpace(6);
    setMuted(9);
    doc.text(label, margin, y);
    setNormal(10);
    const lines = doc.splitTextToSize(value || "—", contentW - 42) as string[];
    doc.text(lines[0] || "—", margin + 42, y);
    y += 5.5;
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(5.5);
      doc.text(lines[i], margin + 42, y);
      y += 5.5;
    }
  };

  // Header
  setBold(9);
  doc.setTextColor(255, 122, 26);
  doc.text("СтройУчёт", margin, y);
  y += 7;

  setBold(16);
  writeWrapped(data.project.name, margin, contentW, 7);
  y += 1;

  setMuted(9);
  writeWrapped(
    `${isClient ? "Отчёт для клиента" : "Полный отчёт по объекту"} · ${fmtDate(
      data.generated_at,
      "d MMMM yyyy, HH:mm"
    )}`,
    margin,
    contentW,
    5
  );
  y += 3;
  doc.setDrawColor(230, 235, 232);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  sectionTitle("Информация об объекте");
  kv("Клиент", data.project.client);
  kv("Адрес", data.project.address);
  kv("Статус", PROJECT_STATUS_LABELS[data.project.status] || data.project.status);
  kv("Ответственный", data.project.manager || "—");
  if (!isClient) kv("Прораб", data.project.foreman || "—");
  kv(
    "Период",
    `${fmtDate(data.project.start_date)} — ${fmtDate(data.project.planned_end_date)}`
  );
  kv("Прогресс", `${data.project.progress_percent}%`);

  sectionTitle("Этапы строительства");
  for (const stage of data.stages) {
    ensureSpace(10);
    setBold(10);
    writeWrapped(stage.name, margin, contentW - 28, 5);
    y -= 5;
    setNormal(10);
    doc.text(`${stage.progress_percent}%`, pageW - margin, y, { align: "right" });
    y += 5;
    setMuted(9);
    const status = STAGE_STATUS_LABELS[stage.status] || stage.status;
    const dates = !isClient
      ? ` · ${fmtDate(stage.start_date, "d.MM.yy")} / ${fmtDate(stage.end_date, "d.MM.yy")}`
      : "";
    writeWrapped(`${status}${dates}`, margin, contentW, 4.5);
    y += 1.5;
  }

  sectionTitle("Финансы");
  kv("Бюджет", money(data.budget));
  kv("Потрачено", money(data.total_spent));
  kv("Остаток", money(data.budget_remaining));

  const byCategory = new Map<string, number>();
  for (const e of data.expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + Number(e.amount));
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  if (categories.length) {
    ensureSpace(8);
    setBold(10);
    doc.text("По категориям", margin, y);
    y += 6;
    for (const [cat, sum] of categories) {
      ensureSpace(5.5);
      setNormal(9);
      doc.text(cat, margin, y);
      doc.text(money(sum), pageW - margin, y, { align: "right" });
      y += 5.5;
    }
  }

  if (!isClient && data.expenses.length) {
    ensureSpace(10);
    setBold(10);
    doc.text("Расходы", margin, y);
    y += 6;
    for (const e of data.expenses.slice(0, 40)) {
      ensureSpace(8);
      setNormal(9);
      const left = `${fmtDate(e.date, "d.MM.yyyy")} · ${e.category}`;
      doc.text(left, margin, y);
      doc.text(money(Number(e.amount)), pageW - margin, y, { align: "right" });
      y += 4.5;
      if (e.description) {
        setMuted(8);
        writeWrapped(e.description, margin, contentW, 4);
      }
      y += 1;
    }
    if (data.expenses.length > 40) {
      setMuted(9);
      writeWrapped(`… и ещё ${data.expenses.length - 40} записей`, margin, contentW, 5);
    }
  }

  if (!isClient) {
    const comments = data.stages.filter((s) => s.comment?.trim());
    if (comments.length) {
      sectionTitle("Комментарии по этапам");
      for (const s of comments) {
        ensureSpace(10);
        setBold(10);
        writeWrapped(s.name, margin, contentW, 5);
        setMuted(9);
        writeWrapped(s.comment || "", margin, contentW, 4.5);
        y += 2;
      }
    }
    if (data.project.note?.trim()) {
      sectionTitle("Заметка");
      setNormal(9);
      writeWrapped(data.project.note, margin, contentW, 4.5);
    }
  }

  ensureSpace(12);
  y += 4;
  doc.setDrawColor(230, 235, 232);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  setMuted(8);
  writeWrapped(
    `СтройУчёт · ${isClient ? "клиентский" : "полный"} отчёт · ${fmtDate(
      data.generated_at,
      "d.MM.yyyy HH:mm"
    )}${data.project.manager ? ` · подготовил: ${data.project.manager}` : ""}`,
    margin,
    contentW,
    4
  );

  const filename = `StroiUchet_${safeFilename(data.project.name)}.pdf`;

  // Built-in save is the most reliable download on desktop browsers.
  if (!/iPad|iPhone|iPod/i.test(navigator.userAgent || "")) {
    doc.save(filename);
    return;
  }

  saveBlob(doc.output("blob"), filename);
}
