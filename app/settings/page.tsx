"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Loader2, Pencil, Trash2, Plus } from "lucide-react";

interface SettingDefaultStage {
  id: number;
  name: string;
  order_index: number;
}

interface SettingManager {
  id: number;
  name: string;
}

interface SettingStatusItem {
  key: string;
  label: string;
}

interface SettingObjectType {
  id: number;
  name: string;
}

interface SettingsData {
  default_stages: SettingDefaultStage[];
  managers: SettingManager[];
  object_types: SettingObjectType[];
  project_statuses: SettingStatusItem[];
  stage_statuses: SettingStatusItem[];
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newManagerName, setNewManagerName] = useState("");
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null);
  const [editingManagerName, setEditingManagerName] = useState("");
  const [newObjectTypeName, setNewObjectTypeName] = useState("");
  const [editingObjectTypeId, setEditingObjectTypeId] = useState<number | null>(null);
  const [editingObjectTypeName, setEditingObjectTypeName] = useState("");

  const load = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData);
  };

  useEffect(() => {
    load();
    setLoading(false);
  }, []);

  const saveSection = async (section: keyof SettingsData, value: unknown) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [section]: value }),
      });
      const updated = await res.json();
      setData(updated);
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    if (!data || !newStageName.trim()) return;
    const next = [
      ...data.default_stages,
      { id: Math.max(0, ...data.default_stages.map((s) => s.id)) + 1, name: newStageName.trim(), order_index: data.default_stages.length },
    ];
    setNewStageName("");
    saveSection("default_stages", next);
  };

  const updateStage = (id: number, name: string) => {
    if (!data) return;
    const next = data.default_stages.map((s) => (s.id === id ? { ...s, name } : s));
    saveSection("default_stages", next);
    setEditingStageId(null);
  };

  const removeStage = (id: number) => {
    if (!data || !window.confirm("Удалить этап из списка?")) return;
    const next = data.default_stages.filter((s) => s.id !== id).map((s, i) => ({ ...s, order_index: i }));
    saveSection("default_stages", next);
  };

  const addManager = () => {
    if (!data || !newManagerName.trim()) return;
    const next = [...data.managers, { id: Math.max(0, ...data.managers.map((m) => m.id)) + 1, name: newManagerName.trim() }];
    setNewManagerName("");
    saveSection("managers", next);
  };

  const updateManager = (id: number, name: string) => {
    if (!data) return;
    const next = data.managers.map((m) => (m.id === id ? { ...m, name } : m));
    saveSection("managers", next);
    setEditingManagerId(null);
  };

  const removeManager = (id: number) => {
    if (!data || !window.confirm("Удалить из списка?")) return;
    saveSection("managers", data.managers.filter((m) => m.id !== id));
  };

  const addObjectType = () => {
    if (!data || !newObjectTypeName.trim()) return;
    const next = [...(data.object_types || []), { id: Math.max(0, ...(data.object_types || []).map((o) => o.id)) + 1, name: newObjectTypeName.trim() }];
    setNewObjectTypeName("");
    saveSection("object_types", next);
  };

  const updateObjectType = (id: number, name: string) => {
    if (!data) return;
    const next = (data.object_types || []).map((o) => (o.id === id ? { ...o, name } : o));
    saveSection("object_types", next);
    setEditingObjectTypeId(null);
  };

  const removeObjectType = (id: number) => {
    if (!data || !window.confirm("Удалить тип из списка?")) return;
    saveSection("object_types", (data.object_types || []).filter((o) => o.id !== id));
  };

  const updateProjectStatus = (key: string, label: string) => {
    if (!data) return;
    const next = data.project_statuses.map((s) => (s.key === key ? { ...s, label } : s));
    saveSection("project_statuses", next);
  };

  const updateStageStatus = (key: string, label: string) => {
    if (!data) return;
    const next = data.stage_statuses.map((s) => (s.key === key ? { ...s, label } : s));
    saveSection("stage_statuses", next);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-ink-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Справочники</h1>
          <p className="text-ink-muted mt-0.5">Этапы, прорабы, статусы — варианты для выбора в объектах</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-ink">Этапы строительства</h2>
          <p className="text-sm text-ink-muted">Список этапов, которые создаются у нового объекта</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {data.default_stages
              .sort((a, b) => a.order_index - b.order_index)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                  {editingStageId === s.id ? (
                    <>
                      <Input
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && updateStage(s.id, editingStageName)}
                      />
                      <Button size="sm" onClick={() => updateStage(s.id, editingStageName)} disabled={saving}>
                        Сохранить
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingStageId(null)}>
                        Отмена
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{s.name}</span>
                      <button type="button" onClick={() => { setEditingStageId(s.id); setEditingStageName(s.name); }} className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeStage(s.id)} className="p-2 rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <Input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Название этапа"
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && addStage()}
            />
            <Button onClick={addStage} disabled={saving || !newStageName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-ink">Прорабы / Ответственные</h2>
          <p className="text-sm text-ink-muted">Список для выбора ответственного по объекту и этапам</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {data.managers.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                {editingManagerId === m.id ? (
                  <>
                    <Input
                      value={editingManagerName}
                      onChange={(e) => setEditingManagerName(e.target.value)}
                      className="flex-1 max-w-xs"
                      onKeyDown={(e) => e.key === "Enter" && updateManager(m.id, editingManagerName)}
                    />
                    <Button size="sm" onClick={() => updateManager(m.id, editingManagerName)} disabled={saving}>
                      Сохранить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingManagerId(null)}>
                      Отмена
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{m.name}</span>
                    <button type="button" onClick={() => { setEditingManagerId(m.id); setEditingManagerName(m.name); }} className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeManager(m.id)} className="p-2 rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <Input
              value={newManagerName}
              onChange={(e) => setNewManagerName(e.target.value)}
              placeholder="ФИО прораба"
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && addManager()}
            />
            <Button onClick={addManager} disabled={saving || !newManagerName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-ink">Типы объектов</h2>
          <p className="text-sm text-ink-muted">Коттедж, ЖК, таунхаусы и др. — для выбора при создании объекта</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {(data.object_types || []).map((o) => (
              <li key={o.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                {editingObjectTypeId === o.id ? (
                  <>
                    <Input
                      value={editingObjectTypeName}
                      onChange={(e) => setEditingObjectTypeName(e.target.value)}
                      className="flex-1 max-w-xs"
                      onKeyDown={(e) => e.key === "Enter" && updateObjectType(o.id, editingObjectTypeName)}
                    />
                    <Button size="sm" onClick={() => updateObjectType(o.id, editingObjectTypeName)} disabled={saving}>
                      Сохранить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingObjectTypeId(null)}>
                      Отмена
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{o.name}</span>
                    <button type="button" onClick={() => { setEditingObjectTypeId(o.id); setEditingObjectTypeName(o.name); }} className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeObjectType(o.id)} className="p-2 rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <Input
              value={newObjectTypeName}
              onChange={(e) => setNewObjectTypeName(e.target.value)}
              placeholder="Название типа"
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && addObjectType()}
            />
            <Button onClick={addObjectType} disabled={saving || !newObjectTypeName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-ink">Статусы объектов</h2>
          <p className="text-sm text-ink-muted">Подписи к статусам проекта (ключ менять нельзя)</p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {data.project_statuses.map((s) => (
              <li key={s.key} className="flex items-center gap-4">
                <span className="text-sm text-ink-muted w-32 shrink-0">{s.key}</span>
                <Input
                  defaultValue={s.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.label) updateProjectStatus(s.key, v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="max-w-xs"
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-ink">Статусы этапов</h2>
          <p className="text-sm text-ink-muted">Подписи к статусам этапа (ключ менять нельзя)</p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {data.stage_statuses.map((s) => (
              <li key={s.key} className="flex items-center gap-4">
                <span className="text-sm text-ink-muted w-32 shrink-0">{s.key}</span>
                <Input
                  defaultValue={s.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.label) updateStageStatus(s.key, v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="max-w-xs"
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
