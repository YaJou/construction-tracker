import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "@/lib/constants";

/* ─── Types ─────────────────────────────────────────────────────────── */

export type ReportPdfSubstep = {
  id: number;
  name: string;
  completed?: boolean;
  not_required?: boolean;
  on_review?: boolean;
  skip_reason?: string | null;
};

export type ReportPdfStage = {
  id: number;
  name: string;
  status: string;
  progress_percent: number;
  comment: string | null;
  start_date?: string | null;
  end_date?: string | null;
  responsible?: string | null;
  substeps?: ReportPdfSubstep[];
};

export type ReportPdfPhoto = {
  id: number;
  file_path: string;
  comment: string | null;
  created_at: string;
  stage_id: number | null;
  uploaded_by?: string | null;
};

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
    completed_stages?: number;
    total_stages?: number;
    note?: string | null;
    object_type?: string | null;
    area_sqm?: number | null;
    phone?: string | null;
  };
  stages: ReportPdfStage[];
  photos?: ReportPdfPhoto[];
  expenses: { date: string; category: string; description: string | null; amount: number }[];
  total_spent: number;
  budget: number;
  has_budget?: boolean;
  budget_remaining: number | null;
  generated_at: string;
  author_name?: string;
};

export type ReportMode = "full" | "client";

export type ReportPdfOptions = {
  mode?: ReportMode;
  authorName?: string;
  /** Include stage substeps in full report (default true). */
  includeSubsteps?: boolean;
};

export type ReportPdfResult = {
  filename: string;
  warnings: string[];
};

/* ─── Brand tokens (mm / RGB) ───────────────────────────────────────── */

const C = {
  green: [23, 63, 52] as [number, number, number],
  orange: [255, 122, 26] as [number, number, number],
  ink: [23, 32, 29] as [number, number, number],
  muted: [97, 115, 108] as [number, number, number],
  fill: [245, 248, 246] as [number, number, number],
  line: [225, 233, 229] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  danger: [180, 50, 50] as [number, number, number],
};

const MX = 13; // side margins
const BOTTOM = 20; // footer reserve
const TOP = 16; // below page header chrome
const HEADER_BAND = 10;
const FOOTER_BAND = 8;
const R = 2.8; // ~8pt corner radius in mm

