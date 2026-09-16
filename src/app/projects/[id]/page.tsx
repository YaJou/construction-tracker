"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ProjectPhotosSection,
  ProjectExpensesSection,
  ProjectActivitySection,
} from "@/components/project/ProjectTabSections";
import { ProjectTeamCard } from "@/components/project/ProjectTeamCard";
import { compressPhoto, uploadPhotoWithProgress } from "@/lib/compressImage";
import { downloadProjectReportPdf } from "@/lib/projectReportPdf";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  projectStatusLabel,
  stageStatusLabel,
  useStatusLabels,
} from "@/hooks/useStatusLabels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatThousands,
  parseFormattedNumber,
  formatActivityDetails,
  formatPhoneInput,
  formatPhoneDisplay,
  phoneToStore,
} from "@/lib/format";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  MapPin,
  User,
  Calendar,
  FileText,
  ImagePlus,
  DollarSign,
  History,
  CheckCircle2,
  Circle,
  Loader2,
  Camera,
  Pencil,
  X,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  LayoutDashboard,
  Phone,
  Building2,
  Ruler,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type TabId = "overview" | "stages" | "photos" | "expenses" | "activity";

type OverviewPhoto = {
  id: number;
  file_path: string;
  comment: string | null;
  created_at: string;
};

type ExpenseCategoryRow = { category: string; amount: number };

function dayWord(n: number) {
  const abs = Math.abs(n);
  if (abs % 10 === 1 && abs % 100 !== 11) return "день";
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return "дня";
  return "дней";
}

