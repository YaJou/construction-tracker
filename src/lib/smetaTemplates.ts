/**
 * Default estimate (смета) sections for a ~100 m² house.
 * Adding a section to a project copies its line items; editing templates later
 * does not rewrite existing project estimates.
 */

export type SmetaItemKind = "material" | "labor" | "other";

export type SmetaTemplateItem = {
  name: string;
  unit: string;
  /** Default quantity; null = leave empty for user */
  quantity: number | null;
  /** Default unit price in ₽; null = leave empty */
  unit_price: number | null;
  kind: SmetaItemKind;
  note?: string | null;
};

export type SmetaTemplateSection = {
  name: string;
  items: SmetaTemplateItem[];
};

export const SMETA_TEMPLATES: SmetaTemplateSection[] = [
  {
    name: "Фундамент",
    items: [
      { name: "Бетон М250", unit: "м³", quantity: 45, unit_price: 6000, kind: "material" },
      { name: "Арматура", unit: "кг", quantity: 1100, unit_price: 80, kind: "material" },
      { name: "Опалубка", unit: "м³", quantity: 1, unit_price: 23000, kind: "material" },
      { name: "Работа", unit: "м³", quantity: 45, unit_price: 4500, kind: "labor" },
    ],
  },
  {
    name: "Стены",
    items: [
      {
        name: "Кирпич Магма",
        unit: "шт",
        quantity: 8000,
        unit_price: 55,
        kind: "material",
        note: "черновой расчёт",
      },
      { name: "Раствор / кладочная смесь", unit: "шт", quantity: 70, unit_price: 500, kind: "material" },
      { name: "Работа кирпич", unit: "шт", quantity: 8000, unit_price: 38, kind: "labor" },
      { name: "Блок Грас 600×300×200", unit: "м³", quantity: 18, unit_price: 5000, kind: "material" },
    ],
  },
  {
    name: "Кровля",
    items: [
      { name: "Стропильная система", unit: "м³", quantity: 15, unit_price: 22000, kind: "material" },
      { name: "Кровельный материал", unit: "м²", quantity: 250, unit_price: null, kind: "material" },
      { name: "Утепление кровли", unit: "уп", quantity: 50, unit_price: 1200, kind: "material" },
    ],
  },
  {
    name: "Окна и двери",
    items: [
      { name: "Окна", unit: "компл.", quantity: 1, unit_price: 300000, kind: "material" },
      { name: "Входная дверь", unit: "шт", quantity: 1, unit_price: 50000, kind: "material" },
    ],
  },
  {
    name: "Черновые работы",
    items: [
      { name: "Штукатурка стен", unit: "м²", quantity: null, unit_price: null, kind: "labor" },
      { name: "Стяжка пола", unit: "м²", quantity: null, unit_price: null, kind: "labor" },
      { name: "Тёплый пол", unit: "м²", quantity: null, unit_price: null, kind: "material" },
    ],
  },
  {
    name: "Электрика",
    items: [
      { name: "Электрика / кабель", unit: "компл.", quantity: 1, unit_price: null, kind: "material" },
    ],
  },
  {
    name: "Сантехника",
    items: [
      {
        name: "Разводка воды и канализации",
        unit: "компл.",
        quantity: 1,
        unit_price: null,
        kind: "material",
      },
      {
        name: "Санузлы",
        unit: "шт",
        quantity: 2,
        unit_price: null,
        kind: "other",
        note: "2 с/у",
      },
    ],
  },
  {
    name: "Дополнения",
    items: [
      { name: "Благоустройство", unit: "компл.", quantity: 1, unit_price: null, kind: "other" },
      { name: "Забор / ворота", unit: "м.п.", quantity: null, unit_price: null, kind: "material" },
      { name: "Прочие работы", unit: "компл.", quantity: 1, unit_price: null, kind: "labor" },
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