/* ─── Fonts ─────────────────────────────────────────────────────────── */

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
          if (!r.ok) throw new Error("Не удалось загрузить шрифт DejaVu Sans");
          return r.arrayBuffer();
        }),
        fetch("/fonts/DejaVuSans-Bold.ttf").then((r) => {
          if (!r.ok) throw new Error("Не удалось загрузить шрифт DejaVu Sans Bold");
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

/* ─── Helpers ───────────────────────────────────────────────────────── */

function money(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function fmtDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "Не указана";
  try {
    return format(new Date(value), pattern, { locale: ru });
  } catch {
    return String(value);
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

function saveBlob(blob: Blob, filename: string) {
  if (!blob || blob.size < 64) {
    throw new Error("PDF пустой — экспорт не удался");
  }
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, filename);
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent || "")) {
      window.open(url, "_blank");
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
}

async function loadImageDataUrl(
  src: string
): Promise<{ dataUrl: string; format: "JPEG" | "PNG"; w: number; h: number } | null> {
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("img decode failed"));
      img.src = dataUrl;
    });
    const format: "JPEG" | "PNG" = blob.type.includes("png") ? "PNG" : "JPEG";
    return { dataUrl, format, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/* ─── Layout engine ─────────────────────────────────────────────────── */

type SectionTag = "object" | "stages" | "finance" | "photos" | "comments" | "note";

class ReportDoc {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  contentW: number;
  y: number;
  projectTitle: string;
  reportType: string;
  sectionLabel: string;
  pageSections: string[];
  author: string;
  generatedLabel: string;
  warnings: string[] = [];

  constructor(
    doc: jsPDF,
    meta: {
      projectTitle: string;
      reportType: string;
      author: string;
      generatedLabel: string;
    }
  ) {
    this.doc = doc;
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - MX * 2;
    this.y = TOP;
    this.projectTitle = meta.projectTitle;
    this.reportType = meta.reportType;
    this.sectionLabel = "Объект";
    this.pageSections = ["Объект"];
    this.author = meta.author;
    this.generatedLabel = meta.generatedLabel;
  }

  setSection(tag: SectionTag, label: string) {
    this.sectionLabel = label;
    const idx = this.doc.getNumberOfPages() - 1;
    this.pageSections[idx] = label;
  }

  contentBottom() {
    return this.pageH - BOTTOM;
  }

  newPage() {
    this.doc.addPage();
    this.pageSections.push(this.sectionLabel);
    this.y = TOP;
  }

  ensure(need: number) {
    if (this.y + need > this.contentBottom()) {
      this.newPage();
    }
  }

  /** Keep heading with at least `minBody` of following content. */
  ensureWithHeading(headingH: number, minBody: number) {
    this.ensure(headingH + minBody);
  }

  setFont(bold: boolean, size: number, color: [number, number, number] = C.ink) {
    this.doc.setFont("DejaVuSans", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  text(str: string, x: number, y: number, opts?: { align?: "left" | "right" | "center" }) {
    this.doc.text(str, x, y, opts);
  }

  wrapped(str: string, x: number, maxW: number, lineH: number): number {
    const lines = this.doc.splitTextToSize(str || "—", maxW) as string[];
    for (const line of lines) {
      this.ensure(lineH);
      this.doc.text(line, x, this.y);
      this.y += lineH;
    }
    return lines.length;
  }

  hrule() {
    this.doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    this.doc.setLineWidth(0.25);
    this.doc.line(MX, this.y, this.pageW - MX, this.y);
    this.y += 4;
  }

  sectionTitle(title: string) {
    this.ensureWithHeading(10, 12);
    this.y += 2;
    this.setFont(true, 14, C.green);
    this.text(title, MX, this.y);
    this.y += 3;
    this.doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
    this.doc.setLineWidth(0.6);
    this.doc.line(MX, this.y, MX + 18, this.y);
    this.y += 6;
  }

  roundedFill(x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
    this.doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    this.doc.roundedRect(x, y, w, h, R, R, "F");
  }

  roundedStroke(x: number, y: number, w: number, h: number) {
    this.doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(x, y, w, h, R, R, "S");
  }

  progressBar(x: number, y: number, w: number, h: number, pct: number, fill = C.orange) {
    const clamped = Math.max(0, Math.min(100, pct));
    this.doc.setFillColor(C.line[0], C.line[1], C.line[2]);
    this.doc.roundedRect(x, y, w, h, 1, 1, "F");
    const fw = (w * clamped) / 100;
    if (fw > 0.5) {
      this.doc.setFillColor(fill[0], fill[1], fill[2]);
      this.doc.roundedRect(x, y, fw, h, 1, 1, "F");
    }
  }

  /** Draw chrome on every page after content is done. */
  applyChrome() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);

      // Header
      this.setFont(true, 9, C.orange);
      this.text("СтройУчёт", MX, 8);
      this.setFont(false, 8, C.muted);
      const right = `${this.reportType} · ${this.pageSections[i - 1] || this.sectionLabel}`;
      this.text(right, this.pageW - MX, 8, { align: "right" });
      this.doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
      this.doc.setLineWidth(0.45);
      this.doc.line(MX, 10, this.pageW - MX, 10);

      if (i > 1) {
        this.setFont(false, 8, C.muted);
        const short =
          this.projectTitle.length > 70
            ? `${this.projectTitle.slice(0, 67)}…`
            : this.projectTitle;
        this.text(short, MX, 13.5);
      }

      // Footer
      const fy = this.pageH - 10;
      this.doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      this.doc.setLineWidth(0.25);
      this.doc.line(MX, fy - 4, this.pageW - MX, fy - 4);
      this.setFont(false, 8, C.muted);
      this.text(`${this.author} · ${this.generatedLabel}`, MX, fy);
      this.text(`${i} / ${total}`, this.pageW - MX, fy, { align: "right" });
    }
  }
}

