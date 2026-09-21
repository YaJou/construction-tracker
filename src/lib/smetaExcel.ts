import ExcelJS from "exceljs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  SMETA_KIND_LABELS,
  sortSmetaCategories,
  type SmetaItemKind,
} from "@/lib/smetaTemplates";
import type { SmetaPdfExpense, SmetaPdfInput } from "@/lib/smetaPdf";

const GREEN = "173F34";
const CREAM = "FFF4EC";
const STRIPE = "F8FAF9";
const MUTED = "61736C";
const INK = "17201D";
const ORANGE = "FF7A1A";
const WHITE = "FFFFFF";

function itemName(e: SmetaPdfExpense) {
  return e.subcategory || e.description || "—";
}

function kindLabel(kind?: string | null) {
  if (!kind) return "";
  return SMETA_KIND_LABELS[kind as SmetaItemKind] || kind;
}

function safeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim().slice(0, 60) || "smeta";
}

function styleFill(hex: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE1E9E5" } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function paintRow(row: ExcelJS.Row, hex: string, cols = 7) {
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).fill = styleFill(hex);
    row.getCell(c).border = thinBorder();
  }
}

/** Download smeta as .xlsx — amounts always visible in column F. */
export async function downloadSmetaExcel(
  data: SmetaPdfInput,
  options?: { authorName?: string }
) {
  if (!data?.project?.name) throw new Error("Нет данных объекта для сметы");

  const wb = new ExcelJS.Workbook();
  wb.creator = "СтройУчёт";
  wb.created = new Date();
  // So Excel shows formula results without "need to recalculate"
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet("Смета", {
    views: [{ state: "frozen", ySplit: 8 }],
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = [
    { key: "name", width: 42 },
    { key: "kind", width: 12 },
    { key: "unit", width: 10 },
    { key: "qty", width: 12 },
    { key: "price", width: 14 },
    { key: "amount", width: 16 },
    { key: "note", width: 28 },
  ];

  const author =
    options?.authorName?.trim() || data.project.manager?.trim() || "Пользователь";
  const generated = format(new Date(data.generated_at || Date.now()), "d MMMM yyyy, HH:mm", {
    locale: ru,
  });

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "СтройУчёт · Смета объекта";
  ws.getCell("A1").font = { bold: true, color: { argb: `FF${ORANGE}` }, size: 11 };

  ws.mergeCells("A2:G2");
  ws.getCell("A2").value = data.project.name;
  ws.getCell("A2").font = { bold: true, color: { argb: `FF${INK}` }, size: 16 };

  ws.mergeCells("A3:G3");
  ws.getCell("A3").value = [
    data.project.address,
    data.project.client ? `Клиент: ${data.project.client}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  ws.getCell("A3").font = { color: { argb: `FF${MUTED}` }, size: 10 };

  ws.mergeCells("A4:G4");
  ws.getCell("A4").value = `${author} · ${generated}`;
  ws.getCell("A4").font = { color: { argb: `FF${MUTED}` }, size: 9 };

  // Top total: label A–E, sum in F
  const sumRow = ws.getRow(6);
  sumRow.height = 24;
  ws.mergeCells("A6:E6");
  sumRow.getCell(1).value = "Общая сумма по смете";
  sumRow.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 12 };
  sumRow.getCell(1).alignment = { vertical: "middle" };
  sumRow.getCell(6).value = Number(data.total_spent);
  sumRow.getCell(6).numFmt = '#,##0 "₽"';
  sumRow.getCell(6).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 13 };
  sumRow.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  paintRow(sumRow, GREEN);

  const groups = new Map<string, SmetaPdfExpense[]>();
  for (const e of data.expenses) {
    const list = groups.get(e.category) || [];
    list.push(e);
    groups.set(e.category, list);
  }
  const ordered = sortSmetaCategories([...groups.keys()]);

  let rowIdx = 8;
  const sectionFooterRows: number[] = [];

  for (const category of ordered) {
    const rows = groups.get(category) || [];
    const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

    // Section header: name in A–E, total in F
    ws.mergeCells(rowIdx, 1, rowIdx, 5);
    const head = ws.getRow(rowIdx);
    head.height = 22;
    head.getCell(1).value = category.toUpperCase();
    head.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 11 };
    head.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    head.getCell(6).value = sectionTotal;
    head.getCell(6).numFmt = '#,##0 "₽"';
    head.getCell(6).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 11 };
    head.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
    paintRow(head, GREEN);
    rowIdx += 1;

    // Column headers
    const colHead = ws.getRow(rowIdx);
    colHead.values = ["Позиция", "Тип", "Ед.", "Кол-во", "Цена, ₽", "Стоимость, ₽", "Примечание"];
    colHead.font = { bold: true, color: { argb: `FF${MUTED}` }, size: 9 };
    colHead.height = 18;
    for (let c = 1; c <= 7; c++) {
      colHead.getCell(c).fill = styleFill(CREAM);
      colHead.getCell(c).border = thinBorder();
      colHead.getCell(c).alignment = { vertical: "middle" };
    }
    rowIdx += 1;

    const firstDataRow = rowIdx;

    for (let i = 0; i < rows.length; i++) {
      const e = rows[i];
      const r = ws.getRow(rowIdx);
      const qty = e.quantity != null && Number.isFinite(Number(e.quantity)) ? Number(e.quantity) : null;
      const price =
        e.unit_price != null && Number.isFinite(Number(e.unit_price))
          ? Number(e.unit_price)
          : null;
      const amount =
        qty != null && price != null
          ? Math.round(qty * price * 100) / 100
          : Number(e.amount) || 0;

      r.getCell(1).value = itemName(e);
      r.getCell(1).font = { bold: true, color: { argb: `FF${INK}` }, size: 10 };
      r.getCell(2).value = kindLabel(e.kind);
      r.getCell(2).font = { color: { argb: `FF${MUTED}` }, size: 9 };
      r.getCell(3).value = e.unit || "—";
      r.getCell(4).value = qty;
      r.getCell(4).numFmt = "#,##0.##";
      r.getCell(5).value = price;
      r.getCell(5).numFmt = '#,##0.## "₽"';

      // Visible number + formula so cost always shows (even before Excel recalc)
      if (qty != null && price != null) {
        r.getCell(6).value = {
          formula: `D${rowIdx}*E${rowIdx}`,
          result: amount,
        };
      } else {
        r.getCell(6).value = amount;
      }
      r.getCell(6).numFmt = '#,##0 "₽"';
      r.getCell(6).font = { bold: true };
      r.getCell(7).value = "";

      r.height = 20;
      if (i % 2 === 1) {
        for (let c = 1; c <= 7; c++) r.getCell(c).fill = styleFill(STRIPE);
      }
      for (let c = 1; c <= 7; c++) r.getCell(c).border = thinBorder();

      rowIdx += 1;
    }

    const lastDataRow = rowIdx - 1;

    // Section footer: label left, sum in F
    const foot = ws.getRow(rowIdx);
    foot.height = 20;
    ws.mergeCells(rowIdx, 1, rowIdx, 5);
    foot.getCell(1).value = `Итого ${category}`;
    foot.getCell(1).font = { bold: true, size: 10 };
    foot.getCell(1).alignment = { vertical: "middle" };
    if (lastDataRow >= firstDataRow) {
      foot.getCell(6).value = {
        formula: `SUM(F${firstDataRow}:F${lastDataRow})`,
        result: sectionTotal,
      };
    } else {
      foot.getCell(6).value = sectionTotal;
    }
    foot.getCell(6).numFmt = '#,##0 "₽"';
    foot.getCell(6).font = { bold: true, size: 10 };
    foot.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
    paintRow(foot, CREAM);
    sectionFooterRows.push(rowIdx);
    rowIdx += 1;

    rowIdx += 1; // spacer
  }

  // Bottom grand total: label A–E, sum in F
  const grand = ws.getRow(rowIdx);
  grand.height = 26;
  ws.mergeCells(rowIdx, 1, rowIdx, 5);
  grand.getCell(1).value = "Общая сумма по смете";
  grand.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 12 };
  grand.getCell(1).alignment = { vertical: "middle" };
  if (sectionFooterRows.length) {
    grand.getCell(6).value = {
      formula: `SUM(${sectionFooterRows.map((n) => `F${n}`).join(",")})`,
      result: Number(data.total_spent),
    };
  } else {
    grand.getCell(6).value = Number(data.total_spent);
  }
  // Keep top total in sync with same number
  sumRow.getCell(6).value = Number(data.total_spent);

  grand.getCell(6).numFmt = '#,##0 "₽"';
  grand.getCell(6).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 13 };
  grand.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  paintRow(grand, GREEN);

  const help = wb.addWorksheet("Как пользоваться");
  help.columns = [{ width: 80 }];
  help.getCell("A1").value = "Как править смету в Excel";
  help.getCell("A1").font = { bold: true, size: 14 };
  help.getCell("A3").value =
    "1. Меняйте «Кол-во» (D) и «Цена» (E) — «Стоимость» (F) пересчитается.";
  help.getCell("A4").value = "2. Все суммы (разделы и итог) стоят в колонке F.";
  help.getCell("A5").value = "3. Итог раздела = сумма стоимостей позиций.";
  help.getCell("A7").value = "СтройУчёт";
  help.getCell("A7").font = { bold: true, color: { argb: `FF${ORANGE}` } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Smeta_${safeFilename(data.project.name)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { filename };
}
