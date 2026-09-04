"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatThousands, parseFormattedNumber, formatPhoneInput, formatPhoneDisplay, phoneToStore } from "@/lib/format";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<{ managers: { id: number; name: string }[]; object_types: { id: number; name: string }[] }>({ managers: [], object_types: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    client: "",
    address: "",
    phone: "",
    start_date: "",
    planned_end_date: "",
    status: "planning",
    budget: "",
    manager: "",
    object_type: "",
    area_sqm: "",
    note: "",
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setSettings({ managers: s.managers || [], object_types: s.object_types || [] }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.client.trim() || !form.address.trim()) {
      setError("Заполните название, клиента и адрес");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          client: form.client.trim(),
          address: form.address.trim(),
          phone: phoneToStore(form.phone),
          start_date: form.start_date || null,
          planned_end_date: form.planned_end_date || null,
          status: form.status,
          budget: form.budget ? parseFormattedNumber(form.budget) : 0,
          manager: form.manager.trim() || null,
          object_type: form.object_type.trim() || null,
          area_sqm: form.area_sqm.trim() ? Number(form.area_sqm) : null,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания");
      const projectId = data.id;

      if (photoFiles.length > 0) {
        for (const file of photoFiles) {
          const fd = new FormData();
          fd.set("file", file);
          fd.set("uploadedBy", "Менеджер");
          if (file.name.toLowerCase().includes("план") || file.name.toLowerCase().includes("plan")) {
            fd.set("comment", "План");
          }
          await fetch(`/api/projects/${projectId}/photos`, { method: "POST", body: fd });
        }
      }

      router.push(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Новый объект</h1>
          <p className="text-ink-muted text-sm mt-0.5">Добавьте объект строительства</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Название проекта *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Например: ЖК Солнечный, корпус 1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Клиент *</label>
              <Input
                value={form.client}
                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                placeholder="ООО Застройщик"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Телефон</label>
              <Input
                type="tel"
                inputMode="numeric"
                value={form.phone ? formatPhoneDisplay(form.phone) : ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
                placeholder="+7 ___ ___ __ __"
                maxLength={16}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Адрес *</label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="г. Москва, ул. Строителей, 15"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Тип объекта</label>
              <Select
                value={form.object_type}
                onChange={(e) => setForm((f) => ({ ...f, object_type: e.target.value }))}
              >
                <option value="">Не выбран</option>
                {settings.object_types.map((o) => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Площадь объекта (м²)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.area_sqm}
                onChange={(e) => setForm((f) => ({ ...f, area_sqm: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                placeholder="250"
              />
              {form.area_sqm && <span className="text-sm text-ink-muted ml-2">м²</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Дата начала</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Планируемая сдача</label>
                <Input
                  type="date"
                  value={form.planned_end_date}
                  onChange={(e) => setForm((f) => ({ ...f, planned_end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Статус</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Бюджет (₽)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: formatThousands(e.target.value) }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Ответственный</label>
              {settings.managers.length > 0 ? (
                <Select
                  value={form.manager}
                  onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))}
                >
                  <option value="">Не выбран</option>
                  {settings.managers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.manager}
                  onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))}
                  placeholder="Иванов П.С."
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Фото проекта / план</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <Camera className="w-4 h-4 mr-2" />
                {photoFiles.length ? `Выбрано файлов: ${photoFiles.length}` : "Добавить фото проекта или план"}
              </Button>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Заметка</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Строительство по индивидуальному проекту, сложный участок..."
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} fullWidth size="lg">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Создать объект"}
              </Button>
              <Link href="/dashboard" className="shrink-0">
                <Button type="button" variant="ghost" size="lg">
                  Отмена
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