/* ─── Content builders ──────────────────────────────────────────────── */

function statusLabel(status: string) {
  return PROJECT_STATUS_LABELS[status] || STAGE_STATUS_LABELS[status] || status || "—";
}

function drawObjectBlock(L: ReportDoc, data: ReportPdfInput, isClient: boolean) {
  L.setSection("object", "Объект");
  const p = data.project;

  L.ensure(28);
  L.setFont(true, 24, C.ink);
  L.wrapped(p.name, MX, L.contentW, 9);
  L.y += 1;

  L.setFont(false, 10, C.muted);
  L.wrapped(p.address || "Адрес не указан", MX, L.contentW, 5);
  L.y += 2;

  // Status badge (text always present for B&W)
  const label = statusLabel(p.status);
  L.setFont(true, 9, C.green);
  const badgeW = Math.min(L.contentW, L.doc.getTextWidth(label) + 8);
  L.roundedFill(MX, L.y - 3.5, badgeW, 6, C.fill);
  L.text(label, MX + 4, L.y);
  L.y += 8;

  // Green readiness card
  const completed =
    p.completed_stages ?? data.stages.filter((s) => s.status === "completed").length;
  const total = p.total_stages ?? data.stages.length;
  const active = data.stages.filter((s) => s.status === "in_progress");
  const pct = p.progress_percent ?? 0;

  const cardH = 28 + Math.max(0, active.length - 1) * 4.5;
  L.ensure(cardH + 4);
  const cardY = L.y;
  L.roundedFill(MX, cardY, L.contentW, cardH, C.green);

  L.setFont(true, 22, C.white);
  L.text(`${pct}%`, MX + 5, cardY + 11);
  L.setFont(false, 8, C.white);
  L.text("готово", MX + 5, cardY + 16);

  L.setFont(false, 9, C.white);
  L.text(`Завершено этапов: ${completed} из ${total}`, MX + 42, cardY + 8);

  L.setFont(true, 8, C.white);
  L.text("Текущие работы", MX + 42, cardY + 14);
  L.setFont(false, 9, C.white);
  if (active.length === 0) {
    L.text(pct >= 100 ? "Все этапы завершены" : "Нет этапов в работе", MX + 42, cardY + 19);
  } else {
    let ay = cardY + 19;
    for (const s of active) {
      L.text(`• ${s.name}`, MX + 42, ay);
      ay += 4.5;
    }
  }

  L.progressBar(MX + 5, cardY + cardH - 7, L.contentW - 10, 2.2, pct, C.orange);
  L.y = cardY + cardH + 6;

  // Object facts
  L.sectionTitle("Данные объекта");
  const rows: [string, string][] = [
    ["Клиент", p.client || "—"],
    ["Ответственный", p.manager || "—"],
  ];
  if (!isClient) rows.push(["Прораб", p.foreman || "—"]);
  rows.push([
    "Период строительства",
    `${fmtDate(p.start_date)} — ${p.planned_end_date ? fmtDate(p.planned_end_date) : "Не указана"}`,
  ]);
  if (!isClient && p.object_type) rows.push(["Тип объекта", p.object_type]);
  if (!isClient && p.area_sqm != null) rows.push(["Площадь", `${p.area_sqm} м²`]);
  if (!isClient && p.phone) rows.push(["Телефон", p.phone]);

  for (const [k, v] of rows) {
    L.ensure(7);
    L.setFont(false, 9, C.muted);
    L.text(k, MX, L.y);
    L.setFont(false, 10, C.ink);
    const lines = L.doc.splitTextToSize(v, L.contentW - 48) as string[];
    L.text(lines[0] || "—", MX + 48, L.y);
    L.y += 5.5;
    for (let i = 1; i < lines.length; i++) {
      L.ensure(5.5);
      L.text(lines[i], MX + 48, L.y);
      L.y += 5.5;
    }
  }
}

