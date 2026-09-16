"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/utils/cn";
import {
  projectStatusLabel,
  stageStatusLabel,
  useStatusLabels,
} from "@/hooks/useStatusLabels";
import { downloadProjectReportPdf } from "@/lib/projectReportPdf";

interface ReportPhoto {
  id: number;
  file_path: string;
  comment: string | null;
  created_at: string;
  stage_id: number | null;
  uploaded_by?: string | null;
}

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
    foreman?: string | null;
    progress_percent: number;
    note?: string | null;
  };
  stages: {
    id: number;
    name: string;
    status: string;
    progress_percent: number;
    comment: string | null;
    start_date?: string | null;
    end_date?: string | null;
    responsible?: string | null;
  }[];
  photos: ReportPhoto[];
  expenses: { date: string; category: string; description: string | null; amount: number }[];
  total_spent: number;
  budget: number;
  budget_remaining: number;
  generated_at: string;
}

type ReportMode = "full" | "client";

export default function ReportPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { project: projectLabels, stage: stageLabels } = useStatusLabels();
  const id = Number(params.id);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPrint = searchParams.get("print") === "1";
  const initialMode = (searchParams.get("mode") === "client" ? "client" : "full") as ReportMode;
  const [mode, setMode] = useState<ReportMode>(initialMode);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reports/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ошибка"))))
      .then(setData)
      .catch(() => setError("Не удалось загрузить отчёт"));
  }, [id]);

  useEffect(() => {
    if (!isPrint || !data) return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [isPrint, data, mode]);

  const handleDownloadPdf = async () => {
    if (!data || savingPdf) return;
    setSavingPdf(true);
    setPdfError("");
    try {
      await downloadProjectReportPdf(data, mode);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Ошибка создания PDF");
    } finally {
      setSavingPdf(false);
    }
  };

  const stageNameById = useMemo(() => {
    const map = new Map<number, string>();
    data?.stages.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [data]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data?.expenses ?? []) {
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-ink-muted">Загрузка…</div>;

  const { project, stages, expenses, photos, total_spent, budget, budget_remaining, generated_at } =
    data;
  const isClient = mode === "client";
  const photosToShow = (photos ?? [])
    .filter((p) => p.file_path && !p.file_path.startsWith("/placeholder"))
    .slice(-12)
    .reverse();
  const comments = stages.filter((s) => s.comment?.trim());

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white text-ink print:p-6">
      <div className="no-print mb-6 space-y-3">
        <a href="/reports" className="text-sm text-muted hover:text-ink">
          ← К списку отчётов
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Режим:</span>
          {(
            [
              ["full", "Полный отчёт"],
              ["client", "Короткий для клиента"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "h-[42px] px-3 rounded-[10px] text-sm font-medium border transition-colors",
                mode === value
                  ? "bg-green text-white border-green"
                  : "bg-white text-ink border-line hover:bg-surface"
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={savingPdf}
            className="ml-auto h-[42px] px-4 rounded-[10px] bg-orange text-white text-sm font-medium disabled:opacity-60"
          >
            {savingPdf ? "Создаю PDF…" : "Скачать PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-[42px] px-4 rounded-[10px] border border-line bg-white text-ink text-sm font-medium hover:bg-surface"
          >
            Печать
          </button>
        </div>
        {pdfError && <p className="text-sm text-red-600">{pdfError}</p>}
        <p className="text-caption text-muted">
          Файл PDF скачается на устройство. На iPhone может открыться в новой вкладке — сохраните через «Поделиться».
        </p>
      </div>

      <header className="border-b border-line pb-6 mb-6">
        <p className="text-caption font-semibold uppercase tracking-wider text-orange">СтройУчёт</p>
        <h1 className="text-2xl font-semibold text-ink mt-1">{project.name}</h1>
        <p className="text-muted mt-1">
          {isClient ? "Отчёт для клиента" : "Полный отчёт по объекту"} ·{" "}
          {format(new Date(generated_at), "d MMMM yyyy, HH:mm", { locale: ru })}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-green">Информация об объекте</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-muted w-44">Клиент</td>
              <td>{project.client}</td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Адрес</td>
              <td>{project.address}</td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Статус</td>
              <td>{projectStatusLabel(projectLabels, project.status)}</td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Ответственный</td>
              <td>{project.manager || "—"}</td>
            </tr>
            {!isClient && (
              <tr>
                <td className="py-1 text-muted">Прораб</td>
                <td>{project.foreman || "—"}</td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-muted">Период работ</td>
              <td>
                {project.start_date
                  ? format(new Date(project.start_date), "d MMM yyyy", { locale: ru })
                  : "—"}
                {" — "}
                {project.planned_end_date
                  ? format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })
                  : "—"}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Прогресс</td>
              <td className="font-semibold">{project.progress_percent}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-green">Этапы строительства</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left py-2 font-medium">Этап</th>
              <th className="text-left py-2 font-medium">Статус</th>
              {!isClient && <th className="text-left py-2 font-medium">Сроки</th>}
              <th className="text-right py-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.id} className="border-b border-line/60">
                <td className="py-2">{s.name}</td>
                <td className="py-2">{stageStatusLabel(stageLabels, s.status)}</td>
                {!isClient && (
                  <td className="py-2 text-muted">
                    {s.start_date
                      ? format(new Date(s.start_date), "d.MM.yy", { locale: ru })
                      : "—"}
                    {" / "}
                    {s.end_date
                      ? format(new Date(s.end_date), "d.MM.yy", { locale: ru })
                      : "—"}
                  </td>
                )}
                <td className="py-2 text-right">{s.progress_percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-green">Финансы</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-muted">Бюджет</td>
              <td className="text-right font-medium">{budget.toLocaleString("ru-RU")} ₽</td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Потрачено</td>
              <td className="text-right">{total_spent.toLocaleString("ru-RU")} ₽</td>
            </tr>
            <tr>
              <td className="py-1 text-muted">Остаток</td>
              <td
                className={`text-right font-medium ${budget_remaining >= 0 ? "" : "text-red-600"}`}
              >
                {budget_remaining.toLocaleString("ru-RU")} ₽
              </td>
            </tr>
          </tbody>
        </table>

        {expensesByCategory.length > 0 && (
          <>
            <h3 className="text-sm font-medium mt-4 mb-2">По категориям</h3>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {expensesByCategory.map(([cat, sum]) => (
                  <tr key={cat} className="border-b border-line/60">
                    <td className="py-1">{cat}</td>
                    <td className="py-1 text-right">{sum.toLocaleString("ru-RU")} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!isClient && expenses.length > 0 && (
          <>
            <h3 className="text-sm font-medium mt-4 mb-2">Расходы</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-1 font-medium">Дата</th>
                  <th className="text-left py-1 font-medium">Категория</th>
                  <th className="text-left py-1 font-medium">Описание</th>
                  <th className="text-right py-1 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 40).map((e, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-1">{format(new Date(e.date), "d.MM.yyyy", { locale: ru })}</td>
                    <td className="py-1">{e.category}</td>
                    <td className="py-1">{e.description || "—"}</td>
                    <td className="py-1 text-right">{e.amount.toLocaleString("ru-RU")} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length > 40 && (
              <p className="text-sm text-muted mt-2">… и ещё {expenses.length - 40} записей</p>
            )}
          </>
        )}
      </section>

      {photosToShow.length > 0 && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-3 text-green">
            {isClient ? "Фото прогресса" : "Фотографии"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {photosToShow.slice(0, isClient ? 6 : 12).map((photo) => (
              <figure key={photo.id} className="rounded-[12px] overflow-hidden border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.file_path}
                  alt={photo.comment || "Фото объекта"}
                  className="w-full h-36 object-cover"
                />
                <figcaption className="px-2.5 py-2 text-caption text-muted">
                  <span className="block text-ink">
                    {photo.stage_id ? stageNameById.get(photo.stage_id) || "Этап" : "Без этапа"}
                  </span>
                  {photo.comment && <span className="block truncate">{photo.comment}</span>}
                  <span>
                    {format(new Date(photo.created_at), "d MMM yyyy", { locale: ru })}
                    {photo.uploaded_by ? ` · ${photo.uploaded_by}` : ""}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {!isClient && comments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-green">Комментарии по этапам</h2>
          <ul className="space-y-2 text-sm">
            {comments.map((s) => (
              <li key={s.id} className="rounded-[10px] border border-line px-3 py-2">
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-muted mt-0.5">{s.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.note && !isClient && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2 text-green">Заметка</h2>
          <p className="text-sm text-ink whitespace-pre-wrap">{project.note}</p>
        </section>
      )}

      <footer className="text-sm text-muted pt-6 border-t border-line">
        СтройУчёт · {isClient ? "клиентский" : "полный"} отчёт ·{" "}
        {format(new Date(generated_at), "d.MM.yyyy HH:mm", { locale: ru })}
        {project.manager ? ` · подготовил: ${project.manager}` : ""}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
