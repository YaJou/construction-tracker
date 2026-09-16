"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/utils/cn";
import { useStatusLabels } from "@/hooks/useStatusLabels";
import {
  HANDOVER_STAGE_SUBSTEPS,
  normalizeTemplateStageName,
  objectWord,
} from "@/lib/constants";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";

type TabId = "stages" | "managers" | "types" | "statuses";

interface SettingDefaultStage {
  id: number;
  name: string;
  order_index: number;
}
interface SettingManager {
  id: number;
  name: string;
}
interface SettingObjectType {
  id: number;
  name: string;
}
interface SettingStatusItem {
  key: string;
  label: string;
}
interface SettingsData {
  default_stages: SettingDefaultStage[];
  managers: SettingManager[];
  object_types: SettingObjectType[];
  project_statuses: SettingStatusItem[];
  stage_statuses: SettingStatusItem[];
  usage?: {
    managers: Record<string, number>;
    object_types: Record<string, number>;
  };
}

const TABS: { id: TabId; label: string }[] = [
  { id: "stages", label: "Этапы" },
  { id: "managers", label: "Ответственные" },
  { id: "types", label: "Типы объектов" },
  { id: "statuses", label: "Статусы" },
];

function objectTypeIcon(name: string) {
  const n = name.toLowerCase();
  if (/коттедж|дом|дач|частн/.test(n)) return Home;
  if (/жк|жил|комплекс|многокварт/.test(n)) return Building2;
  if (/таун/.test(n)) return Building2;
  if (/коммерц|офис|торг/.test(n)) return Store;
  if (/реконстр|ремонт/.test(n)) return Wrench;
  return Building2;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function isSettingsData(value: unknown): value is SettingsData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.default_stages) &&
    Array.isArray(v.managers) &&
    Array.isArray(v.object_types) &&
    Array.isArray(v.project_statuses) &&
    Array.isArray(v.stage_statuses)
  );
}