function drawStagesTable(
  L: ReportDoc,
  stages: ReportPdfStage[],
  opts: { isClient: boolean; includeSubsteps: boolean }
) {
  L.setSection("stages", "Этапы");
  L.sectionTitle("Этапы строительства");

  if (!stages.length) {
    L.setFont(false, 10, C.muted);
    L.wrapped("Этапы ещё не добавлены.", MX, L.contentW, 5);
    return;
  }

  const cols = opts.isClient
    ? [
        { key: "n", w: 8, title: "№" },
        { key: "name", w: 90, title: "Этап" },
        { key: "status", w: 42, title: "Статус" },
        { key: "pct", w: 20, title: "%" },
      ]
    : [
        { key: "n", w: 8, title: "№" },
        { key: "name", w: 55, title: "Этап" },
        { key: "status", w: 32, title: "Статус" },
        { key: "start", w: 28, title: "Начат" },
        { key: "end", w: 28, title: "Завершён" },
        { key: "pct", w: 15, title: "%" },
      ];

  const drawHead = () => {
    L.ensure(10);
    L.roundedFill(MX, L.y - 4, L.contentW, 7, C.fill);
    L.setFont(true, 8, C.muted);
    let x = MX + 2;
    for (const c of cols) {
      if (c.key === "pct") L.text(c.title, x + c.w - 2, L.y, { align: "right" });
      else L.text(c.title, x, L.y);
      x += c.w;
    }
    L.y += 5;
  };

  drawHead();

  stages.forEach((stage, idx) => {
    const status = statusLabel(stage.status);
    const nameLines = L.doc.splitTextToSize(stage.name, cols.find((c) => c.key === "name")!.w - 2) as string[];
    const rowH = Math.max(6, nameLines.length * 4 + 2);
    L.ensure(rowH + 2);
    if (L.y + rowH > L.contentBottom() - 2) {
      L.newPage();
      drawHead();
    }

    if (idx % 2 === 1) {
      L.doc.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
      L.doc.rect(MX, L.y - 3.5, L.contentW, rowH, "F");
    }

    let x = MX + 2;
    const baseline = L.y;
    L.setFont(false, 9, C.ink);
    for (const c of cols) {
      if (c.key === "n") L.text(String(idx + 1), x, baseline);
      if (c.key === "name") {
        nameLines.forEach((line, li) => L.text(line, x, baseline + li * 4));
      }
      if (c.key === "status") L.text(status, x, baseline);
      if (c.key === "start") L.text(fmtDate(stage.start_date, "d.MM.yy"), x, baseline);
      if (c.key === "end") L.text(fmtDate(stage.end_date, "d.MM.yy"), x, baseline);
      if (c.key === "pct")
        L.text(`${stage.progress_percent}%`, x + c.w - 2, baseline, { align: "right" });
      x += c.w;
    }
    L.y = baseline + rowH;

    if (opts.includeSubsteps && !opts.isClient && (stage.substeps?.length ?? 0) > 0) {
      for (const sub of stage.substeps!) {
        let mark = "○";
        let note = "";
        if (sub.not_required) {
          mark = "—";
          note = sub.skip_reason ? ` (не требуется: ${sub.skip_reason})` : " (не требуется)";
        } else if (sub.completed) mark = "✓";
        else if (sub.on_review) {
          mark = "◐";
          note = " (на проверке)";
        }
        const line = `    ${mark} ${sub.name}${note}`;
        L.setFont(false, 8, C.muted);
        L.ensure(4.5);
        L.wrapped(line, MX + 6, L.contentW - 8, 3.8);
      }
      L.y += 1;
    }
  });
}

