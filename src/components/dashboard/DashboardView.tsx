"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useProjects,
  type ProjectListItem,
} from "@/hooks/useProjects";
import { Select } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
import { projectStatusLabel, useStatusLabels } from "@/hooks/useStatusLabels";
import {
  Plus,
  Search,
  Building2,
  CalendarClock,
  Wallet,
  CheckCircle2,
  Camera,
  FileText,
  LayoutGrid,
  List,
  ChevronRight,
  MoreHorizontal,
  MapPin,
  AlertTriangle,
  SlidersHorizontal,
  X,
  Home,
} from "lucide-react";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

type Period = "today" | "7d" | "30d";
type ViewMode = "cards" | "list";
type ListType = "active" | "completed" | "archived";

const LIST_TABS: { value: ListType; label: string }[] = [
  { value: "active", label: "Активные" },
  { value: "completed", label: "Завершенные" },
  { value: "archived", label: "Архив" },
];

/** Demo cards only when NEXT_PUBLIC_DEMO_MODE=true — never mixed into production by default. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_PROJECTS: ProjectListItem[] = DEMO_MODE
  ? [
      {
        id: -1,
        name: "Дом 87 м²",
        client: "Иванов А.П.",
        address: "СНТ Малинки, уч. 14",
        start_date: null,
        planned_end_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
        status: "construction",
        budget: 6500000,
        manager: "Петров С.И.",
        progress_percent: 65,
        active_stages: 1,
        total_stages: 10,
        completed_stages: 4,
        updated_at: new Date().toISOString(),
        preview_photos: [],
        last_activity_at: new Date().toISOString(),
        last_activity_summary: "Добавлено фото",
        today_photos_count: 2,
        total_spent: 420000,
      },
    ]
  : [];

function formatMoney(n: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₽`;
}

function dayWord(n: number) {
  const abs = Math.abs(n);
  if (abs % 10 === 1 && abs % 100 !== 11) return "день";
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return "дня";
  return "дней";
}

function needsAttention(p: ProjectListItem) {
  const overdue =
    p.planned_end_date &&
    p.status !== "completed" &&
    differenceInCalendarDays(new Date(), new Date(p.planned_end_date)) > 0;
  const overBudget =
    p.budget > 0 && (p.total_spent ?? 0) > p.budget;
  const stalePhotos =
    (!p.preview_photos || p.preview_photos.length === 0) ||
    (p.last_activity_at &&
      differenceInCalendarDays(new Date(), new Date(p.last_activity_at)) >= 7);
  return Boolean(overdue || overBudget || stalePhotos || p.status === "paused");
}

function statusBarClass(p: ProjectListItem) {
  if (p.status === "completed") return "bg-[#9AA6A1]";
  if (needsAttention(p)) return "bg-orange";
  return "bg-green";
}

export default function DashboardPage() {
  const pathname = usePathname();
  const { project: statusLabels } = useStatusLabels();
  const [listType, setListType] = useState<ListType>("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [foremanFilter, setForemanFilter] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [period, setPeriod] = useState<Period>("today");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{
    src: string;
    projectName: string;
    comment: string | null;
  } | null>(null);
  const [kpiProjects, setKpiProjects] = useState<ProjectListItem[]>([]);
  const [periodStats, setPeriodStats] = useState<{
    spent_in_period: number;
    completed_stages_this_month: number;
    budget: number;
  } | null>(null);
  const [todayData, setTodayData] = useState<{
    projects: { id: number; name: string; highlights: string[] }[];
  } | null>(null);

  const { projects, filterOptions, loading, error, refetch } = useProjects(
    listType,
    statusFilter,
    search,
    managerFilter,
    clientFilter,
    cityFilter,
    foremanFilter
  );

  const loadToday = useCallback(() => {
    fetch(`/api/activity/today?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((data) => setTodayData(data))
      .catch(() => setTodayData(null));
  }, []);

  const loadKpi = useCallback(() => {
    fetch(`/api/projects?list=active&_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((json) => setKpiProjects(json.projects ?? []))
      .catch(() => setKpiProjects([]));
  }, []);

  const loadPeriodStats = useCallback(() => {
    fetch(`/api/dashboard/kpi?period=${period}&_t=${Date.now()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((json) =>
        setPeriodStats({
          spent_in_period: Number(json.spent_in_period) || 0,
          completed_stages_this_month: Number(json.completed_stages_this_month) || 0,
          budget: Number(json.budget) || 0,
        })
      )
      .catch(() => setPeriodStats(null));
  }, [period]);

  useEffect(() => {
    loadToday();
    loadKpi();
  }, [loadToday, loadKpi, pathname]);

  useEffect(() => {
    loadPeriodStats();
  }, [loadPeriodStats, pathname]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        refetch();
        loadToday();
        loadKpi();
        loadPeriodStats();
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch, loadToday, loadKpi, loadPeriodStats]);

  useEffect(() => {
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const sortedProjects = useMemo(() => {
    const list = [...projects];
    if (sortBy === "progress") {
      list.sort((a, b) => b.progress_percent - a.progress_percent);
    } else if (sortBy === "deadline") {
      list.sort((a, b) => {
        const da = a.planned_end_date ? new Date(a.planned_end_date).getTime() : Infinity;
        const db = b.planned_end_date ? new Date(b.planned_end_date).getTime() : Infinity;
        return da - db;
      });
    } else if (sortBy === "activity") {
      list.sort((a, b) => {
        const da = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const db = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return db - da;
      });
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
    return list;
  }, [projects, sortBy]);

  const displayProjects = useMemo(() => {
    if (loading) return [];
    if (!DEMO_MODE || sortedProjects.length === 0 || sortedProjects.length >= 3) {
      return sortedProjects;
    }
    const pad = DEMO_PROJECTS.filter(
      (d) => !sortedProjects.some((p) => p.name === d.name)
    ).slice(0, 3 - sortedProjects.length);
    return [...sortedProjects, ...pad];
  }, [loading, sortedProjects]);

  const periodDays = period === "today" ? 0 : period === "7d" ? 7 : 30;

  const kpi = useMemo(() => {
    const source = kpiProjects;
    const activeCount = source.length;
    const nearest = [...source]
      .filter((p) => p.planned_end_date && p.status !== "completed")
      .sort(
        (a, b) =>
          new Date(a.planned_end_date!).getTime() -
          new Date(b.planned_end_date!).getTime()
      )[0];
    const spent = periodStats?.spent_in_period ?? 0;
    const budget = periodStats?.budget ?? source.reduce((s, p) => s + (p.budget ?? 0), 0);
    const completedThisMonth = periodStats?.completed_stages_this_month ?? 0;
    return { activeCount, nearest, spent, budget, completedThisMonth };
  }, [kpiProjects, periodStats]);

  const attentionItems = useMemo(() => {
    const items: {
      id: string;
      tone: string;
      title: string;
      meta: string;
      href: string;
    }[] = [];
    for (const p of kpiProjects) {
      if (items.length >= 4) break;
      if (
        p.planned_end_date &&
        p.status !== "completed" &&
        differenceInCalendarDays(new Date(), new Date(p.planned_end_date)) > 0
      ) {
        items.push({
          id: `overdue-${p.id}`,
          tone: "bg-red-500",
          title: p.name,
          meta: "Просроченный срок сдачи",
          href: `/projects/${p.id}`,
        });
      }
    }
    for (const p of kpiProjects) {
      if (items.length >= 4) break;
      if (!p.planned_end_date || p.status === "completed") continue;
      const days = differenceInCalendarDays(new Date(p.planned_end_date), new Date());
      if (days >= 0 && days <= 3) {
        items.push({
          id: `soon-${p.id}`,
          tone: "bg-orange",
          title: p.name,
          meta: days === 0 ? "Срок сегодня" : `Срок через ${days} ${dayWord(days)}`,
          href: `/projects/${p.id}`,
        });
      }
    }
    for (const p of kpiProjects) {
      if (items.length >= 4) break;
      if (p.budget > 0 && (p.total_spent ?? 0) > p.budget) {
        items.push({
          id: `budget-${p.id}`,
          tone: "bg-amber-500",
          title: p.name,
          meta: "Расход выше плана",
          href: `/projects/${p.id}`,
        });
      }
    }
    for (const p of kpiProjects) {
      if (items.length >= 4) break;
      const noPhotos = !p.preview_photos || p.preview_photos.length === 0;
      const stale =
        p.last_activity_at &&
        differenceInCalendarDays(new Date(), new Date(p.last_activity_at)) >= 7;
      if (noPhotos || stale) {
        items.push({
          id: `photo-${p.id}`,
          tone: "bg-[#9AA6A1]",
          title: p.name,
          meta: "Нет фотоотчёта за неделю",
          href: `/projects/${p.id}`,
        });
      }
    }
    return items.slice(0, 4);
  }, [kpiProjects]);

  const activityFeed = useMemo(() => {
    const fromToday =
      todayData?.projects?.flatMap((p) =>
        p.highlights.map((h, i) => ({
          id: `${p.id}-${i}`,
          name: p.name,
          text: h,
          href: `/projects/${p.id}`,
          at: new Date().toISOString(),
        }))
      ) ?? [];

    if (period === "today" && fromToday.length > 0) return fromToday.slice(0, 8);

    const fromProjects = [...kpiProjects]
      .filter((p) => p.last_activity_at && p.last_activity_summary)
      .filter((p) => {
        if (period === "today") {
          return differenceInCalendarDays(new Date(), new Date(p.last_activity_at!)) === 0;
        }
        return (
          differenceInCalendarDays(new Date(), new Date(p.last_activity_at!)) <= periodDays
        );
      })
      .sort(
        (a, b) =>
          new Date(b.last_activity_at!).getTime() -
          new Date(a.last_activity_at!).getTime()
      )
      .map((p) => ({
        id: `act-${p.id}`,
        name: p.name,
        text: p.last_activity_summary || "Обновление",
        href: `/projects/${p.id}`,
        at: p.last_activity_at!,
      }));

    return (fromToday.length && period === "today" ? fromToday : fromProjects).slice(0, 8);
  }, [todayData, kpiProjects, period, periodDays]);

  const nearestDeadlines = useMemo(() => {
    return [...kpiProjects]
      .filter((p) => p.planned_end_date && p.status !== "completed")
      .sort(
        (a, b) =>
          new Date(a.planned_end_date!).getTime() -
          new Date(b.planned_end_date!).getTime()
      )
      .slice(0, 5);
  }, [kpiProjects]);

  const activeChips = [
    managerFilter && { key: "manager", label: managerFilter },
    foremanFilter && { key: "foreman", label: foremanFilter },
    clientFilter && { key: "client", label: clientFilter },
    cityFilter && { key: "city", label: cityFilter },
    statusFilter && {
      key: "status",
      label: projectStatusLabel(statusLabels, statusFilter),
    },
  ].filter(Boolean) as { key: string; label: string }[];

  const clearChip = (key: string) => {
    if (key === "manager") setManagerFilter("");
    if (key === "foreman") setForemanFilter("");
    if (key === "client") setClientFilter("");
    if (key === "city") setCityFilter("");
    if (key === "status") setStatusFilter("");
  };

  async function archiveProject(id: number) {
    if (id < 0) return;
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    refetch();
    loadKpi();
  }

  const firstPhotoHref =
    kpiProjects[0] ? `/projects/${kpiProjects[0].id}` : "/projects/new";

  const filterPanel = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        value={managerFilter}
        onChange={(e) => setManagerFilter(e.target.value)}
        aria-label="Ответственный"
      >
        <option value="">Ответственный</option>
        {filterOptions.managers.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
      <Select
        value={foremanFilter}
        onChange={(e) => setForemanFilter(e.target.value)}
        aria-label="Прораб"
      >
        <option value="">Прораб</option>
        {filterOptions.responsibles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Select
        value={clientFilter}
        onChange={(e) => setClientFilter(e.target.value)}
        aria-label="Клиент"
      >
        <option value="">Клиент</option>
        {filterOptions.clients.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Select
        value={cityFilter}
        onChange={(e) => setCityFilter(e.target.value)}
        aria-label="Город"
      >
        <option value="">Город</option>
        {filterOptions.cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        aria-label="Статус"
      >
        <option value="">Все статусы</option>
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="sm:col-span-2 lg:col-span-1"
        aria-label="Сортировка"
      >
        <option value="updated">По обновлению</option>
        <option value="deadline">По сроку</option>
        <option value="progress">По прогрессу</option>
        <option value="activity">По активности</option>
      </Select>
    </div>
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-ink">
            Дашборд
          </h1>
          <p className="text-sm text-muted mt-1">
            Контроль объектов и прогресса строительства
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div
            className="inline-flex rounded-[10px] border border-line bg-white p-1"
            role="group"
            aria-label="Период"
          >
            {(
              [
                ["today", "Сегодня"],
                ["7d", "7 дней"],
                ["30d", "30 дней"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={cn(
                  "h-[34px] px-3 rounded-[8px] text-sm font-medium transition-colors duration-fast",
                  period === value
                    ? "bg-cream text-green"
                    : "text-muted hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Link
            href="/projects/new"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-orange px-4 text-sm font-semibold text-white hover:bg-orange/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Новый объект
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/projects/new"
          className="inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-page transition-colors"
        >
          <Building2 className="w-4 h-4 text-orange" aria-hidden />
          Добавить объект
        </Link>
        <Link
          href={firstPhotoHref}
          className="inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-page transition-colors"
        >
          <Camera className="w-4 h-4 text-orange" aria-hidden />
          Загрузить фото
        </Link>
        <Link
          href="/reports"
          className="inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-page transition-colors"
        >
          <FileText className="w-4 h-4 text-orange" aria-hidden />
          Создать отчёт
        </Link>
      </div>

      {/* KPI */}
      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
        {[
          {
            icon: Building2,
            label: "Активные объекты",
            value: String(kpi.activeCount),
            hint: "в работе",
          },
          {
            icon: CheckCircle2,
            label: "Готово в этом месяце",
            value: periodStats ? String(kpi.completedThisMonth) : "…",
            hint: "завершённых этапов",
          },
          {
            icon: CalendarClock,
            label: "Ближайший срок",
            value: kpi.nearest?.planned_end_date
              ? format(new Date(kpi.nearest.planned_end_date), "d MMM", { locale: ru })
              : "нет данных",
            hint: kpi.nearest?.name ?? "нет объектов со сроком",
          },
          {
            icon: Wallet,
            label: "Расходы за период",
            value: periodStats ? formatMoney(kpi.spent) : "…",
            hint:
              kpi.budget > 0
                ? `план ${formatMoney(kpi.budget)} · ${period === "today" ? "сегодня" : period === "7d" ? "7 дней" : "30 дней"}`
                : period === "today"
                  ? "сегодня"
                  : period === "7d"
                    ? "за 7 дней"
                    : "за 30 дней",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="min-w-[220px] md:min-w-0 rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-caption text-muted">{item.label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface text-green">
                <item.icon className="w-4 h-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-ink tracking-tight">
              {item.value}
            </p>
            <p className="mt-1 text-caption text-muted line-clamp-1">{item.hint}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <section className="rounded-[18px] border border-line bg-white p-4 md:p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)] space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти объект или адрес"
              className="w-full h-[42px] rounded-[10px] border border-line bg-page pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {LIST_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setListType(tab.value)}
                className={cn(
                  "h-[42px] shrink-0 px-4 rounded-[10px] text-sm font-semibold transition-colors",
                  listType === tab.value
                    ? "bg-green text-white"
                    : "border border-line bg-white text-muted hover:text-ink"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="md:hidden inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-sm font-medium text-ink"
              onClick={() => setFiltersOpen(true)}
              aria-label="Открыть фильтры"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {activeChips.length > 0 && (
                <span className="rounded-full bg-cream text-orange text-caption px-1.5">
                  {activeChips.length}
                </span>
              )}
            </button>
            <div
              className="hidden sm:inline-flex rounded-[10px] border border-line p-1 bg-page"
              role="group"
              aria-label="Вид"
            >
              <button
                type="button"
                aria-label="Карточки"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-[34px] w-[34px] inline-flex items-center justify-center rounded-[8px]",
                  viewMode === "cards" ? "bg-white text-green shadow-soft" : "text-muted"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Список"
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-[34px] w-[34px] inline-flex items-center justify-center rounded-[8px]",
                  viewMode === "list" ? "bg-white text-green shadow-soft" : "text-muted"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:block">{filterPanel}</div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearChip(chip.key)}
                className="inline-flex items-center gap-1.5 rounded-full bg-cream text-green px-2.5 py-1 text-caption font-medium"
              >
                {chip.label}
                <X className="w-3 h-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Mobile filters drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Закрыть фильтры"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 rounded-t-[24px] bg-white p-5 space-y-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">Фильтры</p>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setFiltersOpen(false)}
                className="p-2 rounded-[10px] hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              className="w-full h-[42px] rounded-[10px] bg-orange text-white font-semibold"
              onClick={() => setFiltersOpen(false)}
            >
              Применить
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[12px] bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Objects section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Объекты в работе</h2>
          <Link href="/dashboard" className="text-sm font-semibold text-orange hover:text-orange/80">
            Все объекты
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-[18px] border border-line bg-white animate-pulse"
              />
            ))}
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-white px-6 py-12 text-center shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-cream text-orange">
              <Home className="w-8 h-8" aria-hidden />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-ink">Создайте первый объект</h3>
            <p className="mt-2 text-sm text-muted max-w-md mx-auto">
              Добавьте карточку объекта — этапы, фото и расходы появятся в одном месте.
            </p>
            <Link
              href="/projects/new"
              className="mt-6 inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-orange px-5 text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4" />
              Новый объект
            </Link>
            <div className="mt-8 grid gap-2 sm:grid-cols-3 max-w-xl mx-auto text-left">
              {["Добавьте этапы", "Прикрепите фото", "Сформируйте отчёт"].map((t) => (
                <div
                  key={t}
                  className="rounded-[12px] border border-line bg-page px-3 py-3 text-sm text-muted"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isDemo={project.id < 0}
                menuOpen={menuOpenId === project.id}
                onMenuToggle={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === project.id ? null : project.id);
                }}
                onArchive={() => archiveProject(project.id)}
                onPreviewPhoto={(photo) =>
                  setPreviewPhoto({
                    src: photo.file_path,
                    projectName: project.name,
                    comment: photo.comment ?? null,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-line bg-white overflow-hidden shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
            {displayProjects.map((project) => (
              <Link
                key={project.id}
                href={project.id < 0 ? "/projects/new" : `/projects/${project.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b border-line last:border-b-0 hover:bg-page transition-colors"
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", statusBarClass(project))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink truncate">{project.name}</p>
                    {project.id < 0 && (
                      <span className="text-[11px] font-medium text-orange bg-cream px-1.5 py-0.5 rounded">
                        Демо-данные
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-muted truncate">{project.address}</p>
                </div>
                <p className="text-sm text-muted w-28">{projectStatusLabel(statusLabels, project.status)}</p>
                <p className="text-sm font-medium text-ink w-16">{project.progress_percent}%</p>
                <ChevronRight className="w-4 h-4 text-muted hidden sm:block" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Attention + Activity */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange" aria-hidden />
            <h2 className="font-semibold text-ink">Требует внимания</h2>
          </div>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Нет данных</p>
          ) : (
            <ul className="space-y-2">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-3 hover:bg-page transition-colors"
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", item.tone)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                      <p className="text-caption text-muted">{item.meta}</p>
                    </div>
                    <span className="text-caption font-semibold text-orange">Открыть</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <h2 className="font-semibold text-ink mb-4">Последняя активность</h2>
          {activityFeed.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Нет данных</p>
          ) : (
            <ul className="space-y-3">
              {activityFeed.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="block rounded-[12px] hover:bg-page px-1 py-1 transition-colors">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{item.name}</span>
                      {" — "}
                      {item.text}
                    </p>
                    <p className="text-caption text-muted mt-0.5">
                      {formatDistanceToNow(new Date(item.at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Budget + deadlines */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <h2 className="font-semibold text-ink mb-4">Бюджет по объектам</h2>
          {kpiProjects.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Нет данных</p>
          ) : (
            <ul className="space-y-4">
              {kpiProjects.slice(0, 5).map((p) => {
                const spent = p.total_spent ?? 0;
                const budget = p.budget || 0;
                const max = Math.max(budget, spent, 1);
                return (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <p className="text-caption text-muted shrink-0">
                        {formatMoney(spent)}
                        {budget > 0 ? ` / ${formatMoney(budget)}` : ""}
                      </p>
                    </div>
                    <div className="h-2.5 rounded-full bg-line overflow-hidden relative">
                      {budget > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-green/25"
                          style={{ width: `${(budget / max) * 100}%` }}
                        />
                      )}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          budget > 0 && spent > budget ? "bg-orange" : "bg-green"
                        )}
                        style={{ width: `${(spent / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <h2 className="font-semibold text-ink mb-4">Ближайшие сроки</h2>
          {nearestDeadlines.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Нет данных</p>
          ) : (
            <ul className="space-y-2">
              {nearestDeadlines.map((p) => {
                const days = differenceInCalendarDays(
                  new Date(p.planned_end_date!),
                  new Date()
                );
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-3 hover:bg-page transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                        <p className="text-caption text-muted">
                          {format(new Date(p.planned_end_date!), "d MMM yyyy", {
                            locale: ru,
                          })}
                          {" · "}
                          {projectStatusLabel(statusLabels, p.status)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-caption font-semibold shrink-0",
                          days < 0 ? "text-red-600" : days <= 3 ? "text-orange" : "text-muted"
                        )}
                      >
                        {days < 0
                          ? `−${Math.abs(days)} ${dayWord(days)}`
                          : days === 0
                            ? "сегодня"
                            : `${days} ${dayWord(days)}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[18px] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="text-sm text-muted truncate">{previewPhoto.projectName}</span>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink min-h-[42px] px-2"
                onClick={() => setPreviewPhoto(null)}
              >
                Закрыть
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-ink flex items-center justify-center">
              {previewPhoto.src.startsWith("/placeholder") ? (
                <div className="text-white text-6xl" aria-hidden>
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
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isDemo,
  menuOpen,
  onMenuToggle,
  onArchive,
  onPreviewPhoto,
}: {
  project: ProjectListItem;
  isDemo: boolean;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
  onArchive: () => void;
  onPreviewPhoto: (photo: { file_path: string; comment: string | null }) => void;
}) {
  const { project: statusLabels } = useStatusLabels();
  const href = isDemo ? "/projects/new" : `/projects/${project.id}`;
  const days = project.planned_end_date
    ? differenceInCalendarDays(new Date(project.planned_end_date), new Date())
    : null;
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <article className="relative rounded-[18px] border border-line bg-white overflow-hidden shadow-[0_8px_24px_rgba(23,63,52,0.06)] hover:shadow-[0_12px_28px_rgba(23,63,52,0.1)] transition-shadow duration-soft">
      <div className={cn("h-1.5 w-full", statusBarClass(project))} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={href} className="font-semibold text-ink hover:text-green line-clamp-2">
                {project.name}
              </Link>
              {isDemo && (
                <span className="text-[11px] font-medium text-orange bg-cream px-1.5 py-0.5 rounded">
                  Демо-данные
                </span>
              )}
            </div>
            <p className="mt-1 text-caption text-muted flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-1">{project.address}</span>
            </p>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              aria-label="Действия с объектом"
              aria-expanded={menuOpen}
              onClick={onMenuToggle}
              className="p-2 rounded-[10px] text-muted hover:bg-surface hover:text-ink min-h-[42px] min-w-[42px] inline-flex items-center justify-center"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 w-44 rounded-[12px] border border-line bg-white shadow-soft py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={href}
                  className="block px-3 py-2.5 text-sm text-ink hover:bg-page"
                >
                  Изменить
                </Link>
                <Link
                  href={isDemo ? "/reports" : `/reports/${project.id}?print=1`}
                  className="block px-3 py-2.5 text-sm text-ink hover:bg-page"
                >
                  Создать отчёт
                </Link>
                {!isDemo && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-page"
                    onClick={onArchive}
                  >
                    Архивировать
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <span className="inline-flex rounded-full bg-surface text-green px-2.5 py-1 text-caption font-medium">
          {projectStatusLabel(statusLabels, project.status)}
        </span>

        <div>
          <div className="flex items-center justify-between text-caption text-muted mb-1.5">
            <span>Готовность</span>
            <span className="font-semibold text-ink">{project.progress_percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full bg-orange"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>
        </div>

        <div className="space-y-1.5 text-caption text-muted">
          {project.planned_end_date && (
            <p>
              Срок:{" "}
              {format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })}
              {days != null && (
                <span className={cn("ml-1", days < 0 ? "text-red-600 font-medium" : "")}>
                  (
                  {days > 0
                    ? `осталось ${days} ${dayWord(days)}`
                    : days < 0
                      ? `просрочка ${Math.abs(days)} ${dayWord(days)}`
                      : "сегодня"}
                  )
                </span>
              )}
            </p>
          )}
          <p>
            План / факт:{" "}
            <span className="text-ink font-medium">
              {formatMoney(project.budget || 0)} / {formatMoney(project.total_spent ?? 0)}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          {project.preview_photos && project.preview_photos.length > 0 ? (
            project.preview_photos.slice(0, 3).map((photo, idx) => (
              <button
                key={idx}
                type="button"
                className="h-14 w-16 rounded-[10px] overflow-hidden bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
                onClick={(e) => {
                  e.preventDefault();
                  onPreviewPhoto(photo);
                }}
              >
                {photo.file_path.startsWith("/placeholder") ||
                photo.file_path.includes("placeholder") ? (
                  <span className="w-full h-full flex items-center justify-center text-muted text-xs">
                    фото
                  </span>
                ) : (
                  <img
                    src={photo.file_path}
                    alt={photo.comment || "Фото объекта"}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))
          ) : (
            <div className="h-14 flex-1 rounded-[10px] border border-dashed border-line bg-page flex items-center justify-center text-caption text-muted">
              Фото пока нет
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
          <p className="text-caption text-muted truncate">
            {project.manager || "Без ответственного"}
          </p>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-orange hover:text-orange/80 min-h-[42px]"
          >
            Открыть
            <ChevronRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
