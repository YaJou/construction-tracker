"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  SMETA_KIND_LABELS,
  lineAmount,
  smetaItemsForSection,
  sortSmetaCategories,
  type SmetaItemKind,
} from "@/lib/smetaTemplates";
import { downloadSmetaPdf } from "@/lib/smetaPdf";
import { ClipboardList, FileText, FileSpreadsheet, Loader2, Pencil, Trash2, Sparkles } from "lucide-react";
import { LoadingBlock, SkeletonLines } from "@/components/ui/Loading";
import { format } from "date-fns";
import { EXPENSE_CATEGORIES, LEGACY_EXPENSE_CATEGORIES } from "@/lib/constants";

type ExpenseRow = {
  id: number;
  date: string;
  category: string;
  description: string | null;
  subcategory?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unit?: string | null;
  kind?: string | null;
  amount: number;
};

type ExpensesPayload = {
  expenses: ExpenseRow[];
  total_spent: number;
  budget: number;
  has_budget?: boolean;
  budget_remaining: number | null;
  project?: { name: string; address?: string; client?: string; manager?: string | null } | null;
};

function money(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function itemLabel(e: ExpenseRow) {
  return e.subcategory || e.description || "—";
}

export function ProjectExpensesSection({
  projectId,
  reloadKey,
  refetch,
}: {
  projectId: number;
  reloadKey: number;
  refetch: () => void;
}) {
  const { displayName } = useAuth();
  const [data, setData] = useState<ExpensesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState("");
  const [customSub, setCustomSub] = useState(false);
  const [unit, setUnit] = useState("шт");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [kind, setKind] = useState<SmetaItemKind | "">("material");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState({
    date: "",
    category: "",
    subcategory: "",
    unit: "",
    quantity: "",
    unit_price: "",
    kind: "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");

  const templateItems = useMemo(() => smetaItemsForSection(category), [category]);

  const computedAmount = useMemo(() => {
    const q = quantity.trim() === "" ? null : Number(quantity.replace(",", "."));
    const p =
      unitPrice.trim() === ""
        ? null
        : Number(unitPrice.replace(/\s/g, "").replace(",", "."));
    return lineAmount(q, p);
  }, [quantity, unitPrice]);

  const load = () => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/expenses`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Ошибка загрузки");
        setData(json);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [projectId, reloadKey]);

  useEffect(() => {
    if (customSub) return;
    const item = templateItems.find((i) => i.name === subcategory);
    if (item) {
      setUnit(item.unit);
      setKind(item.kind);
      if (item.unit_price != null) setUnitPrice(String(item.unit_price));
      if (item.quantity != null && !quantity) setQuantity(String(item.quantity));
    }
  }, [subcategory, templateItems, customSub]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCategoryChange = (next: string) => {
    setCategory(next);
    setCustomSub(false);
    const items = smetaItemsForSection(next);
    if (items[0]) {
      setSubcategory(items[0].name);
      setUnit(items[0].unit);
      setKind(items[0].kind);
      setUnitPrice(items[0].unit_price != null ? String(items[0].unit_price) : "");
      setQuantity(items[0].quantity != null ? String(items[0].quantity) : "");
    } else {
      setSubcategory("");
      setUnit("шт");
      setKind("other");
      setUnitPrice("");
      setQuantity("");
    }
  };

  useEffect(() => {
    onCategoryChange(EXPENSE_CATEGORIES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!subcategory.trim() || computedAmount <= 0) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          category,
          subcategory: subcategory.trim(),
          description: subcategory.trim(),
          quantity: quantity.trim() === "" ? null : Number(quantity.replace(",", ".")),
          unit_price:
            unitPrice.trim() === ""
              ? null
              : Number(unitPrice.replace(/\s/g, "").replace(",", ".")),
          unit,
          kind: kind || null,
          amount: computedAmount,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Не удалось добавить");
      setQuantity("");
      load();
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const handleSeedDetailed = async () => {
    const hasRows = (data?.expenses.length || 0) > 0;
    const ok = window.confirm(
      hasRows
        ? "Заменить текущие позиции детальной сметой по образцу (~4,2 млн ₽)? Старые строки удалятся."
        : "Заполнить смету детальными позициями по образцу (фундамент, стены, кровля… ~4,2 млн ₽)?"
    );
    if (!ok) return;
    setSeeding(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_detailed", replace: true, date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Не удалось заполнить смету");
      load();
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка заполнения");
    } finally {
      setSeeding(false);
    }
  };

  const handleExportSmetaPdf = async () => {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    setError("");
    try {
      await downloadSmetaPdf(
        {
          project: {
            name: data.project?.name || `Объект #${projectId}`,
            address: data.project?.address || "",
            client: data.project?.client || "",
            manager: data.project?.manager || null,
          },
          expenses: data.expenses,
          total_spent: data.total_spent,
          budget: data.budget,
          has_budget: data.has_budget,
          budget_remaining: data.budget_remaining,
          generated_at: new Date().toISOString(),
        },
        { authorName: displayName }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка PDF сметы");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleExportSmetaExcel = async () => {
    if (!data || excelBusy) return;
    setExcelBusy(true);
    setError("");
    try {
      const { downloadSmetaExcel } = await import("@/lib/smetaExcel");
      await downloadSmetaExcel(
        {
          project: {
            name: data.project?.name || `Объект #${projectId}`,
            address: data.project?.address || "",
            client: data.project?.client || "",
            manager: data.project?.manager || null,
          },
          expenses: data.expenses,
          total_spent: data.total_spent,
          budget: data.budget,
          has_budget: data.has_budget,
          budget_remaining: data.budget_remaining,
          generated_at: new Date().toISOString(),
        },
        { authorName: displayName }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка Excel сметы");
    } finally {
      setExcelBusy(false);
    }
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...LEGACY_EXPENSE_CATEGORIES]);
    for (const e of data?.expenses || []) set.add(e.category);
    return sortSmetaCategories([...set]);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = [...data.expenses];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.category.toLowerCase().includes(q) ||
          itemLabel(e).toLowerCase().includes(q) ||
          String(e.amount).includes(q)
      );
    }
    if (filterCategory) list = list.filter((e) => e.category === filterCategory);
    return list;
  }, [data, search, filterCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    for (const e of filtered) {
      const list = map.get(e.category) || [];
      list.push(e);
      map.set(e.category, list);
    }
    return sortSmetaCategories([...map.keys()]).map(
      (c) => [c, map.get(c)!] as const
    );
  }, [filtered]);

  const startEdit = (exp: ExpenseRow) => {
    setEditingId(exp.id);
    setEdit({
      date: exp.date,
      category: exp.category,
      subcategory: itemLabel(exp),
      unit: exp.unit || "",
      quantity: exp.quantity != null ? String(exp.quantity) : "",
      unit_price: exp.unit_price != null ? String(exp.unit_price) : "",
      kind: exp.kind || "",
    });
  };

  const saveEdit = async (expenseId: number) => {
    setSaving(true);
    const q =
      edit.quantity.trim() === "" ? null : Number(edit.quantity.replace(",", "."));
    const p =
      edit.unit_price.trim() === ""
        ? null
        : Number(edit.unit_price.replace(/\s/g, "").replace(",", "."));
    const res = await fetch(`/api/projects/${projectId}/expenses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenseId,
        date: edit.date,
        category: edit.category,
        subcategory: edit.subcategory,
        unit: edit.unit,
        quantity: q,
        unit_price: p,
        kind: edit.kind || null,
        amount: lineAmount(q, p),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
      refetch();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Ошибка сохранения");
    }
  };

  const removeRow = async (expenseId: number) => {
    if (!window.confirm("Удалить позицию?")) return;
    await fetch(`/api/projects/${projectId}/expenses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId }),
    });
    load();
    refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <ClipboardList className="h-5 w-5 text-orange" />
              Смета объекта
            </h2>
            <p className="mt-1 text-sm text-muted max-w-xl">
              Разделы как в таблице: позиция, ед., кол-во, цена и стоимость. Внизу — итог по
              разделу и общая сумма.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-[12px] bg-green px-3 py-2 text-right text-white">
              <p className="text-[11px] uppercase tracking-wider text-white/80">Общая сумма</p>
              <p className="font-bold tabular-nums">{money(data?.total_spent || 0)}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={seeding}
              onClick={() => void handleSeedDetailed()}
            >
              {seeding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Заполнить смету
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pdfBusy || !data?.expenses.length}
              onClick={() => void handleExportSmetaPdf()}
            >
              {pdfBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              Смета PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={excelBusy || !data?.expenses.length}
              onClick={() => void handleExportSmetaExcel()}
            >
              {excelBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              )}
              Смета Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs text-muted">Дата</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Раздел</label>
              <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Позиция</label>
              {customSub || templateItems.length === 0 ? (
                <Input
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Название позиции"
                />
              ) : (
                <Select
                  value={subcategory}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomSub(true);
                      setSubcategory("");
                      return;
                    }
                    setSubcategory(e.target.value);
                  }}
                >
                  {templateItems.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                  <option value="__custom__">Другая позиция…</option>
                </Select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Тип</label>
              <Select value={kind} onChange={(e) => setKind(e.target.value as SmetaItemKind)}>
                <option value="material">{SMETA_KIND_LABELS.material}</option>
                <option value="labor">{SMETA_KIND_LABELS.labor}</option>
                <option value="other">{SMETA_KIND_LABELS.other}</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Ед.</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Кол-во</label>
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Цена, ₽</label>
              <Input
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Стоимость</label>
              <div className="flex h-[42px] items-center rounded-[10px] border border-line bg-surface px-3 font-semibold tabular-nums">
                {computedAmount > 0 ? money(computedAmount) : "—"}
              </div>
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button
                className="w-full min-h-10"
                disabled={adding || !subcategory.trim() || computedAmount <= 0}
                onClick={() => void handleAdd()}
              >
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Добавить позицию
              </Button>
            </div>
          </div>

          {error && (
            <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {data && (
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              <span>
                Бюджет:{" "}
                <strong className="text-ink">
                  {data.has_budget === false || data.budget <= 0
                    ? "не задан"
                    : money(data.budget)}
                </strong>
              </span>
              <span>
                По смете: <strong className="text-ink">{money(data.total_spent)}</strong>
              </span>
              {data.budget_remaining != null && (
                <span className={data.budget_remaining < 0 ? "text-red-600" : ""}>
                  Остаток: <strong>{money(data.budget_remaining)}</strong>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-ink">Позиции по разделам</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              type="search"
              placeholder="Поиск…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-52"
            />
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="min-w-[160px]"
            >
              <option value="">Все разделы</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4">
              <LoadingBlock compact label="Загрузка сметы…" />
              <SkeletonLines rows={4} />
            </div>
          ) : grouped.length === 0 ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-muted">
                Смета пуста. Нажмите «Заполнить смету» — подставятся разделы как в вашем образце.
              </p>
              <Button disabled={seeding} onClick={() => void handleSeedDetailed()}>
                {seeding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Заполнить смету
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([section, rows]) => {
                const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);
                return (
                  <section
                    key={section}
                    className="overflow-hidden rounded-[16px] border border-line"
                  >
                    <div className="flex items-center justify-between gap-3 bg-green px-4 py-3 text-white">
                      <h4 className="font-semibold uppercase tracking-wide">{section}</h4>
                      <span className="text-sm font-semibold tabular-nums">
                        {money(sectionTotal)}
                      </span>
                    </div>
                    <div className="hidden grid-cols-[minmax(0,1.6fr)_52px_72px_88px_100px_72px] gap-2 bg-cream/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid">
                      <span>Позиция</span>
                      <span>Ед.</span>
                      <span className="text-right">Кол-во</span>
                      <span className="text-right">Цена</span>
                      <span className="text-right">Стоимость</span>
                      <span />
                    </div>
                    <ul>
                      {rows.map((exp, idx) => (
                        <li
                          key={exp.id}
                          className={idx % 2 === 1 ? "bg-surface/70" : "bg-white"}
                        >
                          {editingId === exp.id ? (
                            <div className="space-y-2 px-3 py-3 sm:px-4">
                              <div className="grid gap-2 sm:grid-cols-3">
                                <Input
                                  type="date"
                                  value={edit.date}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, date: e.target.value }))
                                  }
                                />
                                <Select
                                  value={edit.category}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, category: e.target.value }))
                                  }
                                >
                                  {allCategories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </Select>
                                <Input
                                  value={edit.subcategory}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, subcategory: e.target.value }))
                                  }
                                  placeholder="Позиция"
                                />
                                <Input
                                  value={edit.unit}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, unit: e.target.value }))
                                  }
                                  placeholder="Ед."
                                />
                                <Input
                                  value={edit.quantity}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, quantity: e.target.value }))
                                  }
                                  placeholder="Кол-во"
                                />
                                <Input
                                  value={edit.unit_price}
                                  onChange={(e) =>
                                    setEdit((v) => ({ ...v, unit_price: e.target.value }))
                                  }
                                  placeholder="Цена"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => void saveEdit(exp.id)}
                                >
                                  Сохранить
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setEditingId(null)}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-3 py-3 sm:px-4">
                              <div className="space-y-1 sm:hidden">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium text-ink">{itemLabel(exp)}</p>
                                    <p className="text-caption text-muted">
                                      {exp.kind
                                        ? SMETA_KIND_LABELS[exp.kind as SmetaItemKind] ||
                                          exp.kind
                                        : null}
                                      {exp.unit ? ` · ${exp.unit}` : ""}
                                      {exp.quantity != null ? ` · ${exp.quantity}` : ""}
                                      {exp.unit_price != null
                                        ? ` × ${Number(exp.unit_price).toLocaleString("ru-RU")} ₽`
                                        : ""}
                                    </p>
                                  </div>
                                  <p className="shrink-0 font-semibold tabular-nums">
                                    {money(Number(exp.amount))}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="rounded-[8px] p-2 text-muted hover:bg-page hover:text-ink"
                                    onClick={() => startEdit(exp)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-[8px] p-2 text-muted hover:bg-red-50 hover:text-red-600"
                                    onClick={() => void removeRow(exp.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="hidden grid-cols-[minmax(0,1.6fr)_52px_72px_88px_100px_72px] items-center gap-2 sm:grid">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-ink">
                                    {itemLabel(exp)}
                                  </p>
                                  {exp.kind ? (
                                    <p className="text-[11px] text-muted">
                                      {SMETA_KIND_LABELS[exp.kind as SmetaItemKind] || exp.kind}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="text-sm text-muted">{exp.unit || "—"}</span>
                                <span className="text-right text-sm tabular-nums">
                                  {exp.quantity != null
                                    ? Number(exp.quantity).toLocaleString("ru-RU")
                                    : "—"}
                                </span>
                                <span className="text-right text-sm tabular-nums text-muted">
                                  {exp.unit_price != null
                                    ? Number(exp.unit_price).toLocaleString("ru-RU")
                                    : "—"}
                                </span>
                                <span className="text-right text-sm font-semibold tabular-nums">
                                  {money(Number(exp.amount))}
                                </span>
                                <div className="flex justify-end gap-0.5">
                                  <button
                                    type="button"
                                    className="rounded-[8px] p-1.5 text-muted hover:bg-page hover:text-ink"
                                    onClick={() => startEdit(exp)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-[8px] p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                                    onClick={() => void removeRow(exp.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-3 border-t border-line bg-[#FFF4EC] px-4 py-2.5">
                      <span className="text-sm font-semibold text-ink">Итого {section}</span>
                      <span className="text-sm font-bold tabular-nums text-ink">
                        {money(sectionTotal)}
                      </span>
                    </div>
                  </section>
                );
              })}

              <div className="flex items-center justify-between gap-3 rounded-[16px] bg-green px-4 py-4 text-white">
                <div>
                  <p className="font-semibold">Общая сумма по смете</p>
                  <p className="text-sm text-white/75">По всем разделам</p>
                </div>
                <p className="text-xl font-bold tabular-nums">
                  {money(data?.total_spent || 0)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