function drawFinance(L: ReportDoc, data: ReportPdfInput, isClient: boolean) {
  if (!isClient) {
    L.sectionLabel = "Финансы";
    L.newPage();
  } else {
    L.setSection("finance", "Финансы");
  }
  L.sectionTitle("Финансы");

  const hasBudget = data.has_budget ?? data.budget > 0;
  const budget = hasBudget ? data.budget : 0;
  const spent = data.total_spent || 0;
  const remaining = hasBudget ? (data.budget_remaining ?? budget - spent) : null;
  const spendPct = hasBudget ? (spent / budget) * 100 : 0;

  // Three cards
  const gap = 4;
  const cardW = (L.contentW - gap * 2) / 3;
  const cardH = 18;
  L.ensure(cardH + 8);
  const cards: { title: string; value: string; tone: [number, number, number] }[] = [
    {
      title: "Бюджет",
      value: hasBudget ? money(budget) : "Не задан",
      tone: C.green,
    },
    { title: "Потрачено", value: money(spent), tone: C.orange },
    {
      title: "Остаток",
      value: remaining == null ? "—" : money(remaining),
      tone: remaining != null && remaining < 0 ? C.danger : C.ink,
    },
  ];
  cards.forEach((card, i) => {
    const x = MX + i * (cardW + gap);
    L.roundedFill(x, L.y, cardW, cardH, C.fill);
    L.roundedStroke(x, L.y, cardW, cardH);
    L.setFont(false, 8, C.muted);
    L.text(card.title, x + 3, L.y + 5);
    L.setFont(true, 11, card.tone);
    const valLines = L.doc.splitTextToSize(card.value, cardW - 6) as string[];
    L.text(valLines[0], x + 3, L.y + 12);
  });
  L.y += cardH + 8;

  // Budget usage
  if (hasBudget) {
    L.ensure(16);
    L.setFont(false, 9, C.muted);
    L.text("Использованная доля бюджета (от всех расходов проекта)", MX, L.y);
    L.y += 4;
    L.setFont(true, 10, spendPct > 100 ? C.danger : C.ink);
    L.text(`${spendPct.toFixed(1).replace(".", ",")}%`, MX, L.y);
    if (spendPct > 100) {
      L.setFont(false, 9, C.danger);
      L.text(`Превышение: ${money(spent - budget)}`, MX + 28, L.y);
    }
    L.y += 3;
    // Bar width capped visually, but text shows real %
    L.progressBar(MX, L.y, L.contentW, 3, Math.min(spendPct, 100), spendPct > 100 ? C.danger : C.orange);
    L.y += 8;
  } else {
    L.setFont(false, 9, C.muted);
    L.wrapped("Бюджет объекта не задан — доля расходов не рассчитывается.", MX, L.contentW, 5);
    L.y += 2;
  }

  // Categories
  const byCategory = new Map<string, number>();
  for (const e of data.expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + Number(e.amount));
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  if (categories.length && spent > 0) {
    L.ensure(14);
    L.setFont(true, 10, C.ink);
    L.text("Категории расходов", MX, L.y);
    L.y += 4;
    L.setFont(false, 8, C.muted);
    L.text("Доли категорий считаются от суммы расходов", MX, L.y);
    L.y += 5;
    for (const [cat, sum] of categories) {
      L.ensure(10);
      const share = (sum / spent) * 100;
      L.setFont(false, 9, C.ink);
      L.text(cat, MX, L.y);
      L.text(`${money(sum)} · ${share.toFixed(1).replace(".", ",")}%`, L.pageW - MX, L.y, {
        align: "right",
      });
      L.y += 2.5;
      L.progressBar(MX, L.y, L.contentW, 2.2, share, C.green);
      L.y += 6;
    }
  }

  // Full expense table (full report only) — no row cap
  if (!isClient && data.expenses.length) {
    const expensesSorted = [...data.expenses].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    L.ensure(16);
    L.setFont(true, 10, C.ink);
    L.text("Расходы", MX, L.y);
    L.y += 5;

    const ec = [
      { key: "date", w: 24, title: "Дата" },
      { key: "desc", w: 78, title: "Описание" },
      { key: "cat", w: 32, title: "Категория" },
      { key: "sum", w: 30, title: "Сумма" },
    ];

    const head = () => {
      L.ensure(8);
      L.roundedFill(MX, L.y - 4, L.contentW, 7, C.fill);
      L.setFont(true, 8, C.muted);
      let x = MX + 2;
      for (const c of ec) {
        if (c.key === "sum") L.text(c.title, x + c.w - 2, L.y, { align: "right" });
        else L.text(c.title, x, L.y);
        x += c.w;
      }
      L.y += 5;
    };

    head();

    expensesSorted.forEach((e, idx) => {
      const desc = e.description?.trim() || "—";
      const descLines = L.doc.splitTextToSize(desc, ec[1].w - 2) as string[];
      const rowH = Math.max(6, descLines.length * 3.8 + 1.5);
      if (L.y + rowH > L.contentBottom()) {
        L.newPage();
        head();
      }
      if (idx % 2 === 1) {
        L.doc.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
        L.doc.rect(MX, L.y - 3.5, L.contentW, rowH, "F");
      }
      let x = MX + 2;
      const base = L.y;
      L.setFont(false, 9, C.ink);
      L.text(fmtDate(e.date, "d.MM.yyyy"), x, base);
      x += ec[0].w;
      descLines.forEach((line, li) => L.text(line, x, base + li * 3.8));
      x += ec[1].w;
      L.text(e.category, x, base);
      x += ec[2].w;
      L.text(money(Number(e.amount)), x + ec[3].w - 2, base, { align: "right" });
      L.y = base + rowH;
    });

    L.ensure(8);
    L.doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    L.doc.line(MX, L.y, L.pageW - MX, L.y);
    L.y += 5;
    L.setFont(true, 10, C.ink);
    L.text("Итого расходов", MX, L.y);
    L.text(money(spent), L.pageW - MX, L.y, { align: "right" });
    L.y += 6;
  }
}

