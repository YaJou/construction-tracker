import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  SMETA_KIND_LABELS,
  sortSmetaCategories,
  type SmetaItemKind,
} from "@/lib/smetaTemplates";

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

/** Matches website smeta: green headers, cream cols, peach section totals */
const C = {
  green: [23, 63, 52] as [number, number, number],
  orange: [255, 122, 26] as [number, number, number],
  ink: [23, 32, 29] as [number, number, number],
  muted: [97, 115, 108] as [number, number, number],
  cream: [255, 244, 236] as [number, number, number], // #FFF4EC
  stripe: [248, 250, 249] as [number, number, number],
  fill: [245, 248, 246] as [number, number, number],
  line: [225, 233, 229] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const MX = 12;
const BOTTOM = 18;
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

function num(n: number) {
  return Number(n).toLocaleString("ru-RU");
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

/** Estimate PDF styled like the website smeta sections. */
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

  // Column anchors (mm) — match website table
  const colName = MX + 3.5;
  const colUnit = MX + 98;
  const colQtyR = MX + 122;
  const colPriceR = MX + 148;
  const colSumR = pageW - MX - 3.5;
  const nameMaxW = colUnit - colName - 4;

  const setFont = (bold: boolean, size: number, color = C.ink) => {
    doc.setFont("DejaVuSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const newPage = (sectionLabel?: string) => {
    doc.addPage();
    pageSections.push(sectionLabel || "Смета");
    y = TOP;
  };

  const ensure = (need: number) => {
    if (y + need > pageH - BOTTOM) newPage();
  };

  // —— Title ——
  setFont(true, 9, C.orange);
  doc.text("СтройУчёт", MX, y);
  y += 7;
  setFont(true, 20, C.ink);
  const titleLines = doc.splitTextToSize(data.project.name, contentW) as string[];
  for (const line of titleLines) {
    ensure(8);
    doc.text(line, MX, y);
    y += 7.5;
  }
  setFont(false, 10, C.muted);
  doc.text("Позиции по разделам · смета объекта", MX, y);
  y += 5;
  if (data.project.address) {
    const addr = doc.splitTextToSize(data.project.address, contentW) as string[];
    for (const line of addr) {
      ensure(4.5);
      doc.text(line, MX, y);
      y += 4.5;
    }
  }
  if (data.project.client) {
    ensure(5);
    doc.text(`Клиент: ${data.project.client}`, MX, y);
    y += 5;
  }
  y += 2;
  doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
  doc.setLineWidth(0.5);
  doc.line(MX, y, pageW - MX, y);
  y += 7;

  // —— Summary cards ——
  const hasBudget = data.has_budget ?? data.budget > 0;
  const gap = 4;
  const cardW = (contentW - gap * 2) / 3;
  ensure(20);
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
    doc.roundedRect(x, y, cardW, 15, 2.5, 2.5, "F");
    setFont(false, 7.5, C.muted);
    doc.text(c.t, x + 3, y + 5);
    setFont(true, 10, C.ink);
    const lines = doc.splitTextToSize(c.v, cardW - 6) as string[];
    doc.text(lines[0], x + 3, y + 11);
  });
  y += 20;

  // —— Groups ——
  const groups = new Map<string, SmetaPdfExpense[]>();
  for (const e of data.expenses) {
    const list = groups.get(e.category) || [];
    list.push(e);
    groups.set(e.category, list);
  }
  const orderedCategories = sortSmetaCategories([...groups.keys()]);

  if (groups.size === 0) {
    setFont(false, 10, C.muted);
    doc.text("Позиций в смете пока нет.", MX, y);
  }

  const drawSectionHeader = (category: string, sectionTotal: number) => {
    ensure(22);
    const h = 10;
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(MX, y, contentW, h, 2.2, 2.2, "F");
    // square bottom corners so it joins the table
    doc.rect(MX, y + h - 2.2, contentW, 2.2, "F");
    setFont(true, 10, C.white);
    doc.text(category.toUpperCase(), MX + 3.5, y + 6.5);
    doc.text(money(sectionTotal), colSumR, y + 6.5, { align: "right" });
    y += h;
  };

  const drawColHead = () => {
    ensure(8);
    const h = 7;
    doc.setFillColor(C.cream[0], C.cream[1], C.cream[2]);
    doc.rect(MX, y, contentW, h, "F");
    setFont(true, 7, C.muted);
    doc.text("ПОЗИЦИЯ", colName, y + 4.6);
    doc.text("ЕД.", colUnit, y + 4.6);
    doc.text("КОЛ-ВО", colQtyR, y + 4.6, { align: "right" });
    doc.text("ЦЕНА", colPriceR, y + 4.6, { align: "right" });
    doc.text("СТОИМОСТЬ", colSumR, y + 4.6, { align: "right" });
    y += h;
  };

  const drawSectionFooter = (category: string, sectionTotal: number) => {
    ensure(9);
    const h = 8;
    doc.setFillColor(C.cream[0], C.cream[1], C.cream[2]);
    doc.rect(MX, y, contentW, h, "F");
    // round bottom
    doc.setFillColor(C.cream[0], C.cream[1], C.cream[2]);
    doc.roundedRect(MX, y, contentW, h, 2, 2, "F");
    doc.rect(MX, y, contentW, 2, "F");
    setFont(true, 9, C.ink);
    doc.text(`Итого ${category}`, colName, y + 5.3);
    doc.text(money(sectionTotal), colSumR, y + 5.3, { align: "right" });
    y += h + 5;
  };

  for (const category of orderedCategories) {
    const rows = groups.get(category) || [];
    const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

    drawSectionHeader(category, sectionTotal);
    drawColHead();

    rows.forEach((e, idx) => {
      const name = itemName(e);
      const nameLines = doc.splitTextToSize(name, nameMaxW) as string[];
      const kind = e.kind
        ? SMETA_KIND_LABELS[e.kind as SmetaItemKind] || e.kind
        : "";
      const nameLh = 4.2;
      const topPad = 3.2;
      const kindH = kind ? 3.6 : 0;
      const bottomPad = 2.4;
      const rowH = Math.max(
        9,
        topPad + nameLines.length * nameLh + kindH + bottomPad
      );

      if (y + rowH + 10 > pageH - BOTTOM) {
        newPage(category);
        drawSectionHeader(category, sectionTotal);
        drawColHead();
      }

      // zebra
      if (idx % 2 === 1) {
        doc.setFillColor(C.stripe[0], C.stripe[1], C.stripe[2]);
        doc.rect(MX, y, contentW, rowH, "F");
      }

      const textY = y + topPad + 3.2;
      setFont(true, 9, C.ink);
      nameLines.forEach((line, li) => {
        doc.text(line, colName, textY + li * nameLh);
      });
      if (kind) {
        setFont(false, 7, C.muted);
        doc.text(kind, colName, textY + nameLines.length * nameLh + 0.2);
      }

      const numsY = textY;
      setFont(false, 8.5, C.muted);
      doc.text(e.unit || "—", colUnit, numsY);
      setFont(false, 8.5, C.ink);
      doc.text(e.quantity != null ? num(Number(e.quantity)) : "—", colQtyR, numsY, {
        align: "right",
      });
      doc.text(
        e.unit_price != null ? num(Number(e.unit_price)) : "—",
        colPriceR,
        numsY,
        { align: "right" }
      );
      setFont(true, 9, C.ink);
      doc.text(money(Number(e.amount)), colSumR, numsY, { align: "right" });

      // subtle bottom hairline
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      doc.setLineWidth(0.15);
      doc.line(MX, y + rowH, MX + contentW, y + rowH);

      y += rowH;
    });

    drawSectionFooter(category, sectionTotal);
  }

  // —— Grand total (green bar like website) ——
  if (groups.size > 0) {
    ensure(16);
    const h = 14;
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(MX, y, contentW, h, 3, 3, "F");
    setFont(true, 11, C.white);
    doc.text("Общая сумма по смете", MX + 4, y + 6);
    setFont(false, 8, C.white);
    doc.setTextColor(255, 255, 255);
    doc.text("По всем разделам", MX + 4, y + 10.5);
    setFont(true, 13, C.white);
    doc.text(money(data.total_spent), colSumR, y + 8.5, { align: "right" });
    y += h + 4;
  }

  // —— Chrome ——
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
