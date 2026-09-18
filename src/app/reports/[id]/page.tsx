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
import { LoadingBlock } from "@/components/ui/Loading";
import { downloadProjectReportPdf } from "@/lib/projectReportPdf";
import { useAuth } from "@/components/auth/AuthProvider";

interface ReportPhoto {
  id: number;
  file_path: string;
  comment: string | null;
  created_at: string;
  stage_id: number | null;
  uploaded_by?: string | null;
}

interface ReportStage {
  id: number;
  name: string;
  status: string;
  progress_percent: number;
  comment: string | null;
  start_date?: string | null;
  end_date?: string | null;
  responsible?: string | null;
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
    completed_stages?: number;
    total_stages?: number;
    note?: string | null;
    object_type?: string | null;
    area_sqm?: number | null;
    phone?: string | null;
  };
  stages: ReportStage[];
  photos: ReportPhoto[];
  expenses: { date: string; category: string; description: string | null; amount: number }[];
  total_spent: number;
  budget: number;
  has_budget?: boolean;
  budget_remaining: number | null;
  generated_at: string;
  author_name?: string;
}

type ReportMode = "full" | "client";

export default function ReportPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { displayName } = useAuth();
  const { project: projectLabels, stage: stageLabels } = useStatusLabels();
  const id = Number(params.id);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPrint = searchParams.get("print") === "1";
  const initialMode = (searchParams.get("mode") === "client" ? "client" : "full") as ReportMode;
  const [mode, setMode] = useState<ReportMode>(initialMode);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);

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
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, [isPrint, data, mode]);

  const handleDownloadPdf = async () => {
    if (!data || savingPdf) return;
    setSavingPdf(true);
    setPdfError("");
    try {
      const result = await downloadProjectReportPdf(data, {
        mode,
        authorName: displayName || data.author_name,
      });
      if (result.warnings.length) {
        setPdfError(`PDF сохранён. Внимание: ${result.warnings.join("; ")}`);
      }
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
  if (!data) return <LoadingBlock label="Загрузка отчёта…" />;

  const { project, stages, expenses, photos, total_spent, budget, budget_remaining, generated_at } =
    data;
  const hasBudget = data.has_budget ?? budget > 0;
  const isClient = mode === "client";
  const completed =
    project.completed_stages ?? stages.filter((s) => s.status === "completed").length;
  const totalStages = project.total_stages ?? stages.length;
  const activeStages = stages.filter((s) => s.status === "in_progress");
  const photosToShow = isClient
    ? []
    : (photos ?? []).filter((p) => p.file_path && !p.file_path.startsWith("/placeholder"));
  const comments = stages.filter((s) => s.comment?.trim());
  const author = displayName || data.author_name || project.manager || "Пользователь";

  return (
    <div className="report-root mx-auto max-w-3xl bg-white p-8 text-ink print:max-w-none print:p-0">
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
            Печать / сохранить PDF
          </button>
        </div>
        {pdfError && <p className="text-sm text-red-600">{pdfError}</p>}
        {photoErrors.length > 0 && (
          <p className="text-sm text-amber-800">Не загрузились фото: {photoErrors.join(", ")}</p>
        )}
        <p className="text-caption text-muted">
          «Скачать PDF» сохраняет фирменный файл. В диалоге печати браузера отключите колонтитулы
          URL/даты (Параметры → Колонтитулы), иначе они продублируются.
        </p>
      </div>

      <div className="report-sheet">
        <header className="mb-6 border-b border-[#E1E9E5] pb-5">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-semibold text-[#FF7A1A]">СтройУчёт</p>
            <p className="text-right text-xs text-[#61736C]">
              {isClient ? "Отчёт для клиента" : "Полный отчёт"} · Объект
            </p>
          </div>
          <div className="mt-1 h-0.5 w-full bg-[#FF7A1A]/80" />
          <h1 className="mt-4 text-[26px] font-bold leading-tight text-[#17201D]">{project.name}</h1>
          <p className="mt-2 whitespace-pre-wrap text-[15px] text-[#61736C]">
            {project.address || "Адрес не указан"}
          </p>
          <p className="mt-3 inline-flex rounded-full bg-[#F5F8F6] px-3 py-1 text-sm font-medium text-[#173F34]">
            {projectStatusLabel(projectLabels, project.status)}
          </p>
        </header>

        <section className="mb-6 break-inside-avoid rounded-[10px] bg-[#173F34] px-5 py-4 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-bold tabular-nums">{project.progress_percent}%</p>
              <p className="text-sm text-white/80">готово</p>
            </div>
            <div className="min-w-[200px] flex-1">
              <p className="text-sm">
                Завершено этапов: {completed} из {totalStages}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/70">Текущие работы</p>
              {activeStages.length === 0 ? (
                <p className="text-sm">
                  {project.progress_percent >= 100 ? "Все этапы завершены" : "Нет этапов в работе"}
                </p>
              ) : (
                <ul className="text-sm">
                  {activeStages.map((s) => (
                    <li key={s.id}>• {s.name}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/20">
                <div
                  className="h-full bg-[#FF7A1A]"
                  style={{ width: `${Math.min(100, project.progress_percent)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-[#173F34]">Данные объекта</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="w-44 py-1 text-[#61736C]">Клиент</td>
                <td>{project.client}</td>
              </tr>
              <tr>
                <td className="py-1 text-[#61736C]">Ответственный</td>
                <td>{project.manager || "—"}</td>
              </tr>
              {!isClient && (
                <tr>
                  <td className="py-1 text-[#61736C]">Прораб</td>
                  <td>{project.foreman || "—"}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 text-[#61736C]">Период строительства</td>
                <td>
                  {project.start_date
                    ? format(new Date(project.start_date), "d MMM yyyy", { locale: ru })
                    : "Не указана"}
                  {" — "}
                  {project.planned_end_date
                    ? format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })
                    : "Не указана"}
                </td>
              </tr>
              {!isClient && project.object_type && (
                <tr>
                  <td className="py-1 text-[#61736C]">Тип объекта</td>
                  <td>{project.object_type}</td>
                </tr>
              )}
              {!isClient && project.area_sqm != null && (
                <tr>
                  <td className="py-1 text-[#61736C]">Площадь</td>
                  <td>{project.area_sqm} м²</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-[#173F34]">Этапы строительства</h2>
          <table className="report-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F8F6] text-left text-[#61736C]">
                <th className="px-2 py-2 font-medium">№</th>
                <th className="px-2 py-2 font-medium">Этап</th>
                <th className="px-2 py-2 font-medium">Статус</th>
                {!isClient && <th className="px-2 py-2 font-medium">Начат</th>}
                {!isClient && <th className="px-2 py-2 font-medium">Завершён</th>}
                <th className="px-2 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={s.id} className="border-b border-[#E1E9E5]">
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2">{s.name}</td>
                  <td className="px-2 py-2">{stageStatusLabel(stageLabels, s.status)}</td>
                  {!isClient && (
                    <td className="px-2 py-2 text-[#61736C]">
                      {s.start_date
                        ? format(new Date(s.start_date), "d.MM.yy", { locale: ru })
                        : "Не указана"}
                    </td>
                  )}
                  {!isClient && (
                    <td className="px-2 py-2 text-[#61736C]">
                      {s.end_date
                        ? format(new Date(s.end_date), "d.MM.yy", { locale: ru })
                        : "Не указана"}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right tabular-nums">{s.progress_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={cn("mb-8", !isClient && "print:break-before-page")}>
          <h2 className="mb-3 text-base font-semibold text-[#173F34]">Финансы</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[10px] border border-[#E1E9E5] bg-[#F5F8F6] px-3 py-3">
              <p className="text-xs text-[#61736C]">Бюджет</p>
              <p className="font-semibold">
                {hasBudget ? `${budget.toLocaleString("ru-RU")} ₽` : "Не задан"}
              </p>
            </div>
            <div className="rounded-[10px] border border-[#E1E9E5] bg-[#F5F8F6] px-3 py-3">
              <p className="text-xs text-[#61736C]">Потрачено</p>
              <p className="font-semibold">{total_spent.toLocaleString("ru-RU")} ₽</p>
            </div>
            <div className="rounded-[10px] border border-[#E1E9E5] bg-[#F5F8F6] px-3 py-3">
              <p className="text-xs text-[#61736C]">Остаток</p>
              <p
                className={cn(
                  "font-semibold",
                  budget_remaining != null && budget_remaining < 0 && "text-red-600"
                )}
              >
                {budget_remaining == null ? "—" : `${budget_remaining.toLocaleString("ru-RU")} ₽`}
              </p>
            </div>
          </div>

          {hasBudget && (
            <p className="mb-4 text-sm text-[#61736C]">
              Использовано{" "}
              <span className="font-medium text-ink">
                {((total_spent / budget) * 100).toFixed(1).replace(".", ",")}%
              </span>{" "}
              бюджета
              {total_spent > budget && (
                <span className="text-red-600">
                  {" "}
                  · превышение {(total_spent - budget).toLocaleString("ru-RU")} ₽
                </span>
              )}
            </p>
          )}

          {expensesByCategory.length > 0 && total_spent > 0 && (
            <>
              <h3 className="mb-1 text-sm font-medium">Категории расходов</h3>
              <p className="mb-2 text-xs text-[#61736C]">Доли категорий считаются от суммы расходов</p>
              <ul className="mb-4 space-y-2 text-sm">
                {expensesByCategory.map(([cat, sum]) => (
                  <li key={cat}>
                    <div className="flex justify-between gap-2">
                      <span>{cat}</span>
                      <span>
                        {sum.toLocaleString("ru-RU")} ₽ ·{" "}
                        {((sum / total_spent) * 100).toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#E1E9E5]">
                      <div
                        className="h-full bg-[#173F34]"
                        style={{ width: `${(sum / total_spent) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!isClient && expenses.length > 0 && (
            <>
              <h3 className="mb-2 text-sm font-medium">Расходы</h3>
              <table className="report-table w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F5F8F6] text-left text-[#61736C]">
                    <th className="px-2 py-1 font-medium">Дата</th>
                    <th className="px-2 py-1 font-medium">Описание</th>
                    <th className="px-2 py-1 font-medium">Категория</th>
                    <th className="px-2 py-1 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={i} className="border-b border-[#E1E9E5]">
                      <td className="whitespace-nowrap px-2 py-1">
                        {format(new Date(e.date), "d.MM.yyyy", { locale: ru })}
                      </td>
                      <td className="px-2 py-1">{e.description || "—"}</td>
                      <td className="px-2 py-1">{e.category}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {e.amount.toLocaleString("ru-RU")} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-right text-sm font-semibold">
                Итого: {total_spent.toLocaleString("ru-RU")} ₽
              </p>
            </>
          )}
        </section>

        {photosToShow.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-[#173F34]">Фотографии</h2>
            <div className="grid grid-cols-2 gap-3">
              {photosToShow.map((photo) => (
                <figure
                  key={photo.id}
                  className="break-inside-avoid overflow-hidden rounded-[10px] border border-[#E1E9E5]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.file_path}
                    alt={photo.comment || "Фото объекта"}
                    className="h-40 w-full bg-[#F5F8F6] object-contain"
                    onError={() =>
                      setPhotoErrors((prev) =>
                        prev.includes(`#${photo.id}`) ? prev : [...prev, `#${photo.id}`]
                      )
                    }
                  />
                  <figcaption className="px-2.5 py-2 text-xs text-[#61736C]">
                    <span className="block text-[#17201D]">
                      {photo.stage_id ? stageNameById.get(photo.stage_id) || "Этап" : "Без этапа"}
                    </span>
                    {photo.comment && <span className="block">{photo.comment}</span>}
                    <span>{format(new Date(photo.created_at), "d MMM yyyy", { locale: ru })}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {!isClient && comments.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-[#173F34]">Комментарии по этапам</h2>
            <ul className="space-y-2 text-sm">
              {comments.map((s) => (
                <li
                  key={s.id}
                  className="break-inside-avoid rounded-[10px] border border-[#E1E9E5] px-3 py-2"
                >
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-0.5 text-[#61736C]">{s.comment}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {project.note && !isClient && (
          <section className="mb-8">
            <h2 className="mb-2 text-base font-semibold text-[#173F34]">Заметка</h2>
            <p className="whitespace-pre-wrap text-sm text-ink">{project.note}</p>
          </section>
        )}

        <footer className="border-t border-[#E1E9E5] pt-4 text-xs text-[#61736C]">
          {author} · {format(new Date(generated_at), "d MMMM yyyy, HH:mm", { locale: ru })}
        </footer>
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 13mm 13mm 20mm 13mm;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .report-table thead {
            display: table-header-group;
          }
          .report-table tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