async function drawPhotos(
  L: ReportDoc,
  photos: ReportPdfPhoto[],
  stageNameById: Map<number, string>
) {
  const list = photos.filter((p) => p.file_path && !p.file_path.startsWith("/placeholder"));
  if (!list.length) return;

  L.setSection("photos", "Фото");
  L.sectionTitle("Фотографии");

  const gap = 4;
  const colW = (L.contentW - gap) / 2;
  let col = 0;
  let rowTop = L.y;

  for (const photo of list) {
    const loaded = await loadImageDataUrl(photo.file_path);
    const captionParts = [
      photo.stage_id ? stageNameById.get(photo.stage_id) || "Этап" : "Без этапа",
      fmtDate(photo.created_at, "d MMM yyyy"),
    ];
    if (photo.comment?.trim()) captionParts.push(photo.comment.trim());
    const caption = captionParts.join(" · ");
    const capLines = L.doc.splitTextToSize(caption, colW - 4) as string[];
    const capH = Math.min(14, capLines.length * 3.5 + 2);

    // Fit image preserving aspect ratio into colW x maxImgH
    const maxImgH = 42;
    let imgW = colW;
    let imgH = maxImgH;
    if (loaded) {
      const ratio = loaded.w / loaded.h;
      imgW = colW;
      imgH = imgW / ratio;
      if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = imgH * ratio;
      }
    }

    const blockH = imgH + capH + 4;
    if (col === 0) {
      L.ensure(blockH);
      rowTop = L.y;
    } else if (rowTop + blockH > L.contentBottom()) {
      L.newPage();
      rowTop = L.y;
      col = 0;
    }

    const x = MX + col * (colW + gap);
    const y = rowTop;

    // Keep caption with image: draw both in one block
    L.roundedStroke(x, y, colW, imgH + capH + 2);
    if (loaded) {
      const ox = x + (colW - imgW) / 2;
      L.doc.addImage(loaded.dataUrl, loaded.format, ox, y + 1, imgW, imgH, undefined, "FAST");
    } else {
      L.roundedFill(x + 1, y + 1, colW - 2, imgH, C.fill);
      L.setFont(false, 8, C.danger);
      L.text("Не удалось загрузить фото", x + 4, y + imgH / 2);
      L.warnings.push(`Фото #${photo.id}: ошибка загрузки`);
    }

    L.setFont(false, 8, C.muted);
    let cy = y + imgH + 4;
    for (const line of capLines.slice(0, 3)) {
      L.text(line, x + 2, cy);
      cy += 3.5;
    }

    col += 1;
    if (col >= 2) {
      col = 0;
      L.y = rowTop + blockH + 3;
    }
  }
  if (col === 1) {
    L.y = rowTop + 50;
  }
}

