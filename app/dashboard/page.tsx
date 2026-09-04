"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { Search, Plus, ChevronRight, Calendar, MapPin, User } from "lucide-react";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

function formatLastActivity(project: {
  last_activity_at?: string | null;
  today_photos_count?: number;
}) {
  const count = project.today_photos_count ?? 0;
  if (count > 0) {
    return { text: `Сегодня добавлено ${count} фото`, isStale: false };
  }
  const at = project.last_activity_at;
  if (!at) return { text: "Нет активности", isStale: true };
  const date = new Date(at);
  const now = new Date();
  const days = differenceInCalendarDays(now, date);
  if (days >= 7) {
    return {
      text: `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"} нет активности`,
      isStale: true,
    };
  }
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: ru });
  return { text: relative.charAt(0).toUpperCase() + relative.slice(1), isStale: false };
}

function getDelayStatus(project: {
  planned_end_date: string | null;
  status: string;
}) {
  if (!project.planned_end_date) return { color: "", label: "" };
  const today = new Date();
  const planned = new Date(project.planned_end_date);
  const diff = differenceInCalendarDays(today, planned);

  if (diff <= 0) {
    return { color: "bg-emerald-500", label: "всё по плану" };
  }
  if (diff > 0 && diff <= 7) {
    return { color: "bg-amber-400", label: "задержка < 7 дней" };
  }
  return { color: "bg-red-500", label: "серьёзная задержка" };
}

const LIST_TABS: { value: "active" | "completed" | "archived"; label: string }[] = [
  { value: "active", label: "Активные" },
  { value: "completed", label: "Завершенные" },
  { value: "archived", label: "Архив" },
];

