/**
 * Detailed house estimate (смета) matching the spreadsheet structure:
 * category → line items (qty × price) → section subtotals → grand total.
 * Seeded into `expenses` for a project; editing later does not rewrite other projects.
 */

export type SmetaItemKind = "material" | "labor" | "other";

export type SmetaTemplateItem = {
  name: string;
  unit: string;
  quantity: number | null;
  unit_price: number | null;
  kind: SmetaItemKind;
  note?: string | null;
};

export type SmetaTemplateSection = {
  name: string;
  items: SmetaTemplateItem[];
};

/** Order of sections in UI / PDF (matches spreadsheet). */
export const SMETA_SECTION_ORDER = [
  "Фундамент",
  "Плита черновая",
  "Цоколь",
  "Стены",
  "Армопояс",
  "Кровля",
  "Окна и двери",
  "Прочее",
] as const;

/**
 * Full detailed estimate from the TP-5 / ~116 m² sample spreadsheet.
 * Grand total ≈ 4 195 360 ₽.
 */
export const SMETA_TEMPLATES: SmetaTemplateSection[] = [
  {
    name: "Фундамент",
    items: [
      { name: "Земляные работы (траншея)", unit: "час", quantity: 16, unit_price: 1500, kind: "labor" },
      { name: "Опалубка", unit: "м³", quantity: 45, unit_price: 1000, kind: "material" },
      { name: "Арматура 8мм", unit: "кг", quantity: 150, unit_price: 80, kind: "material" },
      { name: "Арматура 10мм", unit: "кг", quantity: 450, unit_price: 80, kind: "material" },
      { name: "Арматура 12мм", unit: "кг", quantity: 500, unit_price: 80, kind: "material" },
      { name: "Бетон М250", unit: "м³", quantity: 45, unit_price: 6000, kind: "material" },
      { name: "Доставка бетона", unit: "шт.", quantity: 1, unit_price: 15000, kind: "other" },
      { name: "Бетононасос", unit: "шт.", quantity: 1, unit_price: 30000, kind: "other" },
      { name: "Прочее (плёнка / подставки)", unit: "шт.", quantity: 1, unit_price: 21000, kind: "other" },
      { name: "Работа", unit: "м³", quantity: 45, unit_price: 4500, kind: "labor" },
    ],
  },
  {
    name: "Плита черновая",
    items: [
      { name: "Обратная засыпка", unit: "м³", quantity: 45, unit_price: 1000, kind: "material" },
      { name: "Бетон М200", unit: "м³", quantity: 25, unit_price: 5000, kind: "material" },
      { name: "Арматура", unit: "кг", quantity: 500, unit_price: 80, kind: "material" },
      {
        name: "Разводка вода / канализация",
        unit: "компл.",
        quantity: 1,
        unit_price: 20000,
        kind: "material",
      },
      { name: "Бетононасос", unit: "шт.", quantity: 1, unit_price: 15000, kind: "other" },
      { name: "Работа", unit: "м³", quantity: 25, unit_price: 4400, kind: "labor" },
    ],
  },
  {
    name: "Цоколь",
    items: [
      { name: "Кирпич красный М-200", unit: "шт.", quantity: 2880, unit_price: 22, kind: "material" },
      { name: "Смесь", unit: "шт.", quantity: 10, unit_price: 400, kind: "material" },
      { name: "Прочее (рубероид / сетка)", unit: "шт.", quantity: 1, unit_price: 22000, kind: "other" },
      { name: "Работа", unit: "шт.", quantity: 2880, unit_price: 20, kind: "labor" },
    ],
  },
  {
    name: "Стены",
    items: [
      { name: "Кирпич Магма", unit: "шт.", quantity: 8000, unit_price: 55, kind: "material" },
      { name: "Работа кирпич", unit: "шт.", quantity: 8000, unit_price: 20, kind: "labor" },
      { name: "Раствор", unit: "шт.", quantity: 30, unit_price: 400, kind: "material" },
      { name: "Блок Грас", unit: "шт.", quantity: 1600, unit_price: 150, kind: "material" },
      { name: "Работа блок", unit: "шт.", quantity: 1600, unit_price: 60, kind: "labor" },
      { name: "Перемычки оконные", unit: "шт.", quantity: 16, unit_price: 1000, kind: "material" },
      { name: "Прочее", unit: "шт.", quantity: 1, unit_price: 180000, kind: "other" },
    ],
  },
  {
    name: "Армопояс",
    items: [
      { name: "Бетон", unit: "м³", quantity: 4, unit_price: 5000, kind: "material" },
      { name: "Арматура 10мм", unit: "кг", quantity: 120, unit_price: 80, kind: "material" },
      { name: "Техноплекс", unit: "шт.", quantity: 10, unit_price: 1000, kind: "material" },
      { name: "Работа", unit: "м³", quantity: 4, unit_price: 6250, kind: "labor" },
    ],
  },
  {
    name: "Кровля",
    items: [
      {
        name: "Ондутис гидро / пароизоляция",
        unit: "шт.",
        quantity: 6,
        unit_price: 3500,
        kind: "material",
      },
      { name: "Стропильная система", unit: "м³", quantity: 12, unit_price: 25000, kind: "material" },
      { name: "OSB-3", unit: "шт.", quantity: 75, unit_price: 1000, kind: "material" },
      {
        name: "Г.Ч. ТН Финская «Аккорд»",
        unit: "шт.",
        quantity: 75,
        unit_price: 2500,
        kind: "material",
      },
      { name: "ИЗОЛАЙТ", unit: "уп.", quantity: 40, unit_price: 2645, kind: "material" },
      {
        name: "Прочее (метизы, герметик, пилки и т.п.)",
        unit: "шт.",
        quantity: 1,
        unit_price: 100000,
        kind: "other",
        note: "болты, биты, гвозди, герметик, пилки",
      },
      { name: "Работа", unit: "м²", quantity: 250, unit_price: 1800, kind: "labor" },
    ],
  },
  {
    name: "Окна и двери",
    items: [
      { name: "Окна", unit: "компл.", quantity: 1, unit_price: 300000, kind: "material" },
      { name: "Входная дверь", unit: "шт.", quantity: 1, unit_price: 50000, kind: "material" },
    ],
  },
  {
    name: "Прочее",
    items: [
      { name: "Доставка", unit: "компл.", quantity: 1, unit_price: 200000, kind: "other" },
    ],
  },
];

