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

/** Download smeta as .xlsx — same sections as website / PDF, editable qty×price. */
export async function downloadSmetaExcel(
  data: SmetaPdfInput,
  options?: { authorName?: string }
) {
  if (!data?.project?.name) throw new Error("Нет данных объекта для сметы");

  const wb = new ExcelJS.Workbook();
  wb.creator = "СтройУчёт";
  wb.created = new Date();

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

  // Brand + title
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

  // Total only (no budget)
  const sumRow = ws.getRow(6);
  sumRow.height = 24;
  ws.mergeCells("A6:E6");
  sumRow.getCell(1).value = "Общая сумма по смете";
  sumRow.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 12 };
  sumRow.getCell(1).alignment = { vertical: "middle" };
  sumRow.getCell(6).value = data.total_spent;
  sumRow.getCell(6).numFmt = '#,##0 "₽"';
  sumRow.getCell(6).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 13 };
  sumRow.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  for (let c = 1; c <= 7; c++) {
    sumRow.getCell(c).fill = styleFill(GREEN);
    sumRow.getCell(c).border = thinBorder();
  }

  ws.getRow(7).values = [];

  const groups = new Map<string, SmetaPdfExpense[]>();
  for (const e of data.expenses) {
    const list = groups.get(e.category) || [];
    list.push(e);
    groups.set(e.category, list);
  }
  const ordered = sortSmetaCategories([...groups.keys()]);

  let rowIdx = 8;
  const sectionAmountRanges: string[] = [];

  for (const category of ordered) {
    const rows = groups.get(category) || [];
    const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

    // Section header
    ws.mergeCells(rowIdx, 1, rowIdx, 7);
    const head = ws.getRow(rowIdx);
    head.height = 22;
    head.getCell(1).value = `${category.toUpperCase()}    ${Math.round(sectionTotal).toLocaleString("ru-RU")} ₽`;
    head.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 11 };
    head.getCell(1).fill = styleFill(GREEN);
    head.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    for (let c = 1; c <= 7; c++) {
      head.getCell(c).fill = styleFill(GREEN);
      head.getCell(c).border = thinBorder();
    }
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

    rows.forEach((e, i) => {
      const r = ws.getRow(rowIdx);
      const qty = e.quantity != null ? Number(e.quantity) : null;
      const price = e.unit_price != null ? Number(e.unit_price) : null;
      const hasFormula = qty != null && price != null;

      r.values = [
        itemName(e),
        kindLabel(e.kind),
        e.unit || "—",
        qty,
        price,
        hasFormula ? { formula: `D${rowIdx}*E${rowIdx}` } : Number(e.amount),
        "",
      ];
      r.height = 20;
      r.getCell(1).font = { bold: true, color: { argb: `FF${INK}` }, size: 10 };
      r.getCell(2).font = { color: { argb: `FF${MUTED}` }, size: 9 };
      r.getCell(4).numFmt = "#,##0.##";
      r.getCell(5).numFmt = '#,##0 "₽"';
      r.getCell(6).numFmt = '#,##0 "₽"';
      r.getCell(6).font = { bold: true };

      if (i % 2 === 1) {
        for (let c = 1; c <= 7; c++) r.getCell(c).fill = styleFill(STRIPE);
      }
      for (let c = 1; c <= 7; c++) r.getCell(c).border = thinBorder();

      rowIdx += 1;
    });

    const lastDataRow = rowIdx - 1;
    if (lastDataRow >= firstDataRow) {
      sectionAmountRanges.push(`F${firstDataRow}:F${lastDataRow}`);
    }

    // Section footer with SUM formula
    const foot = ws.getRow(rowIdx);
    foot.height = 20;
    foot.getCell(1).value = `Итого ${category}`;
    foot.getCell(1).font = { bold: true, size: 10 };
    if (lastDataRow >= firstDataRow) {
      foot.getCell(6).value = { formula: `SUM(F${firstDataRow}:F${lastDataRow})` };
    } else {
      foot.getCell(6).value = sectionTotal;
    }
    foot.getCell(6).numFmt = '#,##0 "₽"';
    foot.getCell(6).font = { bold: true, size: 10 };
    for (let c = 1; c <= 7; c++) {
      foot.getCell(c).fill = styleFill(CREAM);
      foot.getCell(c).border = thinBorder();
    }
    rowIdx += 1;

    // spacer
    rowIdx += 1;
  }

  // Grand total
  const grand = ws.getRow(rowIdx);
  grand.height = 26;
  ws.mergeCells(rowIdx, 1, rowIdx, 5);
  grand.getCell(1).value = "Общая сумма по смете";
  grand.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 12 };
  grand.getCell(1).alignment = { vertical: "middle" };
  if (sectionAmountRanges.length) {
    grand.getCell(6).value = {
      formula: `SUM(${sectionAmountRanges.join(",")})`,
    };
  } else {
    grand.getCell(6).value = data.total_spent;
  }
  grand.getCell(6).numFmt = '#,##0 "₽"';
  grand.getCell(6).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 13 };
  grand.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  for (let c = 1; c <= 7; c++) {
    grand.getCell(c).fill = styleFill(GREEN);
    grand.getCell(c).border = thinBorder();
  }

  // Help sheet
  const help = wb.addWorksheet("Как пользоваться");
  help.columns = [{ width: 80 }];
  help.getCell("A1").value = "Как править смету в Excel";
  help.getCell("A1").font = { bold: true, size: 14 };
  help.getCell("A3").value =
    "1. Меняйте «Кол-во» и «Цена» — «Стоимость» пересчитается (формула кол-во × цена).";
  help.getCell("A4").value =
    "2. Итог раздела тоже считается автоматически (сумма позиций).";
  help.getCell("A5").value =
    "3. Общая сумма внизу — сумма всех стоимостей позиций.";
  help.getCell("A6").value =
    "4. Можно добавлять строки внутри раздела: скопируйте формулу стоимости из соседней ячейки.";
  help.getCell("A8").value = "СтройУчёт";
  help.getCell("A8").font = { bold: true, color: { argb: `FF${ORANGE}` } };

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
