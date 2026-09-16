import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { SMETA_KIND_LABELS, type SmetaItemKind } from "@/lib/smetaTemplates";

export type SmetaPdfExpense = {
  date: string;
  category: string;
  description?: string | null;
  subcategory?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit?: string | null;
  kind?: string | null;
  amount: number;
};

export type SmetaPdfInput = {
  project: {
    name: string;
    address?: string;
    client?: string;
    manager?: string | null;
  };
  expenses: SmetaPdfExpense[];
  total_spent: number;
  budget: number;
  has_budget?: boolean;
  budget_remaining: number | null;
  generated_at: string;
};

const C = {
  green: [23, 63, 52] as [number, number, number],
  orange: [255, 122, 26] as [number, number, number],
  ink: [23, 32, 29] as [number, number, number],
  muted: [97, 115, 108] as [number, number, number],
  fill: [245, 248, 246] as [number, number, number],
  line: [225, 233, 229] as [number, number, number],
};

const MX = 13;
const BOTTOM = 20;
const TOP = 16;

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
    return String(value);
  }
}

function safeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim().slice(0, 60) || "smeta";
}

function itemName(e: SmetaPdfExpense) {
  return e.subcategory || e.description || "—";
}

/** Estimate-only PDF: no construction stages, only smeta/expense lines. */
export async function downloadSmetaPdf(
  data: SmetaPdfInput,
  options?: { authorName?: string }
) {
  if (!data?.project?.name) throw new Error("Нет данных объекта для сметы");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await ensureFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MX * 2;
  let y = TOP;
  const author =
    options?.authorName?.trim() || data.project.manager?.trim() || "Пользователь";
  const generatedLabel = fmtDate(data.generated_at, "d MMMM yyyy, HH:mm");
  const pageSections = ["Смета"];

  const setFont = (bold: boolean, size: number, color = C.ink) => {
    doc.setFont("DejaVuSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const ensure = (need: number) => {
    if (y + need > pageH - BOTTOM) {
      doc.addPage();
      pageSections.push("Смета");
      y = TOP;
    }
  };

  const wrapped = (text: string, maxW: number, lineH: number) => {
    const lines = doc.splitTextToSize(text || "—", maxW) as string[];
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, MX, y);
      y += lineH;
    }
  };

  // Title block
  setFont(true, 9, C.orange);
  doc.text("СтройУчёт", MX, y);
  y += 7;
  setFont(true, 22, C.ink);
  wrapped(data.project.name, contentW, 8);
  y += 1;
  setFont(false, 10, C.muted);
  wrapped("Смета объекта (без этапов работ)", contentW, 5);
  if (data.project.address) wrapped(data.project.address, contentW, 4.5);
  if (data.project.client) {
    setFont(false, 9, C.muted);
    ensure(5);
    doc.text(`Клиент: ${data.project.client}`, MX, y);
    y += 5;
  }
  y += 2;
  doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
  doc.setLineWidth(0.5);
  doc.line(MX, y, pageW - MX, y);
  y += 8;

  // Summary cards
  const hasBudget = data.has_budget ?? data.budget > 0;
  const gap = 4;
  const cardW = (contentW - gap * 2) / 3;
  ensure(22);
  const cards = [
    { t: "Бюджет", v: hasBudget ? money(data.budget) : "Не задан" },
    { t: "Итого по смете", v: money(data.total_spent) },
    {
      t: "Остаток",
      v: data.budget_remaining == null ? "—" : money(data.budget_remaining),
    },
  ];
  cards.forEach((c, i) => {
    const x = MX + i * (cardW + gap);
    doc.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
    doc.roundedRect(x, y, cardW, 16, 2.5, 2.5, "F");
    setFont(false, 8, C.muted);
    doc.text(c.t, x + 3, y + 5);
    setFont(true, 10, C.ink);
    const lines = doc.splitTextToSize(c.v, cardW - 6) as string[];
    doc.text(lines[0], x + 3, y + 11);
  });
  y += 22;

  // Group by category
  const groups = new Map<string, SmetaPdfExpense[]>();
  for (const e of data.expenses) {
    const list = groups.get(e.category) || [];
    list.push(e);
    groups.set(e.category, list);
  }

  if (groups.size === 0) {
    setFont(false, 10, C.muted);
    wrapped("Позиций в смете пока нет.", contentW, 5);
  }

  for (const [category, rows] of groups) {
    const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);
    ensure(14);
    setFont(true, 12, C.green);
    doc.text(category.toUpperCase(), MX, y);
    setFont(true, 10, C.ink);
    doc.text(money(sectionTotal), pageW - MX, y, { align: "right" });
    y += 3;
    doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
    doc.setLineWidth(0.45);
    doc.line(MX, y, MX + 16, y);
    y += 5;

    // table head
    const drawHead = () => {
      ensure(8);
      doc.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
      doc.roundedRect(MX, y - 4, contentW, 7, 1.5, 1.5, "F");
      setFont(true, 8, C.muted);
      doc.text("Позиция", MX + 2, y);
      doc.text("Ед.", MX + 78, y);
      doc.text("Кол-во", MX + 92, y);
      doc.text("Цена", MX + 112, y);
      doc.text("Сумма", pageW - MX, y, { align: "right" });
      y += 5;
    };
    drawHead();

    rows.forEach((e, idx) => {
      const name = itemName(e);
      const nameLines = doc.splitTextToSize(name, 72) as string[];
      const rowH = Math.max(6, nameLines.length * 3.8 + 1);
      if (y + rowH > pageH - BOTTOM) {
        doc.addPage();
        pageSections.push("Смета");
        y = TOP;
        drawHead();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(C.fill[0], C.fill[1], C.fill[2]);
        doc.rect(MX, y - 3.5, contentW, rowH, "F");
      }
      setFont(false, 9, C.ink);
      nameLines.forEach((line, li) => doc.text(line, MX + 2, y + li * 3.8));
      doc.text(e.unit || "—", MX + 78, y);
      doc.text(e.quantity != null ? String(e.quantity) : "—", MX + 92, y);
      doc.text(
        e.unit_price != null ? Number(e.unit_price).toLocaleString("ru-RU") : "—",
        MX + 112,
        y
      );
      doc.text(money(Number(e.amount)), pageW - MX, y, { align: "right" });
      const kind = e.kind
        ? SMETA_KIND_LABELS[e.kind as SmetaItemKind] || e.kind
        : "";
      if (kind) {
        setFont(false, 7, C.muted);
        doc.text(kind, MX + 2, y + nameLines.length * 3.8);
      }
      y += rowH;
    });
    y += 4;
  }

  ensure(10);
  doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
  doc.line(MX, y, pageW - MX, y);
  y += 6;
  setFont(true, 11, C.ink);
  doc.text("Итого по смете", MX, y);
  doc.text(money(data.total_spent), pageW - MX, y, { align: "right" });

  // Chrome
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setFont(true, 9, C.orange);
    doc.text("СтройУчёт", MX, 8);
    setFont(false, 8, C.muted);
    doc.text(`Смета · ${pageSections[i - 1] || "Смета"}`, pageW - MX, 8, {
      align: "right",
    });
    doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
    doc.setLineWidth(0.45);
    doc.line(MX, 10, pageW - MX, 10);
    if (i > 1) {
      setFont(false, 8, C.muted);
      const short =
        data.project.name.length > 70
          ? `${data.project.name.slice(0, 67)}…`
          : data.project.name;
      doc.text(short, MX, 13.5);
    }
    const fy = pageH - 10;
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.setLineWidth(0.25);
    doc.line(MX, fy - 4, pageW - MX, fy - 4);
    setFont(false, 8, C.muted);
    doc.text(`${author} · ${generatedLabel}`, MX, fy);
    doc.text(`${i} / ${totalPages}`, pageW - MX, fy, { align: "right" });
  }

  const filename = `Smeta_${safeFilename(data.project.name)}.pdf`;
  const blob = doc.output("blob");
  if (!blob || blob.size < 200) throw new Error("Не удалось сформировать PDF сметы");
  doc.save(filename);
  return { filename };
}
