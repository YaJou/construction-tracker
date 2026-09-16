"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";

type SmetaItem = {
  id: number;
  name: string;
  unit: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  kind: string;
  note: string | null;
};

type SmetaSection = {
  id: number;
  name: string;
  items: SmetaItem[];
  section_total: number;
};

type SmetaData = {
  sections: SmetaSection[];
  total: number;
  templates: { name: string; items_count: number }[];
  error?: string;
  code?: string;
};

function money(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

function formatNum(n: number | null) {
  if (n == null || Number.isNaN(n)) return "";
  return String(n);
}

const KIND_LABEL: Record<string, string> = {
  material: "Материал",
  labor: "Работа",
  other: "Прочее",
};

export function ProjectSmetaSection({ projectId }: { projectId: number }) {
  const [data, setData] = useState<SmetaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [drafts, setDrafts] = useState<
    Record<number, { quantity: string; unit_price: string; note: string }>
  >({});

  const applyData = useCallback((next: SmetaData) => {
    setData(next);
    const map: Record<number, { quantity: string; unit_price: string; note: string }> = {};
    for (const section of next.sections || []) {
      for (const item of section.items) {
        map[item.id] = {
          quantity: formatNum(item.quantity),
          unit_price: formatNum(item.unit_price),
          note: item.note || "",
        };
      }
    }
    setDrafts(map);
    setSelectedTemplate((prev) => {
      const used = new Set((next.sections || []).map((s) => s.name.toLowerCase()));
      const available = (next.templates || []).filter((t) => !used.has(t.name.toLowerCase()));
      if (prev && available.some((t) => t.name === prev)) return prev;
      return available[0]?.name || "";
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/smeta`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Не удалось загрузить смету");
        setData(json.code === "SMETA_TABLES_MISSING" ? json : null);
        return;
      }
      applyData(json);
    } catch {
      setError("Не удалось загрузить смету");
    } finally {
      setLoading(false);
    }
  }, [projectId, applyData]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/smeta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Ошибка");
        if (json.code === "SMETA_TABLES_MISSING" || json.code === "SMETA_RLS") {
          setData(json);
        }
        return;
      }
      applyData(json);
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (itemId: number) => {
    const draft = drafts[itemId];
    if (!draft) return;
    await post({
      action: "update_item",
      itemId,
      quantity: draft.quantity.trim() === "" ? null : Number(draft.quantity.replace(",", ".")),
      unit_price:
        draft.unit_price.trim() === "" ? null : Number(draft.unit_price.replace(",", ".")),
      note: draft.note.trim() || null,
    });
  };

  const usedNames = new Set((data?.sections || []).map((s) => s.name.toLowerCase()));
  const availableTemplates = (data?.templates || []).filter(
    (t) => !usedNames.has(t.name.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка сметы…
      </div>
    );
  }

  if (data?.code === "SMETA_TABLES_MISSING" || data?.code === "SMETA_RLS" || error.includes("Таблицы сметы") || error.includes("RLS")) {
    return (
      <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-semibold">Нужно открыть запись сметы в Supabase</p>
        <p className="mt-2 text-amber-900/90">
          Скопируйте и выполните в SQL Editor:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-[10px] bg-white/80 p-3 text-[11px] leading-relaxed text-ink">
{`alter table public.project_smeta_sections disable row level security;
alter table public.project_smeta_items disable row level security;
grant all on table public.project_smeta_sections to anon, authenticated, service_role;
grant all on table public.project_smeta_items to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;`}
        </pre>
        <p className="mt-2 text-xs text-amber-900/80">{error}</p>
        <Button className="mt-4" size="sm" variant="secondary" onClick={() => void load()}>
          Проверить снова
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,63,52,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <ClipboardList className="h-5 w-5 text-orange" />
              Смета объекта
            </h2>
            <p className="mt-1 text-sm text-muted">
              Добавьте раздел — материалы и работы подтянутся сами. Потом правьте количество и цены.
            </p>
          </div>
          <div className="rounded-[12px] bg-cream px-4 py-2 text-right">
            <p className="text-caption uppercase tracking-wider text-muted">Итого</p>
            <p className="text-lg font-bold tabular-nums text-ink">{money(data?.total || 0)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full sm:min-w-[200px] sm:flex-1"
            disabled={busy || availableTemplates.length === 0}
          >
            {availableTemplates.length === 0 ? (
              <option value="">Все разделы уже добавлены</option>
            ) : (
              availableTemplates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.items_count} поз.)
                </option>
              ))
            )}
          </Select>
          <Button
            size="sm"
            disabled={busy || !selectedTemplate || availableTemplates.length === 0}
            onClick={() => void post({ action: "add_section", templateName: selectedTemplate })}
            className="min-h-10"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Добавить раздел
          </Button>
          {(data?.sections.length ?? 0) === 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void post({ action: "add_all_templates" })}
              className="min-h-10"
            >
              Заполнить всю смету
            </Button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {(data?.sections.length ?? 0) === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line bg-surface px-5 py-10 text-center">
          <p className="font-medium text-ink">Смета пока пустая</p>
          <p className="mt-1 text-sm text-muted">
            Например: добавьте «Фундамент» — появятся бетон, арматура, опалубка и работа.
          </p>
        </div>
      ) : (
        data!.sections.map((section) => (
          <section
            key={section.id}
            className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_8px_24px_rgba(23,63,52,0.06)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/60 px-4 py-3 sm:px-5">
              <div>
                <h3 className="font-semibold uppercase tracking-wide text-green">{section.name}</h3>
                <p className="text-caption text-muted">
                  {section.items.length} поз. · {money(section.section_total)}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white hover:text-red-600"
                title="Удалить раздел"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Удалить раздел «${section.name}» и все позиции?`)) {
                    void post({ action: "delete_section", sectionId: section.id });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-caption text-muted">
                    <th className="px-4 py-2 font-medium sm:px-5">Позиция</th>
                    <th className="px-2 py-2 font-medium">Ед.</th>
                    <th className="px-2 py-2 font-medium">Кол-во</th>
                    <th className="px-2 py-2 font-medium">Цена, ₽</th>
                    <th className="px-2 py-2 font-medium text-right">Стоимость</th>
                    <th className="px-2 py-2 font-medium">Примечание</th>
                    <th className="px-4 py-2 sm:px-5" />
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, idx) => {
                    const draft = drafts[item.id] || {
                      quantity: "",
                      unit_price: "",
                      note: "",
                    };
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b border-line/70",
                          idx % 2 === 1 ? "bg-[#F3F8FF]/40" : "bg-white"
                        )}
                      >
                        <td className="px-4 py-2.5 sm:px-5">
                          <p className="font-medium text-ink">{item.name}</p>
                          <p className="text-[11px] text-muted">{KIND_LABEL[item.kind] || item.kind}</p>
                        </td>
                        <td className="px-2 py-2.5 text-muted">{item.unit}</td>
                        <td className="px-2 py-2.5">
                          <Input
                            value={draft.quantity}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [item.id]: { ...draft, quantity: e.target.value },
                              }))
                            }
                            onBlur={() => void saveItem(item.id)}
                            className="h-9 w-24"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <Input
                            value={draft.unit_price}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [item.id]: { ...draft, unit_price: e.target.value },
                              }))
                            }
                            onBlur={() => void saveItem(item.id)}
                            className="h-9 w-28"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-right font-medium tabular-nums text-ink">
                          {item.amount > 0 ? money(item.amount) : "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <Input
                            value={draft.note}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [item.id]: { ...draft, note: e.target.value },
                              }))
                            }
                            onBlur={() => void saveItem(item.id)}
                            className="h-9 min-w-[120px]"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <button
                            type="button"
                            className="text-muted hover:text-red-600"
                            disabled={busy}
                            onClick={() => void post({ action: "delete_item", itemId: item.id })}
                            aria-label="Удалить позицию"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {section.items.map((item) => {
                const draft = drafts[item.id] || {
                  quantity: "",
                  unit_price: "",
                  note: "",
                };
                return (
                  <li key={item.id} className="space-y-2.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{item.name}</p>
                        <p className="text-[11px] text-muted">
                          {KIND_LABEL[item.kind] || item.kind} · {item.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-muted hover:text-red-600"
                        disabled={busy}
                        onClick={() => void post({ action: "delete_item", itemId: item.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted">Кол-во</label>
                        <Input
                          value={draft.quantity}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [item.id]: { ...draft, quantity: e.target.value },
                            }))
                          }
                          onBlur={() => void saveItem(item.id)}
                          className="h-10"
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted">Цена, ₽</label>
                        <Input
                          value={draft.unit_price}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [item.id]: { ...draft, unit_price: e.target.value },
                            }))
                          }
                          onBlur={() => void saveItem(item.id)}
                          className="h-10"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Стоимость</span>
                      <span className="font-semibold tabular-nums">
                        {item.amount > 0 ? money(item.amount) : "—"}
                      </span>
                    </div>
                    <Input
                      value={draft.note}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [item.id]: { ...draft, note: e.target.value },
                        }))
                      }
                      onBlur={() => void saveItem(item.id)}
                      className="h-10"
                      placeholder="Примечание"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