export default function SettingsPage() {
  const { refresh: refreshLabels } = useStatusLabels();
  const [tab, setTab] = useState<TabId>("stages");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMessage, setOkMessage] = useState("");
  const [search, setSearch] = useState("");

  // stages — локальный список = источник правды для UI (не ждём ответа сервера)
  const [stageList, setStageList] = useState<SettingDefaultStage[]>([]);
  const stageListRef = useRef<SettingDefaultStage[]>([]);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const newStageRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [stageMenuId, setStageMenuId] = useState<number | null>(null);

  // managers
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null);
  const [editingManagerName, setEditingManagerName] = useState("");
  const [addingManager, setAddingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const newManagerRef = useRef<HTMLInputElement>(null);

  // types
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const newTypeRef = useRef<HTMLInputElement>(null);

  // statuses drafts
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({});
  const [stageDrafts, setStageDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok || !isSettingsData(json)) {
        setError(json?.error || "Не удалось загрузить справочники");
        return;
      }
      setData(json);
      const orderedStages = [...json.default_stages]
        .map((s, i) => ({
          id: Number(s.id),
          name: normalizeTemplateStageName(s.name),
          order_index: typeof s.order_index === "number" ? s.order_index : i,
        }))
        .sort((a, b) => a.order_index - b.order_index)
        .map((s, i) => ({ ...s, order_index: i }));
      stageListRef.current = orderedStages;
      setStageList(orderedStages);
      // Template-only rename: old «Объект завершён» → «Сдача и приёмка»
      const needsRename = json.default_stages.some(
        (s) => normalizeTemplateStageName(s.name) !== s.name
      );
      if (needsRename) {
        void fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ default_stages: orderedStages }),
        }).catch(() => {});
      }
      setProjectDrafts(
        Object.fromEntries(json.project_statuses.map((s) => [s.key, s.label]))
      );
      setStageDrafts(Object.fromEntries(json.stage_statuses.map((s) => [s.key, s.label])));
    } catch {
      setError("Ошибка сети при загрузке справочников");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (addingStage) newStageRef.current?.focus();
  }, [addingStage]);
  useEffect(() => {
    if (addingManager) newManagerRef.current?.focus();
  }, [addingManager]);
  useEffect(() => {
    if (addingType) newTypeRef.current?.focus();
  }, [addingType]);

  const statusesDirty = useMemo(() => {
    if (!data) return false;
    return (
      data.project_statuses.some((s) => (projectDrafts[s.key] ?? s.label) !== s.label) ||
      data.stage_statuses.some((s) => (stageDrafts[s.key] ?? s.label) !== s.label)
    );
  }, [data, projectDrafts, stageDrafts]);

  const projectStatusesDirty = useMemo(() => {
    if (!data) return false;
    return data.project_statuses.some(
      (s) => (projectDrafts[s.key] ?? s.label) !== s.label
    );
  }, [data, projectDrafts]);

  const stageStatusesDirty = useMemo(() => {
    if (!data) return false;
    return data.stage_statuses.some((s) => (stageDrafts[s.key] ?? s.label) !== s.label);
  }, [data, stageDrafts]);

  useEffect(() => {
    const close = () => setStageMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!statusesDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [statusesDirty]);

  const switchTab = (next: TabId) => {
    if (next === tab) return;
    if (statusesDirty && tab === "statuses") {
      const leave = window.confirm("Есть несохранённые статусы. Уйти без сохранения?");
      if (!leave) return;
      if (data) {
        setProjectDrafts(
          Object.fromEntries(data.project_statuses.map((s) => [s.key, s.label]))
        );
        setStageDrafts(Object.fromEntries(data.stage_statuses.map((s) => [s.key, s.label])));
      }
    }
    setSearch("");
    setTab(next);
  };

  const saveSection = async (section: keyof SettingsData, value: unknown) => {
    if (!data) return false;
    setSaving(true);
    setError("");
    setOkMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [section]: value }),
      });
      const updated = await res.json();
      if (!res.ok || !isSettingsData(updated)) {
        setError(updated?.error || "Не удалось сохранить");
        return false;
      }
      // Для этапов оставляем локальный порядок — сервер иногда отдаёт старый
      // порядок при RLS, хотя запись уже ушла.
      if (section === "default_stages" && Array.isArray(value)) {
        const local = (value as SettingDefaultStage[]).map((s, i) => ({
          ...s,
          id: Number(s.id),
          order_index: i,
        }));
        stageListRef.current = local;
        setStageList(local);
        setData({ ...updated, default_stages: local });
      } else {
        setData(updated);
        if (updated.default_stages) {
          const ordered = [...updated.default_stages]
            .sort((a, b) => a.order_index - b.order_index)
            .map((s, i) => ({ ...s, id: Number(s.id), order_index: i }));
          stageListRef.current = ordered;
          setStageList(ordered);
        }
      }
      if (section === "project_statuses" || section === "stage_statuses") {
        setProjectDrafts(
          Object.fromEntries(updated.project_statuses.map((s) => [s.key, s.label]))
        );
        setStageDrafts(
          Object.fromEntries(updated.stage_statuses.map((s) => [s.key, s.label]))
        );
        await refreshLabels();
      }
      setOkMessage("Сохранено");
      window.setTimeout(() => setOkMessage(""), 2500);
      return true;
    } catch {
      setError("Ошибка сети при сохранении");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();

  const stages = useMemo(() => {
    if (!q) return stageList;
    return stageList.filter((s) => s.name.toLowerCase().includes(q));
  }, [stageList, q]);

  const managers = useMemo(() => {
    const list = data?.managers ?? [];
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [data, q]);

  const types = useMemo(() => {
    const list = data?.object_types ?? [];
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [data, q]);

  const normalizeName = (v: string) => v.trim().replace(/\s+/g, " ");
  const isDuplicate = (name: string, list: { id: number; name: string }[], exceptId?: number) => {
    const n = name.toLowerCase();
    return list.some((x) => x.id !== exceptId && x.name.trim().toLowerCase() === n);
  };

  const applyStageOrder = (next: SettingDefaultStage[]) => {
    const normalized = next.map((s, i) => ({ ...s, id: Number(s.id), order_index: i }));
    stageListRef.current = normalized;
    setStageList(normalized);
    return normalized;
  };

  const persistStagesOrder = async (ordered: SettingDefaultStage[]) => {
    const snapshot = stageListRef.current;
    const next = applyStageOrder(ordered);
    const ok = await saveSection("default_stages", next);
    if (!ok) {
      stageListRef.current = snapshot;
      setStageList(snapshot);
    }
  };

  const moveStageAt = (index: number, dir: -1 | 1) => {
    const list = stageListRef.current;
    const j = index + dir;
    if (index < 0 || j < 0 || j >= list.length) return;
    const copy = [...list];
    [copy[index], copy[j]] = [copy[j], copy[index]];
    void persistStagesOrder(copy);
  };

  const onStagePointerDown = (index: number) => (e: React.PointerEvent) => {
    if (editingStageId != null || q) return;
    e.preventDefault();
    dragIndexRef.current = index;
    setDragIndex(index);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const from = dragIndexRef.current;
    if (from == null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest("[data-stage-index]") as HTMLElement | null;
    if (!row) return;
    const index = Number(row.dataset.stageIndex);
    if (Number.isNaN(index) || index === from) return;
    const list = [...stageListRef.current];
    const [item] = list.splice(from, 1);
    list.splice(index, 0, item);
    dragIndexRef.current = index;
    setDragIndex(index);
    applyStageOrder(list);
  };

  const onStagePointerUp = () => {
    if (dragIndexRef.current == null) return;
    dragIndexRef.current = null;
    setDragIndex(null);
    void persistStagesOrder(stageListRef.current);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error || "Справочники не загрузились"}</p>
        <Button onClick={load}>Повторить</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard"
          className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-white hover:text-ink"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-ink">Справочники</h1>
          <p className="mt-1 text-[15px] text-muted">
            Настройте этапы, ответственных и варианты для карточек объектов
          </p>
        </div>
      </div>

      {(saving || okMessage || error) && (
        <div
          className={cn(
            "rounded-[14px] border px-4 py-3 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : okMessage
                ? "border-green/20 bg-green/5 font-medium text-green"
                : "border-line bg-white text-muted"
          )}
          role="status"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Сохранение…
            </span>
          ) : (
            error || okMessage
          )}
        </div>
      )}

      {(saving || okMessage) && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[min(92vw,360px)] -translate-x-1/2">
          <div
            className={cn(
              "rounded-[12px] px-4 py-3 text-center text-sm font-medium text-white shadow-soft",
              okMessage && !saving ? "bg-green" : "bg-ink"
            )}
          >
            {saving ? "Сохранение…" : okMessage}
          </div>
        </div>
      )}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={cn(
              "relative shrink-0 rounded-[10px] px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "text-green" : "text-muted hover:bg-white hover:text-ink"
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-orange" />
            )}
          </button>
        ))}
      </div>

      {/* STAGES */}
      {tab === "stages" && (
        <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Этапы строительства</h2>
              <p className="mt-1 text-sm text-muted">
                {stageList.length} {stageList.length === 1 ? "этап" : "этапов"} · этот список
                используется при создании новых объектов. Этапы существующих объектов редактируются в
                самих проектах.
              </p>
              {stageList.some((s) => s.name === "Сдача и приёмка") && (
                <p className="mt-2 text-caption text-muted">
                  У «Сдача и приёмка» при создании нового объекта добавляется чек-лист:{" "}
                  {HANDOVER_STAGE_SUBSTEPS.slice(0, 3).join(", ")}…
                </p>
              )}
            </div>
            <Button
              className="shrink-0 bg-orange hover:bg-orange/90 text-white border-0"
              onClick={() => {
                setAddingStage(true);
                setNewStageName("");
              }}
              disabled={saving}
            >
              <Plus className="mr-1 h-4 w-4" /> Добавить этап
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск этапа"
              className="h-11 w-full rounded-[10px] border border-line bg-page pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            />
          </div>

          {addingStage && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-orange/40 bg-cream/40 p-3">
              <Input
                ref={newStageRef}
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Название этапа"
                className="flex-1 min-w-[200px]"
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    setAddingStage(false);
                    setNewStageName("");
                  }
                  if (e.key === "Enter") {
                    const name = normalizeName(newStageName);
                    if (!name) return setError("Укажите название этапа");
                    if (isDuplicate(name, stageList)) return setError("Такой этап уже есть");
                    const next = [
                      ...stageList,
                      {
                        id: Math.max(0, ...stageList.map((s) => Number(s.id))) + 1,
                        name,
                        order_index: stageList.length,
                      },
                    ];
                    applyStageOrder(next);
                    const ok = await saveSection("default_stages", next);
                    if (ok) {
                      setAddingStage(false);
                      setNewStageName("");
                    }
                  }
                }}
              />
              <Button
                disabled={saving}
                onClick={async () => {
                  const name = normalizeName(newStageName);
                  if (!name) return setError("Укажите название этапа");
                  if (isDuplicate(name, stageList)) return setError("Такой этап уже есть");
                  const next = [
                    ...stageList,
                    {
                      id: Math.max(0, ...stageList.map((s) => Number(s.id))) + 1,
                      name,
                      order_index: stageList.length,
                    },
                  ];
                  applyStageOrder(next);
                  const ok = await saveSection("default_stages", next);
                  if (ok) {
                    setAddingStage(false);
                    setNewStageName("");
                  }
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddingStage(false);
                  setNewStageName("");
                }}
              >
                Отмена
              </Button>
            </div>
          )}

          <ul className="mt-3 divide-y divide-line select-none">
            {stages.map((s, visualIndex) => {
              const realIndex = q
                ? stageList.findIndex((x) => Number(x.id) === Number(s.id))
                : visualIndex;
              return (
                <li
                  key={s.id}
                  data-stage-index={realIndex}
                  className={cn(
                    "flex min-h-[60px] items-center gap-2 py-2 transition-colors",
                    "hover:bg-surface/80",
                    dragIndex === realIndex && "bg-cream/60 opacity-80"
                  )}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onPointerDown={onStagePointerDown(realIndex)}
                    onPointerMove={onStagePointerMove}
                    onPointerUp={onStagePointerUp}
                    onPointerCancel={onStagePointerUp}
                    className="inline-flex h-11 w-9 cursor-grab touch-none items-center justify-center rounded-[10px] text-muted active:cursor-grabbing"
                    aria-label="Переместить"
                    title="Перетащите"
                  >
                    <GripVertical className="h-4 w-4 pointer-events-none" />
                  </span>
                  <span className="w-7 shrink-0 text-center text-sm font-semibold text-muted">
                    {realIndex + 1}
                  </span>
                  {editingStageId === s.id ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-no-drag>
                      <Input
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        className="min-w-[180px] flex-1"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === "Escape") setEditingStageId(null);
                          if (e.key === "Enter") {
                            const name = normalizeName(editingStageName);
                            if (!name) return setError("Название не может быть пустым");
                            if (isDuplicate(name, stageList, s.id))
                              return setError("Такой этап уже есть");
                            const next = stageList.map((x) =>
                              Number(x.id) === Number(s.id) ? { ...x, name } : x
                            );
                            applyStageOrder(next);
                            const ok = await saveSection("default_stages", next);
                            if (ok) setEditingStageId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={async () => {
                          const name = normalizeName(editingStageName);
                          if (!name) return setError("Название не может быть пустым");
                          if (isDuplicate(name, stageList, s.id))
                            return setError("Такой этап уже есть");
                          const next = stageList.map((x) =>
                            Number(x.id) === Number(s.id) ? { ...x, name } : x
                          );
                          applyStageOrder(next);
                          const ok = await saveSection("default_stages", next);
                          if (ok) setEditingStageId(null);
                        }}
                      >
                        Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingStageId(null)}>
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                        {s.name}
                      </span>
                      <button
                        type="button"
                        data-no-drag
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-ink"
                        aria-label="Редактировать"
                        onClick={() => {
                          setStageMenuId(null);
                          setEditingStageId(s.id);
                          setEditingStageName(s.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <div className="relative" data-no-drag>
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-ink"
                          aria-label="Ещё действия"
                          aria-expanded={stageMenuId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStageMenuId((prev) => (prev === s.id ? null : s.id));
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {stageMenuId === s.id && (
                          <div
                            className="absolute right-0 top-full z-20 mt-1 w-44 rounded-[12px] border border-line bg-white py-1 shadow-soft"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-page disabled:opacity-40"
                              disabled={realIndex <= 0}
                              onClick={() => {
                                setStageMenuId(null);
                                moveStageAt(realIndex, -1);
                              }}
                            >
                              <ChevronUp className="h-4 w-4 text-muted" /> Выше
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-page disabled:opacity-40"
                              disabled={realIndex >= stageList.length - 1}
                              onClick={() => {
                                setStageMenuId(null);
                                moveStageAt(realIndex, 1);
                              }}
                            >
                              <ChevronDown className="h-4 w-4 text-muted" /> Ниже
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={async () => {
                                setStageMenuId(null);
                                if (
                                  !window.confirm(
                                    `Удалить этап «${s.name}» из шаблона? На существующие объекты это не повлияет.`
                                  )
                                )
                                  return;
                                const next = stageList
                                  .filter((x) => Number(x.id) !== Number(s.id))
                                  .map((x, i) => ({ ...x, order_index: i }));
                                applyStageOrder(next);
                                await saveSection("default_stages", next);
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {stages.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">
              {q ? (
                <>
                  <p>Ничего не найдено</p>
                  <Button variant="ghost" className="mt-2" onClick={() => setSearch("")}>
                    Сбросить поиск
                  </Button>
                </>
              ) : (
                <p>Добавьте первый этап для шаблона новых объектов</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* MANAGERS */}
      {tab === "managers" && (
        <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Ответственные</h2>
              <p className="mt-1 text-sm text-muted">
                {data.managers.length} в списке · для выбора на объектах и этапах. Это справочник имён,
                а не приглашение в приложение.
              </p>
            </div>
            <Button
              className="shrink-0 bg-orange hover:bg-orange/90 text-white border-0"
              onClick={() => {
                setAddingManager(true);
                setNewManagerName("");
              }}
              disabled={saving}
            >
              <Plus className="mr-1 h-4 w-4" /> Добавить ответственного
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ФИО"
              className="h-11 w-full rounded-[10px] border border-line bg-page pl-10 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            />
          </div>

          {addingManager && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-orange/40 bg-cream/40 p-3">
              <Input
                ref={newManagerRef}
                value={newManagerName}
                onChange={(e) => setNewManagerName(e.target.value)}
                placeholder="ФИО"
                className="min-w-[200px] flex-1"
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    setAddingManager(false);
                    setNewManagerName("");
                  }
                  if (e.key === "Enter") {
                    const name = normalizeName(newManagerName);
                    if (!name) return setError("Укажите ФИО");
                    if (isDuplicate(name, data.managers)) return setError("Такой человек уже есть");
                    const next = [
                      ...data.managers,
                      { id: Math.max(0, ...data.managers.map((m) => m.id)) + 1, name },
                    ];
                    const ok = await saveSection("managers", next);
                    if (ok) {
                      setAddingManager(false);
                      setNewManagerName("");
                    }
                  }
                }}
              />
              <Button
                disabled={saving}
                onClick={async () => {
                  const name = normalizeName(newManagerName);
                  if (!name) return setError("Укажите ФИО");
                  if (isDuplicate(name, data.managers)) return setError("Такой человек уже есть");
                  const next = [
                    ...data.managers,
                    { id: Math.max(0, ...data.managers.map((m) => m.id)) + 1, name },
                  ];
                  const ok = await saveSection("managers", next);
                  if (ok) {
                    setAddingManager(false);
                    setNewManagerName("");
                  }
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddingManager(false);
                  setNewManagerName("");
                }}
              >
                Отмена
              </Button>
            </div>
          )}

          <ul className="mt-3 divide-y divide-line">
            {managers.map((m) => {
              const used = data.usage?.managers?.[m.name] ?? 0;
              return (
                <li key={m.id} className="flex min-h-[60px] items-center gap-3 py-2 hover:bg-surface/80">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green/10 text-sm font-semibold text-green">
                    {initials(m.name)}
                  </span>
                  {editingManagerId === m.id ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Input
                        value={editingManagerName}
                        onChange={(e) => setEditingManagerName(e.target.value)}
                        className="min-w-[180px] flex-1"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === "Escape") setEditingManagerId(null);
                          if (e.key === "Enter") {
                            const name = normalizeName(editingManagerName);
                            if (!name) return setError("ФИО не может быть пустым");
                            if (isDuplicate(name, data.managers, m.id))
                              return setError("Такой человек уже есть");
                            const next = data.managers.map((x) =>
                              x.id === m.id ? { ...x, name } : x
                            );
                            const ok = await saveSection("managers", next);
                            if (ok) setEditingManagerId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={async () => {
                          const name = normalizeName(editingManagerName);
                          if (!name) return setError("ФИО не может быть пустым");
                          if (isDuplicate(name, data.managers, m.id))
                            return setError("Такой человек уже есть");
                          const next = data.managers.map((x) =>
                            x.id === m.id ? { ...x, name } : x
                          );
                          const ok = await saveSection("managers", next);
                          if (ok) setEditingManagerId(null);
                        }}
                      >
                        Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingManagerId(null)}>
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
                        {used > 0 && (
                          <p className="text-caption text-muted">Используется в объектах/этапах: {used}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-ink"
                        aria-label="Редактировать"
                        onClick={() => {
                          setEditingManagerId(m.id);
                          setEditingManagerName(m.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-red-50 hover:text-red-600"
                        aria-label="Удалить"
                        onClick={async () => {
                          if (used > 0) {
                            window.alert(
                              `«${m.name}» уже указан в объектах или этапах (${used}). Удаление из справочника не сотрёт историю — записи в проектах останутся со старым ФИО. Чтобы убрать из списка выбора — подтвердите удаление.`
                            );
                          }
                          if (!window.confirm(`Удалить «${m.name}» из справочника?`)) return;
                          await saveSection(
                            "managers",
                            data.managers.filter((x) => x.id !== m.id)
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {managers.length === 0 && (
            <div className="py-10 text-center">
              {q ? (
                <>
                  <p className="text-sm text-muted">Ничего не найдено</p>
                  <Button variant="ghost" className="mt-2" onClick={() => setSearch("")}>
                    Сбросить поиск
                  </Button>
                </>
              ) : (
                <>
                  <User className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-3 text-sm text-muted">
                    Добавьте ответственного, чтобы назначать его на объекты и этапы
                  </p>
                  <Button
                    className="mt-4 bg-orange hover:bg-orange/90 text-white border-0"
                    onClick={() => {
                      setAddingManager(true);
                      setNewManagerName("");
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Добавить ответственного
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* TYPES */}
      {tab === "types" && (
        <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Типы объектов</h2>
              <p className="mt-1 text-sm text-muted">
                {data.object_types.length}{" "}
                {data.object_types.length === 1 ? "тип" : "типов"} · для выбора при создании карточки
              </p>
            </div>
            <Button
              className="shrink-0 bg-orange hover:bg-orange/90 text-white border-0"
              onClick={() => {
                setAddingType(true);
                setNewTypeName("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Добавить тип
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск типа"
              className="h-11 w-full rounded-[10px] border border-line bg-page pl-10 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            />
          </div>

          {addingType && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-orange/40 bg-cream/40 p-3">
              <Input
                ref={newTypeRef}
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Название типа"
                className="min-w-[200px] flex-1"
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    setAddingType(false);
                    setNewTypeName("");
                  }
                  if (e.key === "Enter") {
                    const name = normalizeName(newTypeName);
                    if (!name) return setError("Укажите название");
                    if (isDuplicate(name, data.object_types)) return setError("Такой тип уже есть");
                    const next = [
                      ...(data.object_types || []),
                      {
                        id: Math.max(0, ...(data.object_types || []).map((o) => o.id)) + 1,
                        name,
                      },
                    ];
                    const ok = await saveSection("object_types", next);
                    if (ok) {
                      setAddingType(false);
                      setNewTypeName("");
                    }
                  }
                }}
              />
              <Button
                disabled={saving}
                onClick={async () => {
                  const name = normalizeName(newTypeName);
                  if (!name) return setError("Укажите название");
                  if (isDuplicate(name, data.object_types)) return setError("Такой тип уже есть");
                  const next = [
                    ...(data.object_types || []),
                    {
                      id: Math.max(0, ...(data.object_types || []).map((o) => o.id)) + 1,
                      name,
                    },
                  ];
                  const ok = await saveSection("object_types", next);
                  if (ok) {
                    setAddingType(false);
                    setNewTypeName("");
                  }
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddingType(false);
                  setNewTypeName("");
                }}
              >
                Отмена
              </Button>
            </div>
          )}

          <ul className="mt-3 divide-y divide-line">
            {types.map((t) => {
              const used = data.usage?.object_types?.[t.name] ?? 0;
              const Icon = objectTypeIcon(t.name);
              return (
                <li key={t.id} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-surface/80">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-green">
                    <Icon className="h-4 w-4" />
                  </span>
                  {editingTypeId === t.id ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Input
                        value={editingTypeName}
                        onChange={(e) => setEditingTypeName(e.target.value)}
                        className="min-w-[180px] flex-1"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === "Escape") setEditingTypeId(null);
                          if (e.key === "Enter") {
                            const name = normalizeName(editingTypeName);
                            if (!name) return setError("Название не может быть пустым");
                            if (isDuplicate(name, data.object_types, t.id))
                              return setError("Такой тип уже есть");
                            const next = data.object_types.map((x) =>
                              x.id === t.id ? { ...x, name } : x
                            );
                            const ok = await saveSection("object_types", next);
                            if (ok) setEditingTypeId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={async () => {
                          const name = normalizeName(editingTypeName);
                          if (!name) return setError("Название не может быть пустым");
                          if (isDuplicate(name, data.object_types, t.id))
                            return setError("Такой тип уже есть");
                          const next = data.object_types.map((x) =>
                            x.id === t.id ? { ...x, name } : x
                          );
                          const ok = await saveSection("object_types", next);
                          if (ok) setEditingTypeId(null);
                        }}
                      >
                        Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTypeId(null)}>
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">{t.name}</p>
                        {used > 0 && (
                          <Link
                            href={`/dashboard?object_type=${encodeURIComponent(t.name)}`}
                            className="text-caption text-orange hover:text-orange/80"
                          >
                            {used} {objectWord(used)}
                          </Link>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-surface"
                        aria-label="Редактировать"
                        onClick={() => {
                          setEditingTypeId(t.id);
                          setEditingTypeName(t.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-red-50 hover:text-red-600"
                        aria-label="Удалить"
                        onClick={async () => {
                          if (used > 0) {
                            window.alert(
                              `Тип «${t.name}» уже указан у ${used} ${objectWord(used)}. Удаление из справочника не изменит карточки — там останется старое значение.`
                            );
                          }
                          if (!window.confirm(`Удалить тип «${t.name}»?`)) return;
                          await saveSection(
                            "object_types",
                            data.object_types.filter((x) => x.id !== t.id)
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {types.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">
              {q ? (
                <>
                  <p>Ничего не найдено</p>
                  <Button variant="ghost" className="mt-2" onClick={() => setSearch("")}>
                    Сбросить поиск
                  </Button>
                </>
              ) : (
                <p>Добавьте тип объекта</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* STATUSES */}
      {tab === "statuses" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
            <h2 className="text-lg font-semibold text-ink">Статусы объектов</h2>
            <p className="mt-1 text-sm text-muted">Подписи для карточек и фильтров</p>
            <ul className="mt-4 space-y-3">
              {data.project_statuses.map((s) => {
                const label = projectDrafts[s.key] ?? s.label;
                return (
                  <li key={s.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={label}
                      onChange={(e) =>
                        setProjectDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      className="flex-1"
                      aria-label="Подпись статуса объекта"
                    />
                    <StatusBadge kind="project" status={s.key} label={label} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button
                disabled={saving || !projectStatusesDirty}
                className="bg-orange hover:bg-orange/90 text-white border-0 disabled:opacity-40"
                onClick={async () => {
                  for (const s of data.project_statuses) {
                    if (!normalizeName(projectDrafts[s.key] ?? "")) {
                      setError("Подпись статуса объекта не может быть пустой");
                      return;
                    }
                  }
                  const ok = await saveSection(
                    "project_statuses",
                    data.project_statuses.map((s) => ({
                      key: s.key,
                      label: normalizeName(projectDrafts[s.key] ?? s.label),
                    }))
                  );
                  if (ok) {
                    setProjectDrafts((prev) => {
                      const next = { ...prev };
                      for (const s of data.project_statuses) {
                        next[s.key] = normalizeName(projectDrafts[s.key] ?? s.label);
                      }
                      return next;
                    });
                  }
                }}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Сохранить изменения
              </Button>
              <Button
                variant="ghost"
                disabled={saving || !projectStatusesDirty}
                onClick={() => {
                  setProjectDrafts(
                    Object.fromEntries(data.project_statuses.map((s) => [s.key, s.label]))
                  );
                  setError("");
                }}
              >
                <X className="mr-1 h-4 w-4" /> Отменить
              </Button>
            </div>
          </section>

          <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
            <h2 className="text-lg font-semibold text-ink">Статусы этапов</h2>
            <p className="mt-1 text-sm text-muted">Подписи в списке этапов строительства</p>
            <ul className="mt-4 space-y-3">
              {data.stage_statuses.map((s) => {
                const label = stageDrafts[s.key] ?? s.label;
                return (
                  <li key={s.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={label}
                      onChange={(e) =>
                        setStageDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      className="flex-1"
                      aria-label="Подпись статуса этапа"
                    />
                    <StatusBadge kind="stage" status={s.key} label={label} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button
                disabled={saving || !stageStatusesDirty}
                className="bg-orange hover:bg-orange/90 text-white border-0 disabled:opacity-40"
                onClick={async () => {
                  for (const s of data.stage_statuses) {
                    if (!normalizeName(stageDrafts[s.key] ?? "")) {
                      setError("Подпись статуса этапа не может быть пустой");
                      return;
                    }
                  }
                  await saveSection(
                    "stage_statuses",
                    data.stage_statuses.map((s) => ({
                      key: s.key,
                      label: normalizeName(stageDrafts[s.key] ?? s.label),
                    }))
                  );
                }}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Сохранить изменения
              </Button>
              <Button
                variant="ghost"
                disabled={saving || !stageStatusesDirty}
                onClick={() => {
                  setStageDrafts(
                    Object.fromEntries(data.stage_statuses.map((s) => [s.key, s.label]))
                  );
                  setError("");
                }}
              >
                <X className="mr-1 h-4 w-4" /> Отменить
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