export default function DashboardPage() {
  const [listType, setListType] = useState<"active" | "completed" | "archived">("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [foremanFilter, setForemanFilter] = useState("");
  const pathname = usePathname();
  const { projects, filterOptions, loading, error, refetch } = useProjects(
    listType,
    statusFilter,
    search,
    managerFilter,
    clientFilter,
    cityFilter,
    foremanFilter
  );
  const [sortBy, setSortBy] = useState("updated");
  const [todayData, setTodayData] = useState<{
    projects: { id: number; name: string; highlights: string[] }[];
  } | null>(null);

  const loadToday = useCallback(() => {
    fetch(`/api/activity/today?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((data) => setTodayData(data))
      .catch(() => setTodayData(null));
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday, pathname]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        refetch();
        loadToday();
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch, loadToday]);

  const [previewPhoto, setPreviewPhoto] = useState<{
    src: string;
    projectName: string;
    comment: string | null;
  } | null>(null);

  const sortedProjects = (() => {
    const list = [...projects];
    const byProgress = (a: { progress_percent: number }, b: { progress_percent: number }) =>
      b.progress_percent - a.progress_percent;
    const byDeadline = (
      a: { planned_end_date: string | null },
      b: { planned_end_date: string | null }
    ) => {
      const da = a.planned_end_date ? new Date(a.planned_end_date).getTime() : Infinity;
      const db = b.planned_end_date ? new Date(b.planned_end_date).getTime() : Infinity;
      return da - db;
    };
    const byActivity = (
      a: { last_activity_at?: string | null },
      b: { last_activity_at?: string | null }
    ) => {
      const da = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const db = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return db - da;
    };
    const byBudget = (a: { budget: number }, b: { budget: number }) => b.budget - a.budget;

    if (sortBy === "progress") list.sort(byProgress);
    else if (sortBy === "deadline") list.sort(byDeadline);
    else if (sortBy === "activity") list.sort(byActivity);
    else if (sortBy === "budget") list.sort(byBudget);
    return list;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Дашборд</h1>
          <p className="text-ink-muted mt-0.5">Объекты и прогресс строительства</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#segodnya"
            className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            Сегодня
          </a>
          <Link href="/projects/new">
            <Button size="lg" className="touch-target w-full sm:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Новый объект
            </Button>
          </Link>
        </div>
      </div>

      <section id="segodnya" className="scroll-mt-4">
        {todayData && todayData.projects && todayData.projects.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-3">
              <h2 className="text-sm font-semibold text-ink mb-2">Сегодня</h2>
              <ul className="space-y-0.5">
                {todayData.projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 py-1 rounded hover:bg-surface-muted -mx-1 px-1 text-sm transition-colors"
                    >
                      <span className="font-medium text-ink truncate">{p.name}</span>
                      <span className="text-xs text-ink-muted shrink-0">
                        {p.highlights.join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {LIST_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setListType(tab.value)}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors touch-target ${
              listType === tab.value
                ? "bg-ink text-white"
                : "bg-white border border-border text-ink-muted hover:bg-surface-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-subtle" />
          <Input
            placeholder="Поиск по названию, клиенту, адресу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[160px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Все статусы</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[160px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Ответственный</option>
          {filterOptions.managers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={foremanFilter}
          onChange={(e) => setForemanFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[140px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Прораб</option>
          {filterOptions.responsibles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[140px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Клиент</option>
          {filterOptions.clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[140px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Город</option>
          {filterOptions.cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink min-w-[180px] focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="updated">По обновлению</option>
          <option value="progress">По прогрессу</option>
          <option value="deadline">По сроку сдачи</option>
          <option value="activity">По последней активности</option>
          <option value="budget">По бюджету</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-3">
                <div className="h-5 bg-surface-muted rounded w-3/4" />
                <div className="h-4 bg-surface-muted rounded w-1/2" />
                <div className="h-2 bg-surface-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => {
            const delay = getDelayStatus(project);
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md cursor-pointer relative overflow-hidden">
                  {delay.color && (
                    <div className={`h-1 w-full ${delay.color}`} title={delay.label} />
                  )}
                  <CardContent className="p-5 space-y-4">
                  {project.preview_photos && project.preview_photos.length > 0 && (
                    <div className="flex gap-2 -mt-1 mb-1">
                      {project.preview_photos.slice(0, 2).map((photo, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewPhoto({
                              src: photo.file_path,
                              projectName: project.name,
                              comment: photo.comment ?? null,
                            });
                          }}
                          className="w-20 h-16 rounded-md overflow-hidden bg-surface-muted flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ink/30"
                        >
                          {photo.file_path.startsWith("/placeholder") ? (
                            <div className="w-full h-full flex items-center justify-center text-ink-subtle text-xl">
                              📷
                            </div>
                          ) : (
                            <img
                              src={photo.file_path}
                              alt={photo.comment || "Фото объекта"}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <h2 className="font-semibold text-ink line-clamp-2">{project.name}</h2>
                    <ChevronRight className="w-5 h-5 text-ink-subtle shrink-0 mt-0.5" />
                  </div>
                  <div className="space-y-1.5 text-sm text-ink-muted">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">{project.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 shrink-0" />
                      <span>{project.client}</span>
                    </div>
                    {project.planned_end_date && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const planned = new Date(project.planned_end_date);
                      planned.setHours(0, 0, 0, 0);
                      const diffDays = Math.round((planned.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                      const dayWord = (n: number) => {
                        const abs = Math.abs(n);
                        if (abs % 10 === 1 && abs % 100 !== 11) return "день";
                        if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return "дня";
                        return "дней";
                      };
                      const daysText = diffDays > 0
                        ? `осталось ${diffDays} ${dayWord(diffDays)}`
                        : diffDays < 0
                          ? `просрочка ${Math.abs(diffDays)} ${dayWord(diffDays)}`
                          : "сдача сегодня";
                      return (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>
                            Сдача: {format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })}
                            {" "}({daysText})
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <Progress value={project.progress_percent} showLabel />
                  {(() => {
                    const activity = formatLastActivity(project);
                    return (
                      <div className="text-xs text-ink-muted">
                        <span className="font-medium text-ink-subtle">Последняя активность: </span>
                        <span
                          className={
                            activity.isStale ? "text-amber-600 font-medium" : ""
                          }
                        >
                          {activity.text}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {project.total_spent != null &&
                      project.budget != null &&
                      project.total_spent > project.budget && (
                        <span
                          className="text-amber-600"
                          title="Перерасход бюджета"
                        >
                          ⚠ перерасход бюджета
                        </span>
                      )}
                    {delay.label &&
                      (delay.label === "задержка < 7 дней" ||
                        delay.label === "серьёзная задержка") && (
                      <span
                        className="text-amber-600"
                        title="Задержка этапа"
                      >
                        ⏳ задержка этапа
                      </span>
                    )}
                    {(!project.preview_photos || project.preview_photos.length === 0) && (
                      <span
                        className="text-ink-muted"
                        title="Нет фото"
                      >
                        📷 нет фото
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          project.status === "completed"
                            ? "success"
                            : project.status === "construction"
                              ? "default"
                              : "muted"
                        }
                      >
                        {PROJECT_STATUS_LABELS[project.status] || project.status}
                      </Badge>
                      {project.active_stages > 0 && (
                        <span className="text-xs text-ink-muted">
                          Активных этапов: {project.active_stages}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(`/reports/${project.id}?print=1`, "_blank");
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
                    >
                      📄 Отчёт
                    </button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );})}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-ink-muted">
            <p className="font-medium">Нет объектов</p>
            <p className="text-sm mt-1">Добавьте первый объект или измените фильтры</p>
          </CardContent>
        </Card>
      )}

      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm text-ink-muted truncate">
                {previewPhoto.projectName}
              </span>
              <button
                className="text-ink-muted hover:text-ink text-sm"
                onClick={() => setPreviewPhoto(null)}
              >
                Закрыть
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-black flex items-center justify-center">
              {previewPhoto.src.startsWith("/placeholder") ? (
                <div className="w-full h-full flex items-center justify-center text-white text-6xl">
                  📷
                </div>
              ) : (
                <img
                  src={previewPhoto.src}
                  alt={previewPhoto.comment || "Фото объекта"}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted flex-1 min-w-0 truncate">
                {previewPhoto.comment || "Без описания"}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPreviewPhoto(null)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
