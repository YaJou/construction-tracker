"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "@/lib/constants";

interface ReportData {
  project: {
    name: string;
    client: string;
    address: string;
    start_date: string | null;
    planned_end_date: string | null;
    status: string;
    budget: number;
    manager: string | null;
    progress_percent: number;
  };
  stages: { name: string; status: string; progress_percent: number; comment: string | null }[];
  expenses: { date: string; category: string; description: string | null; amount: number }[];
  total_spent: number;
  budget: number;
  budget_remaining: number;
  generated_at: string;
}

export default function ReportPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reports/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ошибка"))))
      .then(setData)
      .catch(() => setError("Не удалось загрузить отчёт"));
  }, [id]);

  useEffect(() => {
    if (isPrint && data) {
      const t = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isPrint, data]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-ink-muted">Загрузка…</div>;

  const { project, stages, expenses, total_spent, budget, budget_remaining, generated_at } = data;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white text-ink print:p-6">
      <div className="no-print mb-6">
        <a href="/reports" className="text-sm text-ink-muted hover:text-ink">
          ← К списку отчётов
        </a>
      </div>

      <header className="border-b border-gray-200 pb-6 mb-6">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-gray-600 mt-1">Отчёт сформирован: {format(new Date(generated_at), "d MMMM yyyy, HH:mm", { locale: ru })}</p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Информация об объекте</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-1 text-gray-600 w-40">Клиент</td><td>{project.client}</td></tr>
            <tr><td className="py-1 text-gray-600">Адрес</td><td>{project.address}</td></tr>
            <tr><td className="py-1 text-gray-600">Статус</td><td>{PROJECT_STATUS_LABELS[project.status] || project.status}</td></tr>
            <tr><td className="py-1 text-gray-600">Ответственный</td><td>{project.manager || "—"}</td></tr>
            <tr><td className="py-1 text-gray-600">Дата начала</td><td>{project.start_date ? format(new Date(project.start_date), "d MMM yyyy", { locale: ru }) : "—"}</td></tr>
            <tr><td className="py-1 text-gray-600">Планируемая сдача</td><td>{project.planned_end_date ? format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru }) : "—"}</td></tr>
            <tr><td className="py-1 text-gray-600">Прогресс</td><td>{project.progress_percent}%</td></tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Этапы строительства</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium">Этап</th>
              <th className="text-left py-2 font-medium">Статус</th>
              <th className="text-right py-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">{s.name}</td>
                <td className="py-2">{STAGE_STATUS_LABELS[s.status] || s.status}</td>
                <td className="py-2 text-right">{s.progress_percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Финансы</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-1 text-gray-600">Бюджет</td><td className="text-right font-medium">{budget.toLocaleString("ru-RU")} ₽</td></tr>
            <tr><td className="py-1 text-gray-600">Потрачено</td><td className="text-right">{total_spent.toLocaleString("ru-RU")} ₽</td></tr>
            <tr><td className="py-1 text-gray-600">Остаток</td><td className={`text-right font-medium ${budget_remaining >= 0 ? "" : "text-red-600"}`}>{budget_remaining.toLocaleString("ru-RU")} ₽</td></tr>
          </tbody>
        </table>
        {expenses.length > 0 && (
          <>
            <h3 className="text-sm font-medium mt-4 mb-2">Расходы</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 font-medium">Дата</th>
                  <th className="text-left py-1 font-medium">Категория</th>
                  <th className="text-left py-1 font-medium">Описание</th>
                  <th className="text-right py-1 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 30).map((e, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">{format(new Date(e.date), "d.MM.yyyy", { locale: ru })}</td>
                    <td className="py-1">{e.category}</td>
                    <td className="py-1">{e.description || "—"}</td>
                    <td className="py-1 text-right">{e.amount.toLocaleString("ru-RU")} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length > 30 && <p className="text-sm text-gray-500 mt-2">… и ещё {expenses.length - 30} записей</p>}
          </>
        )}
      </section>

      <footer className="text-sm text-gray-500 pt-6 border-t border-gray-200">
        СтройУчёт — учёт строительства. Сформировано {format(new Date(generated_at), "d.MM.yyyy HH:mm", { locale: ru })}.
      </footer>
    </div>
  );
}