function drawComments(L: ReportDoc, stages: ReportPdfStage[]) {
  const comments = stages.filter((s) => s.comment?.trim());
  if (!comments.length) return;
  L.setSection("comments", "Комментарии");
  L.sectionTitle("Комментарии по этапам");
  for (const s of comments) {
    L.ensureWithHeading(8, 10);
    L.roundedFill(MX, L.y - 3, L.contentW, 2, C.fill); // spacer start
    L.setFont(true, 10, C.ink);
    L.wrapped(s.name, MX, L.contentW, 5);
    L.setFont(false, 9, C.muted);
    L.wrapped(s.comment || "", MX, L.contentW, 4.5);
    L.y += 3;
  }
}

/* ─── Public API ────────────────────────────────────────────────────── */

export async function downloadProjectReportPdf(
  data: ReportPdfInput,
  modeOrOptions: ReportMode | ReportPdfOptions = "full"
): Promise<ReportPdfResult> {
  const options: ReportPdfOptions =
    typeof modeOrOptions === "string" ? { mode: modeOrOptions } : modeOrOptions || {};
  const mode = options.mode || "full";
  const isClient = mode === "client";
  const includeSubsteps = options.includeSubsteps !== false && !isClient;

  if (!data?.project?.name) {
    throw new Error("Нет данных проекта для отчёта");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await ensureFonts(doc);

  const author =
    options.authorName?.trim() ||
    data.author_name?.trim() ||
    data.project.manager?.trim() ||
    "Пользователь";
  const generatedLabel = fmtDate(data.generated_at, "d MMMM yyyy, HH:mm");
  const reportType = isClient ? "Отчёт для клиента" : "Полный отчёт";

  const L = new ReportDoc(doc, {
    projectTitle: data.project.name,
    reportType,
    author,
    generatedLabel,
  });

  // Page 1 content starts below header band
  L.y = TOP + (HEADER_BAND > 0 ? 2 : 0);

  drawObjectBlock(L, data, isClient);
  drawStagesTable(L, data.stages || [], { isClient, includeSubsteps });
  drawFinance(L, data, isClient);

  if (!isClient) {
    const stageNameById = new Map<number, string>();
    data.stages.forEach((s) => stageNameById.set(s.id, s.name));
    await drawPhotos(L, data.photos || [], stageNameById);
    drawComments(L, data.stages || []);
    if (data.project.note?.trim()) {
      L.setSection("note", "Заметка");
      L.sectionTitle("Заметка");
      L.setFont(false, 10, C.ink);
      L.wrapped(data.project.note, MX, L.contentW, 5);
    }
  }

  L.applyChrome();

  const filename = `StroiUchet_${safeFilename(data.project.name)}.pdf`;
  const blob = doc.output("blob");
  if (!blob || blob.size < 200) {
    throw new Error("Не удалось сформировать PDF (пустой файл)");
  }

  if (!/iPad|iPhone|iPod/i.test(navigator.userAgent || "")) {
    doc.save(filename);
  } else {
    saveBlob(blob, filename);
  }

  return { filename, warnings: L.warnings };
}