export function findSmetaTemplate(name: string) {
  const n = name.trim().toLowerCase();
  return SMETA_TEMPLATES.find((s) => s.name.toLowerCase() === n) ?? null;
}

export function lineAmount(quantity: number | null, unitPrice: number | null): number {
  if (quantity == null || unitPrice == null) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

export const SMETA_KIND_LABELS: Record<SmetaItemKind, string> = {
  material: "Материал",
  labor: "Работа",
  other: "Прочее",
};

export function smetaSectionNames() {
  return SMETA_TEMPLATES.map((t) => t.name);
}

export function smetaItemsForSection(sectionName: string) {
  return findSmetaTemplate(sectionName)?.items ?? [];
}

/** Flatten all template lines for bulk insert into expenses. */
export function buildDetailedSmetaExpenseRows(date: string, addedBy: string) {
  const rows: {
    date: string;
    category: string;
    subcategory: string;
    description: string;
    quantity: number;
    unit_price: number;
    unit: string;
    kind: SmetaItemKind;
    amount: number;
    added_by: string;
  }[] = [];

  for (const section of SMETA_TEMPLATES) {
    for (const item of section.items) {
      const qty = item.quantity ?? 0;
      const price = item.unit_price ?? 0;
      const amount = lineAmount(qty, price);
      if (amount <= 0) continue;
      rows.push({
        date,
        category: section.name,
        subcategory: item.name,
        description: item.note ? `${item.name} — ${item.note}` : item.name,
        quantity: qty,
        unit_price: price,
        unit: item.unit,
        kind: item.kind,
        amount,
        added_by: addedBy,
      });
    }
  }
  return rows;
}

export function detailedSmetaGrandTotal() {
  return buildDetailedSmetaExpenseRows("1970-01-01", "calc").reduce((s, r) => s + r.amount, 0);
}

export function sortSmetaCategories(categories: string[]) {
  const order = new Map(SMETA_SECTION_ORDER.map((n, i) => [n.toLowerCase(), i]));
  return [...categories].sort((a, b) => {
    const ia = order.get(a.toLowerCase()) ?? 1000;
    const ib = order.get(b.toLowerCase()) ?? 1000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "ru");
  });
}
