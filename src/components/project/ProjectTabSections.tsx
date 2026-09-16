"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatThousands, parseFormattedNumber, formatActivityDetails } from "@/lib/format";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export { ProjectPhotosSection } from "./ProjectPhotosSection";

export function ProjectExpensesSection({
  projectId,
  reloadKey,
  expenseDate,
  setExpenseDate,
  expenseCategory,
  setExpenseCategory,
  expenseDesc,
  setExpenseDesc,
  expenseAmount,
  setExpenseAmount,
  handleAddExpense,
  addingExpense,
  refetch,
}: {
  projectId: number;
  reloadKey: number;
  expenseDate: string;
  setExpenseDate: (v: string) => void;
  expenseCategory: string;
  setExpenseCategory: (v: string) => void;
  expenseDesc: string;
  setExpenseDesc: (v: string) => void;
  expenseAmount: string;
  setExpenseAmount: (v: string) => void;
  handleAddExpense: () => void;
  addingExpense: boolean;
  refetch: () => void;
}) {
  const [data, setData] = useState<{
    expenses: { id: number; date: string; category: string; description: string | null; amount: number }[];
    total_spent: number;
    budget: number;
    budget_remaining: number;
  } | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("");
  const [expenseSort, setExpenseSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "category">("date_desc");

  const loadExpenses = () => {
    fetch(`/api/projects/${projectId}/expenses`)
      .then((r) => r.json())
      .then(setData);
  };

  useEffect(() => {
    loadExpenses();
  }, [projectId, reloadKey]);

  const filteredAndSortedExpenses = data
    ? (() => {
        let list = [...data.expenses];
        const q = expenseSearch.trim().toLowerCase();
        const amountQuery = expenseSearch.trim().replace(/\s/g, "");
        if (q) {
          list = list.filter(
            (e) =>
              e.category.toLowerCase().includes(q) ||
              (e.description || "").toLowerCase().includes(q) ||
              (amountQuery && String(e.amount).includes(amountQuery))
          );
        }
        if (expenseFilterCategory) {
          list = list.filter((e) => e.category === expenseFilterCategory);
        }
        if (expenseSort === "date_desc") list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        else if (expenseSort === "date_asc") list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        else if (expenseSort === "amount_desc") list.sort((a, b) => b.amount - a.amount);
        else if (expenseSort === "amount_asc") list.sort((a, b) => a.amount - b.amount);
        else if (expenseSort === "category") list.sort((a, b) => a.category.localeCompare(b.category));
        return list;
      })()
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <h2 className="font-semibold text-ink">Учёт расходов</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
            className="w-full sm:w-36"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Описание"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            className="w-full sm:w-48"
          />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Сумма"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(formatThousands(e.target.value))}
            className="w-full sm:w-28"
          />
          <Button onClick={handleAddExpense} disabled={addingExpense || !expenseAmount} size="lg">
            {addingExpense ? <Loader2 className="w-5 h-5 animate-spin" /> : "Добавить"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data && (
          <>
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <span>Бюджет: <strong>{data.budget.toLocaleString("ru-RU")} ₽</strong></span>
              <span>Потрачено: <strong>{data.total_spent.toLocaleString("ru-RU")} ₽</strong></span>
              <span className={data.budget_remaining < 0 ? "text-red-600" : ""}>
                Остаток: <strong>{data.budget_remaining.toLocaleString("ru-RU")} ₽</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Input
                type="search"
                placeholder="Поиск по категории, описанию, сумме..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full sm:w-64 max-w-full"
              />
              <Select
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                className="min-w-[140px] w-full sm:w-auto"
                aria-label="Категория расхода"
              >
                <option value="">Все категории</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select
                value={expenseSort}
                onChange={(e) => setExpenseSort(e.target.value as typeof expenseSort)}
                className="min-w-[160px] w-full sm:w-auto"
                aria-label="Сортировка расходов"
              >
                <option value="date_desc">Дата: сначала новые</option>
                <option value="date_asc">Дата: сначала старые</option>
                <option value="amount_desc">Сумма: по убыванию</option>
                <option value="amount_asc">Сумма: по возрастанию</option>
                <option value="category">По категории</option>
              </Select>
            </div>
            <ul className="divide-y divide-border">
              {filteredAndSortedExpenses.map((exp, i) => (
                <li key={exp.id ?? i} className="py-3 flex flex-col gap-3">
                  {editingExpenseId === exp.id ? (
                    <>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-xs text-ink-muted mb-0.5">Дата</label>
                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full sm:w-40" />
                        </div>
                        <div>
                          <label className="block text-xs text-ink-muted mb-0.5">Категория</label>
                          <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full sm:w-36">
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs text-ink-muted mb-0.5">Описание</label>
                          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Описание" className="w-full" />
                        </div>
                        <div>
                          <label className="block text-xs text-ink-muted mb-0.5">Сумма</label>
                          <Input type="text" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(formatThousands(e.target.value))} className="w-full sm:w-28" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={savingExpense}
                          onClick={async () => {
                            const amountNum = parseFormattedNumber(editAmount);
                            if (!editDate || !editCategory || !amountNum) return;
                            setSavingExpense(true);
                            await fetch(`/api/projects/${projectId}/expenses`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                expenseId: exp.id,
                                date: editDate,
                                category: editCategory,
                                description: editDesc.trim() || null,
                                amount: amountNum,
                              }),
                            });
                            setSavingExpense(false);
                            setEditingExpenseId(null);
                            loadExpenses();
                          }}
                        >
                          {savingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Сохранить
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingExpenseId(null)} disabled={savingExpense}>
                          Отмена
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center gap-3 flex-wrap">
                      <div>
                        <p className="font-medium">{exp.category} — {exp.description || "—"}</p>
                        <p className="text-sm text-ink-muted">
                          {format(new Date(exp.date), "d MMM yyyy", { locale: ru })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap">
                          {exp.amount.toLocaleString("ru-RU")} ₽
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpenseId(exp.id);
                            setEditDate(exp.date);
                            setEditCategory(exp.category);
                            setEditDesc(exp.description || "");
                            setEditAmount(formatThousands(String(exp.amount)));
                          }}
                          className="inline-flex items-center gap-1 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted"
                          title="Редактировать"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-ink-subtle hover:text-red-600"
                          onClick={async () => {
                            const confirmed = window.confirm("Удалить этот расход?");
                            if (!confirmed) return;
                            await fetch(`/api/projects/${projectId}/expenses`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ expenseId: exp.id }),
                            });
                            loadExpenses();
                          }}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {data.expenses.length > 0 && filteredAndSortedExpenses.length === 0 && (
              <p className="text-center text-ink-muted py-4 text-sm">Ничего не найдено. Измените поиск или фильтр.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectActivitySection({ projectId }: { projectId: number }) {
  const [log, setLog] = useState<{ action_type: string; details: string | null; user_name: string | null; created_at: string }[]>([]);
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
              <span className="text-ink-subtle shrink-0">
                {format(new Date(entry.created_at), "d MMM, HH:mm", { locale: ru })}
              </span>
              <span className="text-ink-muted">{formatActivityDetails(entry.details) || entry.action_type}</span>
              {entry.user_name && (
                <span className="text-ink-subtle">— {entry.user_name}</span>
              )}
            </li>
          ))}
        </ul>
        {log.length === 0 && <p className="text-ink-muted text-sm">Пока нет записей</p>}
      </CardContent>
    </Card>
  );
}
