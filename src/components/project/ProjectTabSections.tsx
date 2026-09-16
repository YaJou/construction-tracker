"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatActivityDetails } from "@/lib/format";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  SMETA_KIND_LABELS,
  lineAmount,
  smetaItemsForSection,
  type SmetaItemKind,
} from "@/lib/smetaTemplates";
import { downloadSmetaPdf } from "@/lib/smetaPdf";
import { ClipboardList, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { EXPENSE_CATEGORIES, LEGACY_EXPENSE_CATEGORIES } from "@/lib/constants";

export { ProjectPhotosSection } from "./ProjectPhotosSection";

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
  error?: string;
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
      // keep category/subcategory for quick repeated entry
      load();
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdding(false);
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

  const allCategories = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...LEGACY_EXPENSE_CATEGORIES]);
    for (const e of data?.expenses || []) set.add(e.category);
    return [...set];
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
    list.sort((a, b) => a.category.localeCompare(b.category, "ru") || itemLabel(a).localeCompare(itemLabel(b), "ru"));
    return list;
  }, [data, search, filterCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    for (const e of filtered) {
      const list = map.get(e.category) || [];
      list.push(e);
      map.set(e.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <ClipboardList className="h-5 w-5 text-orange" />
              Смета / расходы
            </h2>
            <p className="mt-1 text-sm text-muted">
              Раздел → позиция → количество и цена. Сумма считается автоматически.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-[12px] bg-cream px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted">Итого</p>
              <p className="font-bold tabular-nums text-ink">{money(data?.total_spent || 0)}</p>
            </div>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs text-muted">Дата</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Раздел (категория)</label>
              <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Позиция (подкатегория)</label>
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
              <label className="mb-1 block text-xs text-muted">Сумма</label>
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
                Добавить в смету
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
                Потрачено: <strong className="text-ink">{money(data.total_spent)}</strong>
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
          <h3 className="font-semibold text-ink">Позиции сметы</h3>
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
            <p className="py-8 text-center text-muted">Загрузка…</p>
          ) : grouped.length === 0 ? (
            <p className="py-8 text-center text-muted">
              Пока пусто. Добавьте, например, «Фундамент → Бетон М250».
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([section, rows]) => {
                const sectionTotal = rows.reduce((s, r) => s + Number(r.amount), 0);
                return (
                  <section key={section}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="font-semibold uppercase tracking-wide text-green">{section}</h4>
                      <span className="text-sm font-medium tabular-nums">{money(sectionTotal)}</span>
                    </div>
                    <ul className="divide-y divide-line rounded-[12px] border border-line overflow-hidden">
                      {rows.map((exp) => (
                        <li key={exp.id} className="bg-white px-3 py-3 sm:px-4">
                          {editingId === exp.id ? (
                            <div className="space-y-2">
                              <div className="grid gap-2 sm:grid-cols-3">
                                <Input
                                  type="date"
                                  value={edit.date}
                                  onChange={(e) => setEdit((v) => ({ ...v, date: e.target.value }))}
                                />
                                <Select
                                  value={edit.category}
                                  onChange={(e) => setEdit((v) => ({ ...v, category: e.target.value }))}
                                >
                                  {allCategories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </Select>
                                <Input
                                  value={edit.subcategory}
                                  onChange={(e) => setEdit((v) => ({ ...v, subcategory: e.target.value }))}
                                  placeholder="Позиция"
                                />
                                <Input
                                  value={edit.quantity}
                                  onChange={(e) => setEdit((v) => ({ ...v, quantity: e.target.value }))}
                                  placeholder="Кол-во"
                                  inputMode="decimal"
                                />
                                <Input
                                  value={edit.unit_price}
                                  onChange={(e) => setEdit((v) => ({ ...v, unit_price: e.target.value }))}
                                  placeholder="Цена"
                                  inputMode="decimal"
                                />
                                <Input
                                  value={edit.unit}
                                  onChange={(e) => setEdit((v) => ({ ...v, unit: e.target.value }))}
                                  placeholder="Ед."
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={saving}
                                  onClick={async () => {
                                    setSaving(true);
                                    const res = await fetch(`/api/projects/${projectId}/expenses`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        expenseId: exp.id,
                                        date: edit.date,
                                        category: edit.category,
                                        subcategory: edit.subcategory,
                                        quantity: edit.quantity || null,
                                        unit_price: edit.unit_price || null,
                                        unit: edit.unit || null,
                                        kind: edit.kind || null,
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
                                  }}
                                >
                                  Сохранить
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-ink">{itemLabel(exp)}</p>
                                <p className="text-sm text-muted">
                                  {format(new Date(exp.date), "d MMM yyyy", { locale: ru })}
                                  {exp.kind
                                    ? ` · ${SMETA_KIND_LABELS[exp.kind as SmetaItemKind] || exp.kind}`
                                    : ""}
                                  {exp.quantity != null && exp.unit_price != null
                                    ? ` · ${exp.quantity} ${exp.unit || "ед."} × ${Number(exp.unit_price).toLocaleString("ru-RU")} ₽`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="mr-2 font-semibold tabular-nums">{money(exp.amount)}</span>
                                <button
                                  type="button"
                                  className="rounded-[10px] p-2 text-muted hover:bg-surface hover:text-ink"
                                  onClick={() => {
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
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-[10px] p-2 text-muted hover:bg-surface hover:text-red-600"
                                  onClick={async () => {
                                    if (!confirm("Удалить позицию?")) return;
                                    await fetch(`/api/projects/${projectId}/expenses`, {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ expenseId: exp.id }),
                                    });
                                    load();
                                    refetch();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectActivitySection({ projectId }: { projectId: number }) {
  const [log, setLog] = useState<
    { action_type: string; details: string | null; user_name: string | null; created_at: string }[]
  >([]);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/activity`)
      .then((r) => r.json())
      .then(setLog);
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-ink">Журнал действий</h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {log.map((entry, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 text-ink-subtle">
                {format(new Date(entry.created_at), "d MMM, HH:mm", { locale: ru })}
              </span>
              <span className="text-ink-muted">
                {formatActivityDetails(entry.details) || entry.action_type}
              </span>
              {entry.user_name && <span className="text-ink-subtle">— {entry.user_name}</span>}
            </li>
          ))}
        </ul>
        {log.length === 0 && <p className="text-sm text-ink-muted">Пока нет записей</p>}
      </CardContent>
    </Card>
  );
}
