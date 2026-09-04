"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Select } from "@/components/ui/Select";
import { PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS, EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatThousands, parseFormattedNumber, formatActivityDetails, formatPhoneInput, formatPhoneDisplay, phoneToStore } from "@/lib/format";
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
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function ProjectPage() {
  const params = useParams();
  const id = Number(params.id);
  const { project, loading, error, refetch } = useProject(isNaN(id) ? null : id);
  const [activeTab, setActiveTab] = useState<"stages" | "photos" | "expenses" | "activity">("stages");
  const [photoStageId, setPhotoStageId] = useState("");
  const [photoComment, setPhotoComment] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [expensesVersion, setExpensesVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editClient, setEditClient] = useState("");
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
  const [cardSettings, setCardSettings] = useState<{ object_types: { id: number; name: string }[] }>({ object_types: [] });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setCardSettings({ object_types: s.object_types || [] }));
  }, []);

  const updateStage = async (stageId: number, updates: Record<string, unknown>) => {
    if (!project) return;
    await fetch("/api/projects/" + project.id + "/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, projectId: project.id, ...updates }),
    });
    refetch();
  };

  const startEditingStage = (stage: { id: number; name: string; start_date: string | null; end_date: string | null }) => {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageStartDate(stage.start_date || "");
    setEditStageEndDate(stage.end_date || "");
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

  const toggleSubstep = async (substepId: number, completed: boolean) => {
    if (!project) return;
    await fetch(`/api/projects/${project.id}/stages/substeps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ substepId, completed }),
    });
    refetch();
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
    const form = new FormData();
    form.set("file", stagePhotoFile);
    form.set("stageId", String(stageId));
    if (stagePhotoComment.trim()) form.set("comment", stagePhotoComment.trim());
    form.set("uploadedBy", "Менеджер");
    try {
      const res = await fetch(`/api/projects/${project.id}/photos`, { method: "POST", body: form });
      if (res.ok) {
        setStagePhotoStageId(null);
        setStagePhotoFile(null);
        setStagePhotoComment("");
        refetch();
      }
    } finally {
      setUploadingStagePhoto(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file || !project) return;
    setUploadingPhoto(true);
    const form = new FormData();
    form.set("file", file);
    if (photoStageId) form.set("stageId", photoStageId);
    if (photoComment) form.set("comment", photoComment);
    form.set("uploadedBy", "Менеджер");
    try {
      const res = await fetch(`/api/projects/${project.id}/photos`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        setPhotoComment("");
        refetch();
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddExpense = async () => {
    if (!project || !expenseAmount) return;
    const numericAmount = parseFormattedNumber(expenseAmount);
    if (!numericAmount) return;
    setAddingExpense(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: expenseDate,
          category: expenseCategory,
          description: expenseDesc || null,
          amount: numericAmount,
          added_by: "Менеджер",
        }),
      });
      if (res.ok) {
        setExpenseDesc("");
        setExpenseAmount("");
        setExpensesVersion((v) => v + 1);
        refetch();
      }
    } finally {
      setAddingExpense(false);
    }
  };

  const handleExportReport = () => {
    if (!project) return;
    window.open(`/api/reports/${project.id}`, "_blank");
  };

  const startEditingCard = () => {
    if (!project) return;
    setEditClient(project.client);
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

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-ink-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const tabs = [
    { id: "stages" as const, label: "Этапы", icon: CheckCircle2 },
    { id: "photos" as const, label: "Фото", icon: ImagePlus },
    { id: "expenses" as const, label: "Расходы", icon: DollarSign },
    { id: "activity" as const, label: "Журнал", icon: History },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
            <p className="text-ink-muted mt-0.5">{project.address}</p>
            <div className="flex flex-wrap gap-2 mt-2">
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
              {project.manager && (
                <span className="text-sm text-ink-muted">Ответственный: {project.manager}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleExportReport} variant="secondary" className="shrink-0">
            <FileText className="w-4 h-4 mr-2" />
            Отчёт PDF
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="shrink-0 text-ink-muted"
            onClick={async () => {
              if (!project) return;
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
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          {project.last_activity && (
            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Последнее обновление</p>
              <p className="mt-0.5 text-sm text-ink">
                {(() => {
                  const d = new Date(project.last_activity!.created_at);
                  const today = new Date();
                  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                  return isToday ? `Сегодня ${format(d, "HH:mm")}` : format(d, "d MMM, HH:mm", { locale: ru });
                })()}
              </p>
              {project.last_activity.details && (
                <p className="mt-0.5 text-sm text-ink-muted">{formatActivityDetails(project.last_activity.details)}</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 mb-4">
            {!isEditingCard ? (
              <button
                type="button"
                onClick={startEditingCard}
                className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
              >
                <Pencil className="w-4 h-4" /> Редактировать
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Клиент</label>
                  <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} placeholder="Клиент" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Телефон</label>
                  <Input type="tel" inputMode="numeric" value={editPhone ? formatPhoneDisplay(editPhone) : ""} onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))} placeholder="+7 ___ ___ __ __" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Тип объекта</label>
                  {cardSettings.object_types.length > 0 ? (
                    <Select value={editObjectType} onChange={(e) => setEditObjectType(e.target.value)}>
                      <option value="">—</option>
                      {cardSettings.object_types.map((o) => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={editObjectType} onChange={(e) => setEditObjectType(e.target.value)} placeholder="Коттедж, ЖК..." />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Площадь (м²)</label>
                  <Input type="text" inputMode="decimal" value={editAreaSqm} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""); setEditAreaSqm(v); }} placeholder="250" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Дата начала</label>
                  <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Планируемая сдача</label>
                  <Input type="date" value={editPlannedEndDate} onChange={(e) => setEditPlannedEndDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Бюджет (₽)</label>
                  <Input type="text" inputMode="numeric" value={editBudget} onChange={(e) => setEditBudget(formatThousands(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Заметка</label>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" placeholder="Заметка по объекту" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Клиент</p>
                  <p className="mt-1 font-medium">{project.client}</p>
                </div>
                {(project.phone != null && project.phone !== "") && (
                  <div>
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Телефон</p>
                    <p className="mt-1">{project.phone}</p>
                  </div>
                )}
                {(project.object_type != null && project.object_type !== "") && (
                  <div>
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Тип объекта</p>
                    <p className="mt-1 font-medium">{project.object_type}</p>
                  </div>
                )}
                {(project.area_sqm != null && project.area_sqm > 0) && (
                  <div>
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Площадь</p>
                    <p className="mt-1 font-medium">{project.area_sqm} м²</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Дата начала</p>
                  <p className="mt-1">
                    {project.start_date
                      ? format(new Date(project.start_date), "d MMM yyyy", { locale: ru })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Планируемая сдача</p>
                  <p className="mt-1">
                    {project.planned_end_date
                      ? format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Прогресс</p>
                  <Progress value={project.progress_percent} showLabel className="mt-1" />
                </div>
              </div>
              {project.planned_end_date && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const planned = new Date(project.planned_end_date);
                planned.setHours(0, 0, 0, 0);
                const diffMs = planned.getTime() - today.getTime();
                const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
                const dayWord = (n: number) => {
                  const abs = Math.abs(n);
                  if (abs % 10 === 1 && abs % 100 !== 11) return "день";
                  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return "дня";
                  return "дней";
                };
                return (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Дней до сдачи</p>
                    <p className="mt-1">
                      Сдача: {format(new Date(project.planned_end_date), "d MMM yyyy", { locale: ru })}
                      {diffDays > 0 && (
                        <span className="text-ink ml-1">· Осталось: {diffDays} {dayWord(diffDays)}</span>
                      )}
                      {diffDays < 0 && (
                        <span className="text-red-600 font-medium ml-1">· Просрочка: {Math.abs(diffDays)} {dayWord(diffDays)}</span>
                      )}
                      {diffDays === 0 && (
                        <span className="text-amber-600 font-medium ml-1">· Сдача сегодня</span>
                      )}
                    </p>
                  </div>
                );
              })()}
              <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Бюджет</p>
                  <p className="mt-1 font-semibold">
                    {project.budget.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Потрачено</p>
                  <p className="mt-1 font-semibold text-ink">
                    {project.total_spent.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Остаток</p>
                  <p className={`mt-1 font-semibold ${project.budget_remaining >= 0 ? "text-ink" : "text-red-600"}`}>
                    {project.budget_remaining.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>
              {(project.note != null && project.note !== "") && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Заметка</p>
                  <p className="mt-1 text-ink whitespace-pre-wrap">{project.note}</p>
                </div>
              )}
              {(project.timeline_entries?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">Таймлайн стройки</p>
                  <ul className="space-y-0">
                    {project.timeline_entries!.reduce<{ date: string; items: { created_at: string; details: string | null }[] }[]>((acc, entry) => {
                      const dateKey = format(new Date(entry.created_at), "d MMM", { locale: ru });
                      const last = acc[acc.length - 1];
                      if (last && last.date === dateKey) {
                        last.items.push(entry);
                      } else {
                        acc.push({ date: dateKey, items: [entry] });
                      }
                      return acc;
                    }, []).map((group) => (
                      <li key={group.date} className="flex gap-3 py-2 first:pt-0">
                        <span className="text-sm font-medium text-ink shrink-0 w-16">{group.date}</span>
                        <ul className="flex-1 space-y-1 min-w-0">
                          {group.items.map((item, i) => {
                            const text = formatActivityDetails(item.details);
                            const withAmount = text.replace(/\s—\s(\d+)\s*₽/, (_, n) => ` — ${Number(n).toLocaleString("ru-RU")} ₽`);
                            return (
                              <li key={`${item.created_at}-${i}`} className="text-sm text-ink-muted">
                                {withAmount || "—"}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap touch-target transition-colors ${
              activeTab === id
                ? "bg-ink text-white"
                : "bg-white border border-border text-ink-muted hover:bg-surface-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "stages" && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-ink">Этапы строительства</h2>
          </CardHeader>
          <CardContent className="p-0">
            <input
              ref={stagePhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setStagePhotoFile(e.target.files?.[0] ?? null)}
            />
            <ul className="divide-y divide-border">
              {project.stages.map((stage) => (
                <li key={stage.id} className="px-5 py-4 flex flex-col gap-3">
                  {editingStageId === stage.id ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-ink-muted mb-1">Название этапа</label>
                          <Input value={editStageName} onChange={(e) => setEditStageName(e.target.value)} placeholder="Название" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-muted mb-1">Начат</label>
                          <Input type="date" value={editStageStartDate} onChange={(e) => setEditStageStartDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-muted mb-1">Завершён</label>
                          <Input type="date" value={editStageEndDate} onChange={(e) => setEditStageEndDate(e.target.value)} />
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
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-surface-muted">
                            {stage.status === "completed" ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-ink-subtle" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">{stage.name}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-ink-muted">
                              {stage.start_date && (
                                <span>Начат: {format(new Date(stage.start_date), "d MMM", { locale: ru })}</span>
                              )}
                              {stage.status === "completed" && stage.end_date && (
                                <span>Завершён: {format(new Date(stage.end_date), "d MMM", { locale: ru })}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-28 h-2.5 rounded-full bg-gray-200 overflow-hidden border border-gray-300/50">
                                <div
                                  className="h-full rounded-full bg-ink transition-all duration-200"
                                  style={{ width: `${Math.min(100, Math.max(0, stage.progress_percent))}%` }}
                                />
                              </div>
                              <span className="text-sm text-ink-muted tabular-nums shrink-0">Прогресс: {stage.progress_percent}%</span>
                            </div>
                            {stage.comment && (
                              <p className="text-sm text-ink-muted mt-1">{stage.comment}</p>
                            )}
                            {(stage.substeps?.length ?? 0) > 0 && (
                              <ul className="mt-2 space-y-1 pl-0">
                                {stage.substeps!.map((sub) => (
                                  <li key={sub.id}>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={sub.completed}
                                        onChange={() => toggleSubstep(sub.id, !sub.completed)}
                                        className="rounded border-border text-ink"
                                      />
                                      <span className={sub.completed ? "line-through text-ink-muted" : "text-ink"}>{sub.name}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {addingSubstepStageId === stage.id ? (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
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
                                <Button variant="ghost" size="sm" onClick={() => { setAddingSubstepStageId(null); setNewSubstepName(""); }}>
                                  Отмена
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-sm text-ink-muted hover:text-ink mt-2"
                                onClick={() => setAddingSubstepStageId(stage.id)}
                              >
                                + Добавить подэтап
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setStagePhotoStageId(stage.id);
                              setStagePhotoFile(null);
                              setStagePhotoComment("");
                            }}
                            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink px-2 py-1.5 rounded-lg border border-border hover:bg-surface-muted"
                            title="Добавить фото этапа"
                          >
                            📷 добавить фото
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentStageId(stage.id);
                              setEditStageComment(stage.comment || "");
                            }}
                            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink px-2 py-1.5 rounded-lg border border-border hover:bg-surface-muted"
                            title="Комментарий к этапу"
                          >
                            📝 комментарий
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingStage(stage)}
                            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink p-2 rounded-lg hover:bg-surface-muted"
                            title="Редактировать этап"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <select
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
                            className="rounded-lg border border-border px-3 py-2 text-sm min-w-[140px]"
                          >
                            {Object.entries(STAGE_STATUS_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={stage.progress_percent}
                            onChange={(e) =>
                              updateStage(stage.id, { progress_percent: Number(e.target.value) })
                            }
                            className="w-14 rounded border border-border px-2 py-2 text-sm text-center"
                          />
                          <span className="text-ink-muted text-sm">%</span>
                        </div>
                      </div>
                      {editingCommentStageId === stage.id && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
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
                          <Button variant="ghost" size="sm" onClick={() => setEditingCommentStageId(null)} disabled={savingStageComment}>
                            Отмена
                          </Button>
                        </div>
                      )}
                      {stagePhotoStageId === stage.id && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => stagePhotoInputRef.current?.click()}
                          >
                            <Camera className="w-4 h-4 mr-1" />
                            Выбрать фото
                          </Button>
                          <span className="text-sm text-ink-muted truncate max-w-[140px]">
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
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
          expenseDate={expenseDate}
          setExpenseDate={setExpenseDate}
          expenseCategory={expenseCategory}
          setExpenseCategory={setExpenseCategory}
          expenseDesc={expenseDesc}
          setExpenseDesc={setExpenseDesc}
          expenseAmount={expenseAmount}
          setExpenseAmount={setExpenseAmount}
          handleAddExpense={handleAddExpense}
          addingExpense={addingExpense}
          refetch={refetch}
        />
      )}

      {activeTab === "activity" && (
        <ProjectActivitySection projectId={project.id} />
      )}
    </div>
  );
}

function ProjectPhotosSection({
  projectId,
  stages,
  photoStageId,
  setPhotoStageId,
  photoComment,
  setPhotoComment,
  fileInputRef,
  handlePhotoUpload,
  uploadingPhoto,
  refetch,
}: {
  projectId: number;
  stages: { id: number; name: string }[];
  photoStageId: string;
  setPhotoStageId: (v: string) => void;
  photoComment: string;
  setPhotoComment: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoUpload: (file: File) => Promise<void> | void;
  uploadingPhoto: boolean;
  refetch: () => void;
}) {
  const [photos, setPhotos] = useState<{
    id: number;
    file_path: string;
    comment: string | null;
    created_at: string;
    stage_id: number | null;
  }[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activePhoto, setActivePhoto] = useState<
    { id: number; file_path: string; comment: string | null; created_at: string; stage_id: number | null } | null
  >(null);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [editPhotoComment, setEditPhotoComment] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);

  const loadPhotos = () => {
    fetch(`/api/projects/${projectId}/photos`)
      .then((r) => r.json())
      .then(setPhotos);
  };

  useEffect(() => {
    loadPhotos();
  }, [projectId, refetch]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="font-semibold text-ink">Фото-отчёты</h2>
          <Button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            variant={isAdding ? "secondary" : "primary"}
            size="lg"
            className="touch-target w-full sm:w-auto sm:ml-auto"
          >
            {isAdding ? "Отмена" : "Добавить фото"}
          </Button>
        </div>
        {isAdding && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSelectedFile(file);
                }}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                size="lg"
                className="touch-target w-full sm:w-auto"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mr-2" />
                    Выбрать фото
                  </>
                )}
              </Button>
              <span className="text-xs text-ink-muted truncate max-w-xs">
                {selectedFile ? selectedFile.name : "Файл не выбран"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={photoStageId}
                onChange={(e) => setPhotoStageId(e.target.value)}
                className="w-full sm:w-48"
              >
                <option value="">Этап не выбран</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Комментарий к фото"
                value={photoComment}
                onChange={(e) => setPhotoComment(e.target.value)}
                className="w-full sm:flex-1"
              />
              <Button
                type="button"
                onClick={async () => {
                  if (!selectedFile) {
                    alert("Выберите фото");
                    return;
                  }
                  await handlePhotoUpload(selectedFile);
                  setSelectedFile(null);
                  setPhotoStageId("");
                  setPhotoComment("");
                  setIsAdding(false);
                  loadPhotos();
                }}
                disabled={uploadingPhoto}
                size="lg"
                className="touch-target w-full sm:w-auto"
              >
                {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : "Добавить"}
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-lg overflow-hidden bg-surface-muted flex flex-col cursor-pointer relative"
              onClick={() => setActivePhoto(photo)}
            >
              <div className="flex-1 w-full relative">
                {photo.file_path.startsWith("/placeholder") ? (
                  <div className="w-full h-full flex items-center justify-center text-ink-subtle text-4xl">
                    📷
                  </div>
                ) : (
                  <img
                    src={photo.file_path}
                    alt={photo.comment || "Фото объекта"}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 rounded-lg p-1">
                  <button
                    type="button"
                    className="p-1.5 rounded text-white hover:bg-white/20"
                    title="Редактировать описание"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPhotoId(photo.id);
                      setEditPhotoComment(photo.comment || "");
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded text-white hover:bg-red-500/80"
                    title="Удалить фото"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm("Удалить это фото?")) return;
                      await fetch(`/api/projects/${projectId}/photos`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ photoId: photo.id }),
                      });
                      loadPhotos();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {editingPhotoId === photo.id ? (
                <div className="p-2 bg-white border-t flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editPhotoComment}
                    onChange={(e) => setEditPhotoComment(e.target.value)}
                    placeholder="Описание фото"
                    className="text-xs min-h-0 py-1.5"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 py-1 text-xs"
                      disabled={savingPhoto}
                      onClick={async () => {
                        setSavingPhoto(true);
                        await fetch(`/api/projects/${projectId}/photos`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ photoId: photo.id, comment: editPhotoComment.trim() || null }),
                        });
                        setSavingPhoto(false);
                        setEditingPhotoId(null);
                        loadPhotos();
                      }}
                    >
                      {savingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : "Сохранить"}
                    </Button>
                    <Button variant="ghost" size="sm" className="py-1 text-xs" onClick={() => { setEditingPhotoId(null); }} disabled={savingPhoto}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="p-2 text-xs text-ink-muted bg-white border-t line-clamp-2 min-h-[3rem]">
                  {photo.comment || "Без описания"}
                </p>
              )}
            </div>
          ))}
        </div>
        {photos.length === 0 && (
          <p className="text-center text-ink-muted py-8">Пока нет загруженных фото</p>
        )}

        {activePhoto && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm text-ink-muted">Фото объекта</span>
                <button
                  className="text-ink-muted hover:text-ink text-sm"
                  onClick={() => setActivePhoto(null)}
                >
                  Закрыть
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-black flex items-center justify-center">
                {activePhoto.file_path.startsWith("/placeholder") ? (
                  <div className="w-full h-full flex items-center justify-center text-white text-6xl">
                    📷
                  </div>
                ) : (
                  <img
                    src={activePhoto.file_path}
                    alt={activePhoto.comment || "Фото объекта"}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                )}
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
                <div className="text-sm text-ink-muted truncate">
                  {activePhoto.comment || "Без описания"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={async () => {
                      const confirmed = window.confirm("Удалить это фото?");
                      if (!confirmed) return;
                      await fetch(`/api/projects/${projectId}/photos`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ photoId: activePhoto.id }),
                      });
                      setActivePhoto(null);
                      loadPhotos();
                    }}
                  >
                    Удалить фото
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setActivePhoto(null)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectExpensesSection({
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
              <select
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink min-w-[140px] focus:outline-none focus:ring-2 focus:ring-ink/20"
              >
                <option value="">Все категории</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={expenseSort}
                onChange={(e) => setExpenseSort(e.target.value as typeof expenseSort)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink min-w-[160px] focus:outline-none focus:ring-2 focus:ring-ink/20"
              >
                <option value="date_desc">Дата: сначала новые</option>
                <option value="date_asc">Дата: сначала старые</option>
                <option value="amount_desc">Сумма: по убыванию</option>
                <option value="amount_asc">Сумма: по возрастанию</option>
                <option value="category">По категории</option>
              </select>
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

function ProjectActivitySection({ projectId }: { projectId: number }) {
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