function CircularProgress({ value, size = 120 }: { value: number; size?: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const stroke = size < 110 ? 7 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const compact = size < 110;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-orange transition-all duration-soft"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-bold tabular-nums text-ink",
            compact ? "text-xl leading-none" : "text-2xl"
          )}
        >
          {Math.round(pct)}%
        </span>
        <span className={cn("text-muted", compact ? "mt-0.5 text-[11px]" : "text-caption")}>
          готово
        </span>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const id = Number(params.id);
  const { displayName } = useAuth();
  const { project: projectLabels, stage: stageLabels } = useStatusLabels();
  const { project, setProject, loading, error, refetch } = useProject(isNaN(id) ? null : id);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [photoStageId, setPhotoStageId] = useState("");
  const [photoComment, setPhotoComment] = useState("");
  const [expensesVersion, setExpensesVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editClient, setEditClient] = useState("");
  const [editManager, setEditManager] = useState("");
  const [editForeman, setEditForeman] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editPlannedEndDate, setEditPlannedEndDate] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editObjectType, setEditObjectType] = useState("");
  const [editAreaSqm, setEditAreaSqm] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageStartDate, setEditStageStartDate] = useState("");
  const [editStageEndDate, setEditStageEndDate] = useState("");
  const [editStageResponsible, setEditStageResponsible] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [editingCommentStageId, setEditingCommentStageId] = useState<number | null>(null);
  const [editStageComment, setEditStageComment] = useState("");
  const [savingStageComment, setSavingStageComment] = useState(false);
  const [stagePhotoStageId, setStagePhotoStageId] = useState<number | null>(null);
  const [stagePhotoFile, setStagePhotoFile] = useState<File | null>(null);
  const [stagePhotoComment, setStagePhotoComment] = useState("");
  const [uploadingStagePhoto, setUploadingStagePhoto] = useState(false);
  const stagePhotoInputRef = useRef<HTMLInputElement>(null);
  const [addingSubstepStageId, setAddingSubstepStageId] = useState<number | null>(null);
  const [newSubstepName, setNewSubstepName] = useState("");
  const [skipModal, setSkipModal] = useState<{ substepId: number; name: string } | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipSaving, setSkipSaving] = useState(false);
  const [substepBusyId, setSubstepBusyId] = useState<number | null>(null);
  const [substepError, setSubstepError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState("");
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
  const [stagesInitialized, setStagesInitialized] = useState(false);
  const [overviewPhotos, setOverviewPhotos] = useState<OverviewPhoto[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryRow[]>([]);
  const [cardSettings, setCardSettings] = useState<{
    object_types: { id: number; name: string }[];
    managers: { id: number; name: string }[];
  }>({
    object_types: [
      { id: 1, name: "Коттедж" },
      { id: 2, name: "ЖК" },
      { id: 3, name: "Таунхаусы" },
      { id: 4, name: "Коммерческое здание" },
      { id: 5, name: "Реконструкция" },
    ],
    managers: [],
  });

  useEffect(() => {
    const defaults = [
      { id: 1, name: "Коттедж" },
      { id: 2, name: "ЖК" },
      { id: 3, name: "Таунхаусы" },
      { id: 4, name: "Коммерческое здание" },
      { id: 5, name: "Реконструкция" },
    ];
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : { object_types: defaults, managers: [] }))
      .then((s) =>
        setCardSettings({
          object_types: s.object_types?.length ? s.object_types : defaults,
          managers: s.managers ?? [],
        })
      )
      .catch(() => setCardSettings((prev) => ({ ...prev })));
  }, []);

  useEffect(() => {
    if (!project?.id) return;
    fetch(`/api/projects/${project.id}/photos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: OverviewPhoto[]) => {
        const sorted = [...(Array.isArray(list) ? list : [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setOverviewPhotos(sorted.slice(0, 4));
      })
      .catch(() => setOverviewPhotos([]));

    fetch(`/api/projects/${project.id}/expenses`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.expenses?.length) {
          setExpenseCategories([]);
          return;
        }
        const map = new Map<string, number>();
        for (const e of data.expenses as { category: string; amount: number }[]) {
          map.set(e.category, (map.get(e.category) || 0) + e.amount);
        }
        const rows = [...map.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);
        setExpenseCategories(rows);
      })
      .catch(() => setExpenseCategories([]));
  }, [project?.id, expensesVersion, project?.total_spent]);

  useEffect(() => {
    if (!project?.stages?.length || stagesInitialized) return;
    const current =
      project.stages.find((s) => s.status === "in_progress") ||
      project.stages.find((s) => s.status === "not_started");
    if (current) {
      setExpandedStages(new Set([current.id]));
    }
    setStagesInitialized(true);
  }, [project?.stages, stagesInitialized]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = () => setMenuOpen(false);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [menuOpen]);

  const updateStage = async (stageId: number, updates: Record<string, unknown>) => {
    if (!project) return;
    await fetch("/api/projects/" + project.id + "/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, projectId: project.id, ...updates }),
    });
    refetch();
  };

  const startEditingStage = (stage: {
    id: number;
    name: string;
    start_date: string | null;
    end_date: string | null;
    responsible?: string | null;
  }) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageStartDate(stage.start_date || "");
    setEditStageEndDate(stage.end_date || "");
    setEditStageResponsible(stage.responsible || "");
  };

  const saveStageEdit = async () => {
    if (!project || editingStageId == null) return;
    setSavingStage(true);
    try {
      await fetch("/api/projects/" + project.id + "/stages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: editingStageId,
          projectId: project.id,
          ...(editStageName.trim() && { name: editStageName.trim() }),
          start_date: editStageStartDate || null,
          end_date: editStageEndDate || null,
          responsible: editStageResponsible.trim() || null,
        }),
      });
      refetch();
      setEditingStageId(null);
    } finally {
      setSavingStage(false);
    }
  };

  const saveStageCommentQuick = async () => {
    if (!project || editingCommentStageId == null) return;
    setSavingStageComment(true);
    try {
      await fetch("/api/projects/" + project.id + "/stages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: editingCommentStageId,
          projectId: project.id,
          comment: editStageComment.trim() || null,
        }),
      });
      refetch();
      setEditingCommentStageId(null);
    } finally {
      setSavingStageComment(false);
    }
  };

  const patchLocalSubstep = (
    substepId: number,
    patch: Partial<{
      completed: boolean;
      not_required: boolean;
      skip_reason: string | null;
      on_review: boolean;
    }>
  ) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((stage) => ({
          ...stage,
          substeps: stage.substeps?.map((sub) =>
            sub.id === substepId ? { ...sub, ...patch } : sub
          ),
        })),
      };
    });
  };

  const toggleSubstep = async (substepId: number, completed: boolean) => {
    if (!project || substepBusyId === substepId) return;
    setSubstepBusyId(substepId);
    setSubstepError("");
    const prev = project.stages
      .flatMap((s) => s.substeps ?? [])
      .find((s) => s.id === substepId);
    patchLocalSubstep(substepId, {
      completed,
      ...(completed
        ? { not_required: false, on_review: false, skip_reason: null }
        : {}),
    });
    try {
      const res = await fetch(`/api/projects/${project.id}/stages/substeps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ substepId, completed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (prev) {
          patchLocalSubstep(substepId, {
            completed: prev.completed,
            not_required: prev.not_required,
            on_review: prev.on_review,
            skip_reason: prev.skip_reason ?? null,
          });
        } else {
          await refetch();
        }
        setSubstepError(json?.error || "Не удалось сохранить отметку подэтапа");
      }
    } catch {
      if (prev) {
        patchLocalSubstep(substepId, {
          completed: prev.completed,
          not_required: prev.not_required,
          on_review: prev.on_review,
          skip_reason: prev.skip_reason ?? null,
        });
      }
      setSubstepError("Ошибка сети при сохранении подэтапа");
    } finally {
      setSubstepBusyId(null);
    }
  };

  const openSkipModal = (substepId: number, name: string) => {
    setSkipModal({ substepId, name });
    setSkipReason("");
  };

  const confirmSkipSubstep = async () => {
    if (!project || !skipModal) return;
    setSkipSaving(true);
    const { substepId } = skipModal;
    const reason = skipReason.trim() || null;
    patchLocalSubstep(substepId, {
      not_required: true,
      completed: false,
      on_review: false,
      skip_reason: reason,
    });
    setSkipModal(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/stages/substeps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substepId,
          not_required: true,
          skip_reason: reason,
        }),
      });
      if (!res.ok) await refetch();
    } catch {
      await refetch();
    } finally {
      setSkipSaving(false);
    }
  };

  const markSubstepOnReview = async (substepId: number, on_review: boolean) => {
    if (!project) return;
    patchLocalSubstep(substepId, {
      on_review,
      completed: false,
      not_required: false,
      skip_reason: null,
    });
    try {
      const res = await fetch(`/api/projects/${project.id}/stages/substeps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ substepId, on_review, completed: false, not_required: false }),
      });
      if (!res.ok) await refetch();
    } catch {
      await refetch();
    }
  };

  const restoreSubstep = async (substepId: number) => {
    if (!project) return;
    patchLocalSubstep(substepId, {
      not_required: false,
      on_review: false,
      completed: false,
      skip_reason: null,
    });
    try {
      const res = await fetch(`/api/projects/${project.id}/stages/substeps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substepId,
          not_required: false,
          on_review: false,
          completed: false,
          skip_reason: null,
        }),
      });
      if (!res.ok) await refetch();
    } catch {
      await refetch();
    }
  };

  const addSubstep = async (stageId: number) => {
    if (!project || !newSubstepName.trim()) return;
    await fetch(`/api/projects/${project.id}/stages/substeps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, name: newSubstepName.trim() }),
    });
    setNewSubstepName("");
    setAddingSubstepStageId(null);
    refetch();
  };

  const uploadStagePhoto = async (stageId: number) => {
    if (!project || !stagePhotoFile) return;
    setUploadingStagePhoto(true);
    try {
      const compressed = await compressPhoto(stagePhotoFile);
      await uploadPhotoWithProgress(project.id, {
        full: compressed.full,
        thumb: compressed.thumb,
        stageId,
        comment: stagePhotoComment.trim() || null,
      });
      setStagePhotoStageId(null);
      setStagePhotoFile(null);
      setStagePhotoComment("");
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка загрузки фото");
    } finally {
      setUploadingStagePhoto(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file || !project) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressPhoto(file);
      await uploadPhotoWithProgress(project.id, {
        full: compressed.full,
        thumb: compressed.thumb,
        stageId: photoStageId || null,
        comment: photoComment || null,
      });
      setPhotoComment("");
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка загрузки фото");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleExportReport = async (mode: "full" | "client" = "full") => {
    if (!project || exportingPdf) return;
    setExportingPdf(true);
    setExportPdfError("");
    try {
      const res = await fetch(`/api/reports/${project.id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Не удалось сформировать отчёт");
      }
      const data = await res.json();
      const result = await downloadProjectReportPdf(data, {
        mode,
        authorName: displayName || data.author_name,
      });
      if (result.warnings.length) {
        setExportPdfError(`PDF сохранён. Внимание: ${result.warnings.join("; ")}`);
      }
    } catch (err) {
      setExportPdfError(err instanceof Error ? err.message : "Ошибка создания PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const startEditingCard = () => {
    if (!project) return;
    setEditClient(project.client);
    setEditManager(project.manager || "");
    setEditForeman(project.foreman || "");
    setEditStartDate(project.start_date || "");
    setEditPlannedEndDate(project.planned_end_date || "");
    setEditBudget(formatThousands(String(project.budget)));
    setEditPhone(project.phone ? project.phone.replace(/\D/g, "").replace(/^7/, "").slice(0, 10) : "");
    setEditObjectType(project.object_type || "");
    setEditAreaSqm(project.area_sqm != null ? String(project.area_sqm) : "");
    setEditNote(project.note || "");
    setIsEditingCard(true);
  };

  const saveCard = async () => {
    if (!project) return;
    const budgetNum = parseFormattedNumber(editBudget);
    setSavingCard(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: editClient.trim() || project.client,
          manager: editManager.trim() || null,
          foreman: editForeman.trim() || null,
          start_date: editStartDate || null,
          planned_end_date: editPlannedEndDate || null,
          budget: Number.isNaN(budgetNum) ? project.budget : budgetNum,
          phone: phoneToStore(editPhone),
          object_type: editObjectType.trim() || null,
          area_sqm: editAreaSqm.trim() ? Number(editAreaSqm) : null,
          note: editNote.trim() || null,
        }),
      });
      if (res.ok) {
        setIsEditingCard(false);
        refetch();
      }
    } finally {
      setSavingCard(false);
    }
  };

  const toggleStageExpand = (stageId: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const currentStage = useMemo(() => {
    if (!project?.stages?.length) return null;
    return (
      project.stages.find((s) => s.status === "in_progress") ||
      project.stages.find((s) => s.status === "not_started") ||
      project.stages[project.stages.length - 1] ||
      null
    );
  }, [project?.stages]);

  const nextStage = useMemo(() => {
    if (!project?.stages?.length || !currentStage) return null;
    const idx = project.stages.findIndex((s) => s.id === currentStage.id);
    return project.stages.slice(idx + 1).find((s) => s.status !== "completed") || null;
  }, [project?.stages, currentStage]);

  const completedStagesCount = project?.stages.filter((s) => s.status === "completed").length ?? 0;
  const totalStages = project?.stages.length ?? 0;

  const deadlineInfo = useMemo(() => {
    if (!project?.planned_end_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planned = new Date(project.planned_end_date);
    planned.setHours(0, 0, 0, 0);
    const diffDays = Math.round((planned.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    let tone: "ok" | "warn" | "late" = "ok";
    if (diffDays < 0) tone = "late";
    else if (diffDays <= 14) tone = "warn";
    return { diffDays, tone, date: project.planned_end_date };
  }, [project?.planned_end_date]);

  const budgetUsedPct =
    project && project.budget > 0
      ? Math.min(100, Math.round((project.total_spent / project.budget) * 100))
      : 0;

  const isEmptyProject =
    !!project &&
    project.stages.every((s) => s.status === "not_started" && s.progress_percent === 0) &&
    overviewPhotos.length === 0 &&
    project.total_spent === 0;

  const openCommentOnCurrent = () => {
    if (!currentStage) {
      setActiveTab("stages");
      return;
    }
    setActiveTab("stages");
    setExpandedStages((prev) => new Set(prev).add(currentStage.id));
    setEditingCommentStageId(currentStage.id);
    setEditStageComment(currentStage.comment || "");
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Обзор", icon: LayoutDashboard },
    { id: "stages", label: "Этапы", icon: CheckCircle2 },
    { id: "photos", label: "Фото", icon: ImagePlus },
    { id: "expenses", label: "Смета", icon: DollarSign },
    { id: "activity", label: "Журнал", icon: History },
  ];

  const renderStagesList = () => (
    <div className="space-y-4">
      <input
        ref={stagePhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setStagePhotoFile(e.target.files?.[0] ?? null)}
      />

      {currentStage && currentStage.status === "in_progress" && (
        <div className="rounded-[18px] border border-orange/30 bg-cream p-4 md:p-5">
          <p className="text-caption font-medium uppercase tracking-wider text-orange">Сейчас в работе</p>
          <p className="mt-1 text-lg font-semibold text-ink">{currentStage.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="tabular-nums">{currentStage.progress_percent}%</span>
            {currentStage.start_date && (
              <span>с {format(new Date(currentStage.start_date), "d MMM", { locale: ru })}</span>
            )}
            {nextStage && <span>далее: {nextStage.name}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Этапы строительства</h2>
        <p className="text-sm text-muted">
          Готово {completedStagesCount} из {totalStages} этапов
        </p>
        {substepError && (
          <p
            className="mt-2 max-w-xl rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {substepError}
          </p>
        )}
      </div>

      {project.stages.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-white px-5 py-10 text-center">
          <p className="text-muted">Этапы ещё не созданы</p>
          <p className="mt-1 text-sm text-ink-subtle">Они появятся после настройки объекта</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {project.stages.map((stage) => {
            const expanded = expandedStages.has(stage.id) || editingStageId === stage.id;
            const isDone = stage.status === "completed";
            return (
              <li
                key={stage.id}
                className={cn(
                  "rounded-[18px] border bg-white transition-colors",
                  expanded ? "overflow-visible" : "overflow-hidden",
                  isDone ? "border-line opacity-80" : "border-line shadow-[0_8px_24px_rgba(23,63,52,0.04)]",
                  stage.status === "in_progress" && "border-orange/25"
                )}
              >
                {editingStageId === stage.id ? (
                  <div className="p-4 md:p-5 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted mb-1">Название этапа</label>
                        <Input value={editStageName} onChange={(e) => setEditStageName(e.target.value)} placeholder="Название" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Начат</label>
                        <Input type="date" value={editStageStartDate} onChange={(e) => setEditStageStartDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Завершён</label>
                        <Input type="date" value={editStageEndDate} onChange={(e) => setEditStageEndDate(e.target.value)} />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-muted mb-1">Ответственный этапа</label>
                        {cardSettings.managers.length > 0 ? (
                          <Select
                            value={editStageResponsible}
                            onChange={(e) => setEditStageResponsible(e.target.value)}
                            aria-label="Ответственный этапа"
                          >
                            <option value="">Не назначен</option>
                            {cardSettings.managers.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            value={editStageResponsible}
                            onChange={(e) => setEditStageResponsible(e.target.value)}
                            placeholder="ФИО прораба / ответственного"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveStageEdit} disabled={savingStage}>
                        {savingStage ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        Сохранить
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingStageId(null)} disabled={savingStage}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleStageExpand(stage.id)}
                      className="w-full flex items-center gap-3 px-4 md:px-5 py-4 text-left hover:bg-surface/60 transition-colors"
                    >
                      <span
                        className={cn(
                          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                          isDone ? "bg-green/10" : "bg-surface"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green" />
                        ) : stage.status === "in_progress" ? (
                          <Loader2 className="w-4 h-4 text-orange" />
                        ) : (
                          <Circle className="w-4 h-4 text-ink-subtle" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-medium", isDone ? "text-muted" : "text-ink")}>{stage.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                          <StatusBadge
                            kind="stage"
                            status={stage.status}
                            label={stageStatusLabel(stageLabels, stage.status)}
                            className="h-7 min-w-0"
                          />
                          <span className="tabular-nums">{stage.progress_percent}%</span>
                          {stage.start_date && (
                            <span>с {format(new Date(stage.start_date), "d MMM", { locale: ru })}</span>
                          )}
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronDown className="w-5 h-5 text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted shrink-0" />
                      )}
                    </button>

                    {expanded && (
                      <div className="px-4 md:px-5 pb-4 md:pb-5 border-t border-line pt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-line overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", isDone ? "bg-green" : "bg-orange")}
                              style={{ width: `${Math.min(100, Math.max(0, stage.progress_percent))}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted tabular-nums shrink-0">{stage.progress_percent}%</span>
                        </div>

                        {stage.comment && <p className="text-sm text-muted">{stage.comment}</p>}

                        {(stage.substeps?.length ?? 0) > 0 && (
                          <ul className="space-y-1.5">
                            {stage.substeps!.map((sub) => (
                              <li key={sub.id} className="rounded-[10px] border border-line bg-white px-2.5 py-2">
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!sub.completed}
                                    disabled={!!sub.not_required || substepBusyId === sub.id}
                                    onChange={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void toggleSubstep(sub.id, !sub.completed);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 rounded border-line text-green"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={cn(
                                        "text-sm",
                                        sub.not_required
                                          ? "text-muted line-through"
                                          : sub.completed
                                            ? "text-muted line-through"
                                            : "text-ink"
                                      )}
                                    >
                                      {sub.name}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {sub.not_required && (
                                        <span className="rounded-full bg-[#E8EEEC] px-2 py-0.5 text-[11px] text-[#3D524A]">
                                          Не требуется
                                          {sub.skip_reason ? `: ${sub.skip_reason}` : ""}
                                        </span>
                                      )}
                                      {sub.on_review && !sub.not_required && (
                                        <span className="rounded-full bg-[#FFF6E5] px-2 py-0.5 text-[11px] text-[#8A6A20]">
                                          На проверке
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col gap-1">
                                    {!sub.not_required && !sub.completed && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-muted hover:text-ink"
                                        onClick={() => markSubstepOnReview(sub.id, !sub.on_review)}
                                      >
                                        {sub.on_review ? "Снять проверку" : "На проверку"}
                                      </button>
                                    )}
                                    {!sub.not_required && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-muted hover:text-ink"
                                        onClick={() => openSkipModal(sub.id, sub.name)}
                                      >
                                        Не требуется
                                      </button>
                                    )}
                                    {sub.not_required && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-orange hover:text-orange/80"
                                        onClick={() => restoreSubstep(sub.id)}
                                      >
                                        Вернуть
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}

                        {addingSubstepStageId === stage.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={newSubstepName}
                              onChange={(e) => setNewSubstepName(e.target.value)}
                              placeholder="Название подэтапа"
                              className="w-full sm:w-48"
                              onKeyDown={(e) => e.key === "Enter" && addSubstep(stage.id)}
                            />
                            <Button size="sm" onClick={() => addSubstep(stage.id)} disabled={!newSubstepName.trim()}>
                              Добавить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAddingSubstepStageId(null);
                                setNewSubstepName("");
                              }}
                            >
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-sm text-muted hover:text-ink"
                            onClick={() => setAddingSubstepStageId(stage.id)}
                          >
                            + Добавить подэтап
                          </button>
                        )}

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setStagePhotoStageId(stage.id);
                              setStagePhotoFile(null);
                              setStagePhotoComment("");
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink px-2.5 py-1.5 rounded-[10px] border border-line hover:bg-surface"
                            title="Добавить фото этапа"
                          >
                            <Camera className="w-4 h-4" /> фото
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentStageId(stage.id);
                              setEditStageComment(stage.comment || "");
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink px-2.5 py-1.5 rounded-[10px] border border-line hover:bg-surface"
                            title="Комментарий к этапу"
                          >
                            <MessageSquare className="w-4 h-4" /> комментарий
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingStage(stage)}
                            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink p-2 rounded-[10px] hover:bg-surface"
                            title="Редактировать этап"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <Select
                            value={stage.status}
                            onChange={(e) =>
                              updateStage(stage.id, {
                                status: e.target.value,
                                ...(e.target.value === "in_progress" && !stage.start_date
                                  ? { start_date: format(new Date(), "yyyy-MM-dd") }
                                  : {}),
                                ...(e.target.value === "completed"
                                  ? { end_date: format(new Date(), "yyyy-MM-dd"), progress_percent: 100 }
                                  : {}),
                              })
                            }
                            className="min-w-[140px] w-auto"
                            aria-label={`Статус этапа ${stage.name}`}
                          >
                            {Object.entries(stageLabels).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </Select>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={stage.progress_percent}
                            onChange={(e) => updateStage(stage.id, { progress_percent: Number(e.target.value) })}
                            className="w-14 rounded-[10px] border border-line px-2 py-2 text-sm text-center"
                          />
                          <span className="text-muted text-sm">%</span>
                        </div>

                        {editingCommentStageId === stage.id && (
                          <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
                            <Input
                              value={editStageComment}
                              onChange={(e) => setEditStageComment(e.target.value)}
                              placeholder="Комментарий к этапу"
                              className="flex-1 min-w-[200px]"
                            />
                            <Button size="sm" onClick={saveStageCommentQuick} disabled={savingStageComment}>
                              {savingStageComment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              Сохранить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCommentStageId(null)}
                              disabled={savingStageComment}
                            >
                              Отмена
                            </Button>
                          </div>
                        )}

                        {stagePhotoStageId === stage.id && (
                          <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => stagePhotoInputRef.current?.click()}
                            >
                              <Camera className="w-4 h-4 mr-1" />
                              Выбрать фото
                            </Button>
                            <span className="text-sm text-muted truncate max-w-[140px]">
                              {stagePhotoFile ? stagePhotoFile.name : "Файл не выбран"}
                            </span>
                            <Input
                              value={stagePhotoComment}
                              onChange={(e) => setStagePhotoComment(e.target.value)}
                              placeholder="Подпись к фото"
                              className="flex-1 min-w-[120px]"
                            />
                            <Button
                              size="sm"
                              onClick={() => uploadStagePhoto(stage.id)}
                              disabled={!stagePhotoFile || uploadingStagePhoto}
                            >
                              {uploadingStagePhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              Загрузить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStagePhotoStageId(null);
                                setStagePhotoFile(null);
                                setStagePhotoComment("");
                                if (stagePhotoInputRef.current) stagePhotoInputRef.current.value = "";
                              }}
                              disabled={uploadingStagePhoto}
                            >
                              Отмена
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-ink"
            aria-label="Назад к объектам"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <nav className="mb-1 hidden items-center gap-1.5 text-caption text-muted sm:flex">
              <Link href="/dashboard" className="hover:text-ink">
                Дашборд
              </Link>
              <span className="text-ink-subtle">/</span>
              <Link href="/dashboard" className="hover:text-ink">
                Объекты
              </Link>
            </nav>
            <h1 className="text-lg font-bold leading-snug tracking-tight text-ink sm:text-2xl sm:leading-8 md:text-3xl md:leading-9">
              {project.name}
            </h1>
            <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
              <span className="line-clamp-2 break-words sm:line-clamp-none">
                {project.address || "Адрес не указан"}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusBadge
                kind="project"
                status={project.status}
                label={projectStatusLabel(projectLabels, project.status)}
              />
              {project.manager && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm text-muted">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Ответственный:{" "}
                    <span className="font-medium text-ink">{project.manager}</span>
                  </span>
                </span>
              )}
            </div>
          </div>
          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveTab("overview");
                startEditingCard();
              }}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Редактировать
            </Button>
            <Button size="sm" onClick={() => void handleExportReport("full")} variant="secondary" disabled={exportingPdf}>
              {exportingPdf ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              {exportingPdf ? "PDF…" : "Отчёт PDF"}
            </Button>
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-white text-muted hover:bg-surface hover:text-ink"
                aria-label="Меню"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-[12px] border border-line bg-white py-1 shadow-soft"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-surface"
                    onClick={async () => {
                      setMenuOpen(false);
                      const newArchived = !project.archived;
                      await fetch(`/api/projects/${project.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ archived: newArchived }),
                      });
                      refetch();
                    }}
                  >
                    {project.archived ? "Восстановить из архива" : "В архив"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile action row */}
        <div className="flex gap-2 md:hidden">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-10 flex-1"
            onClick={() => {
              setActiveTab("overview");
              startEditingCard();
            }}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Изменить
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="min-h-10 flex-1"
            disabled={exportingPdf}
            onClick={() => void handleExportReport("full")}
          >
            {exportingPdf ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            {exportingPdf ? "…" : "PDF"}
          </Button>
          <div className="relative shrink-0">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-white text-muted hover:bg-surface hover:text-ink"
              aria-label="Меню"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-[12px] border border-line bg-white py-1 shadow-soft"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-surface"
                  onClick={async () => {
                    setMenuOpen(false);
                    const newArchived = !project.archived;
                    await fetch(`/api/projects/${project.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ archived: newArchived }),
                    });
                    refetch();
                  }}
                >
                  {project.archived ? "Восстановить из архива" : "В архив"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {exportPdfError && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {exportPdfError}
        </div>
      )}

      {/* Tabs — full-width on phone */}
      <div className="grid grid-cols-5 gap-1 sm:flex sm:gap-2 sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={cn(
              "inline-flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-2 text-[11px] font-medium leading-tight transition-colors sm:shrink-0 sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm",
              activeTab === tabId
                ? "bg-green text-white"
                : "border border-line bg-white text-muted hover:bg-surface hover:text-ink"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                activeTab === tabId ? "text-white" : "text-orange"
              )}
            />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4 md:space-y-6">
          {isEmptyProject && (
            <div className="rounded-[18px] border border-dashed border-line bg-surface px-5 py-6">
              <p className="font-semibold text-ink">Объект только создан</p>
              <p className="mt-1 text-sm text-muted">Начните с этих шагов:</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                <li>
                  <button type="button" className="text-orange font-medium hover:underline" onClick={startEditingCard}>
                    Заполните карточку объекта
                  </button>
                </li>
                <li>
                  <button type="button" className="text-orange font-medium hover:underline" onClick={() => setActiveTab("stages")}>
                    Отметьте текущий этап
                  </button>
                </li>
                <li>
                  <button type="button" className="text-orange font-medium hover:underline" onClick={() => setActiveTab("photos")}>
                    Добавьте первое фото
                  </button>
                </li>
                <li>
                  <button type="button" className="text-orange font-medium hover:underline" onClick={() => setActiveTab("expenses")}>
                    Добавьте позицию в смету
                  </button>
                </li>
              </ul>
            </div>
          )}

          {/* Progress + details */}
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,63,52,0.06)] sm:p-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <span className="sm:hidden">
                  <CircularProgress value={project.progress_percent} size={88} />
                </span>
                <span className="hidden sm:inline-flex">
                  <CircularProgress value={project.progress_percent} size={120} />
                </span>
                <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wider text-muted">Текущий этап</p>
                    <p className="mt-0.5 font-semibold text-ink">
                      {currentStage?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wider text-muted">Следующий шаг</p>
                    <p className="mt-0.5 text-ink">{nextStage?.name || "Все этапы завершены или не заданы"}</p>
                  </div>
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wider text-muted">Срок сдачи</p>
                    {deadlineInfo ? (
                      <p className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-block w-2 h-2 rounded-full",
                            deadlineInfo.tone === "late" && "bg-red-500",
                            deadlineInfo.tone === "warn" && "bg-orange",
                            deadlineInfo.tone === "ok" && "bg-green"
                          )}
                        />
                        <span className="text-ink">
                          {format(new Date(deadlineInfo.date), "d MMM yyyy", { locale: ru })}
                        </span>
                        {deadlineInfo.diffDays > 0 && (
                          <span className="text-muted">
                            · осталось {deadlineInfo.diffDays} {dayWord(deadlineInfo.diffDays)}
                          </span>
                        )}
                        {deadlineInfo.diffDays < 0 && (
                          <span className="text-red-600 font-medium">
                            · просрочка {Math.abs(deadlineInfo.diffDays)} {dayWord(deadlineInfo.diffDays)}
                          </span>
                        )}
                        {deadlineInfo.diffDays === 0 && (
                          <span className="text-orange font-medium">· сегодня</span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-muted">Не указан</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,63,52,0.06)] sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
                <h2 className="font-semibold text-ink">Карточка объекта</h2>
                {!isEditingCard ? (
                  <button
                    type="button"
                    onClick={startEditingCard}
                    className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="hidden sm:inline">Редактировать</span>
                    <span className="sm:hidden">Изменить</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingCard(false)} disabled={savingCard}>
                      <X className="w-4 h-4 mr-1" /> Отмена
                    </Button>
                    <Button size="sm" onClick={saveCard} disabled={savingCard}>
                      {savingCard ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Сохранить
                    </Button>
                  </div>
                )}
              </div>

              {isEditingCard ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Клиент</label>
                      <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} placeholder="Клиент" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Телефон</label>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        value={editPhone ? formatPhoneDisplay(editPhone) : ""}
                        onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))}
                        placeholder="+7 ___ ___ __ __"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Менеджер</label>
                      {cardSettings.managers.length > 0 ? (
                        <Select value={editManager} onChange={(e) => setEditManager(e.target.value)} aria-label="Менеджер">
                          <option value="">Не выбран</option>
                          {cardSettings.managers.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input value={editManager} onChange={(e) => setEditManager(e.target.value)} placeholder="ФИО" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Прораб</label>
                      {cardSettings.managers.length > 0 ? (
                        <Select value={editForeman} onChange={(e) => setEditForeman(e.target.value)} aria-label="Прораб">
                          <option value="">Не выбран</option>
                          {cardSettings.managers.map((m) => (
                            <option key={`f-${m.id}`} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input value={editForeman} onChange={(e) => setEditForeman(e.target.value)} placeholder="ФИО прораба" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Тип объекта</label>
                      {cardSettings.object_types.length > 0 ? (
                        <Select value={editObjectType} onChange={(e) => setEditObjectType(e.target.value)}>
                          <option value="">—</option>
                          {cardSettings.object_types.map((o) => (
                            <option key={o.id} value={o.name}>
                              {o.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          value={editObjectType}
                          onChange={(e) => setEditObjectType(e.target.value)}
                          placeholder="Коттедж, ЖК..."
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Площадь (м²)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editAreaSqm}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, "");
                          setEditAreaSqm(v);
                        }}
                        placeholder="250"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Дата начала</label>
                      <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
                        Планируемая сдача
                      </label>
                      <Input
                        type="date"
                        value={editPlannedEndDate}
                        onChange={(e) => setEditPlannedEndDate(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Бюджет (₽)</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editBudget}
                        onChange={(e) => setEditBudget(formatThousands(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Заметка</label>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-[12px] border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30"
                      placeholder="Заметка по объекту"
                    />
                  </div>
                </div>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Клиент
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink">{project.client || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> Телефон
                    </dt>
                    <dd className="mt-0.5 text-ink">{project.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Менеджер</dt>
                    <dd className="mt-0.5 font-medium text-ink">{project.manager || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Прораб</dt>
                    <dd className="mt-0.5 font-medium text-ink">{project.foreman || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Тип
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink">{project.object_type || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5" /> Площадь
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      {project.area_sqm != null && project.area_sqm > 0 ? `${project.area_sqm} м²` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Начало
                    </dt>
                    <dd className="mt-0.5 text-ink">
                      {project.start_date
                        ? format(new Date(project.start_date), "d MMM yyyy", { locale: ru })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Сдача
                    </dt>
                    <dd className="mt-0.5 text-ink">
                      {project.planned_end_date
                        ? format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })
                        : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-caption text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Адрес
                    </dt>
                    <dd className="mt-0.5 text-ink">{project.address || "—"}</dd>
                  </div>
                  {project.note ? (
                    <div className="sm:col-span-2 pt-2 border-t border-line">
                      <dt className="text-caption text-muted">Заметка</dt>
                      <dd className="mt-0.5 text-ink whitespace-pre-wrap">{project.note}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>
          </div>

          {/* Budget */}
          <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Бюджет</h2>
                <p className="mt-1 text-sm text-muted">Использовано {budgetUsedPct}%</p>
              </div>
              <Button
                size="sm"
                onClick={() => setActiveTab("expenses")}
                className="shrink-0 bg-orange hover:bg-orange/90 text-white border-0"
              >
                <DollarSign className="w-4 h-4 mr-1.5" />
                Добавить расход
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-caption text-muted">Бюджет</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{project.budget.toLocaleString("ru-RU")} ₽</p>
              </div>
              <div>
                <p className="text-caption text-muted">Потрачено</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                  {project.total_spent.toLocaleString("ru-RU")} ₽
                </p>
              </div>
              <div>
                <p className="text-caption text-muted">Остаток</p>
                <p
                  className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums",
                    project.budget_remaining >= 0 ? "text-green" : "text-red-600"
                  )}
                >
                  {project.budget_remaining.toLocaleString("ru-RU")} ₽
                </p>
              </div>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-line overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetUsedPct > 100 || project.budget_remaining < 0 ? "bg-red-500" : "bg-orange"
                )}
                style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
              />
            </div>

            {expenseCategories.length > 0 ? (
              <div className="mt-5 space-y-2">
                <p className="text-caption font-medium text-muted uppercase tracking-wider">По категориям</p>
                {expenseCategories.slice(0, 5).map((row) => {
                  const max = expenseCategories[0]?.amount || 1;
                  const w = Math.round((row.amount / max) * 100);
                  return (
                    <div key={row.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-ink">{row.category}</span>
                        <span className="text-muted tabular-nums">{row.amount.toLocaleString("ru-RU")} ₽</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full bg-green/70" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Расходов пока нет — добавьте первый, чтобы увидеть разбивку.</p>
            )}
          </div>

          <ProjectTeamCard projectId={project.id} />

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(
              [
                {
                  id: "photo",
                  label: "Добавить фото",
                  icon: Camera,
                  onClick: () => setActiveTab("photos"),
                },
              {
                id: "expense",
                label: "Добавить в смету",
                icon: DollarSign,
                onClick: () => setActiveTab("expenses"),
              },
                {
                  id: "comment",
                  label: "Комментарий",
                  icon: MessageSquare,
                  onClick: openCommentOnCurrent,
                },
                {
                  id: "pdf",
                  label: exportingPdf ? "Создаю PDF…" : "Отчёт PDF",
                  icon: exportingPdf ? Loader2 : FileText,
                  onClick: () => void handleExportReport("full"),
                },
              ] as const
            ).map(({ id, label, icon: Icon, onClick }) => (
              <button
                key={id}
                type="button"
                onClick={onClick}
                disabled={id === "pdf" && exportingPdf}
                className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3.5 text-left hover:bg-surface transition-colors shadow-[0_4px_16px_rgba(23,63,52,0.04)] disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cream text-orange shrink-0">
                  <Icon className={cn("h-4 w-4", id === "pdf" && exportingPdf && "animate-spin")} />
                </span>
                <span className="text-sm font-medium text-ink">{label}</span>
              </button>
            ))}
          </div>

          {/* Recent activity + photos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-ink">Последняя активность</h2>
                <button
                  type="button"
                  className="text-sm text-orange font-medium hover:underline"
                  onClick={() => setActiveTab("activity")}
                >
                  Журнал
                </button>
              </div>
              {(project.timeline_entries?.length ?? 0) > 0 ? (
                <ul className="space-y-3">
                  {project.timeline_entries!.slice(0, 5).map((entry, i) => (
                    <li key={`${entry.created_at}-${i}`} className="flex gap-3 text-sm">
                      <span className="text-ink-subtle shrink-0 w-[4.5rem]">
                        {format(new Date(entry.created_at), "d MMM", { locale: ru })}
                      </span>
                      <span className="text-muted min-w-0">
                        {formatActivityDetails(entry.details) || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : project.last_activity ? (
                <div className="text-sm">
                  <p className="text-ink-subtle">
                    {format(new Date(project.last_activity.created_at), "d MMM, HH:mm", { locale: ru })}
                  </p>
                  <p className="mt-1 text-muted">
                    {formatActivityDetails(project.last_activity.details) || "Обновление объекта"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted py-4">Пока нет записей активности</p>
              )}
            </div>

            <div className="rounded-[18px] border border-line bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-ink">Последние фото</h2>
                <button
                  type="button"
                  className="text-sm text-orange font-medium hover:underline"
                  onClick={() => setActiveTab("photos")}
                >
                  Все фото
                </button>
              </div>
              {overviewPhotos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {overviewPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setActiveTab("photos")}
                      className="aspect-square rounded-[10px] overflow-hidden bg-surface"
                    >
                      {photo.file_path.startsWith("/placeholder") ? (
                        <div className="w-full h-full flex items-center justify-center text-ink-subtle">
                          <Camera className="w-5 h-5" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.file_path}
                          alt={photo.comment || "Фото"}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted py-4">Фото ещё не загружены</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "stages" && renderStagesList()}

      {activeTab === "photos" && (
        <ProjectPhotosSection
          projectId={project.id}
          stages={project.stages}
          photoStageId={photoStageId}
          setPhotoStageId={setPhotoStageId}
          photoComment={photoComment}
          setPhotoComment={setPhotoComment}
          fileInputRef={fileInputRef}
          handlePhotoUpload={handlePhotoUpload}
          uploadingPhoto={uploadingPhoto}
          refetch={refetch}
        />
      )}

      {activeTab === "expenses" && (
        <ProjectExpensesSection
          projectId={project.id}
          reloadKey={expensesVersion}
          refetch={() => {
            setExpensesVersion((v) => v + 1);
            refetch();
          }}
        />
      )}

      {activeTab === "activity" && <ProjectActivitySection projectId={project.id} />}

      {skipModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-substep-title"
          onClick={() => !skipSaving && setSkipModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[18px] border border-line bg-white p-5 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="skip-substep-title" className="text-lg font-semibold text-ink">
              Не требуется
            </h3>
            <p className="mt-1 text-sm text-muted">
              «{skipModal.name}» будет исключён из работ. Можно указать причину.
            </p>
            <label className="mt-4 block text-sm font-medium text-ink" htmlFor="skip-reason">
              Причина <span className="font-normal text-muted">(необязательно)</span>
            </label>
            <Input
              id="skip-reason"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Например: не входит в договор"
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmSkipSubstep();
                if (e.key === "Escape") setSkipModal(null);
              }}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                disabled={skipSaving}
                onClick={() => setSkipModal(null)}
              >
                Отмена
              </Button>
              <Button
                className="bg-orange hover:bg-orange/90 text-white border-0"
                disabled={skipSaving}
                onClick={() => void confirmSkipSubstep()}
              >
                {skipSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Подтвердить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
