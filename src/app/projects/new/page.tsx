"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import {
  formatThousands,
  parseFormattedNumber,
  formatPhoneInput,
  formatPhoneDisplay,
  phoneToStore,
} from "@/lib/format";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  Loader2,
  Upload,
  X,
  FileImage,
  MapPin,
  Check,
} from "lucide-react";

const DEFAULT_OBJECT_TYPES = [
  { id: 1, name: "Коттедж" },
  { id: 2, name: "ЖК" },
  { id: 3, name: "Таунхаусы" },
  { id: 4, name: "Коммерческое здание" },
  { id: 5, name: "Реконструкция" },
];

const DRAFT_KEY = "stroiuchot-new-project-draft";
const MAX_FILE_BYTES = 1.5 * 1024 * 1024; // совпадает с лимитом API фото

type FormState = {
  name: string;
  client: string;
  address: string;
  phone: string;
  start_date: string;
  planned_end_date: string;
  status: string;
  budget: string;
  manager: string;
  object_type: string;
  area_sqm: string;
  note: string;
};

type FieldErrors = Partial<Record<keyof FormState | "photos", string>>;

const emptyForm: FormState = {
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
};

const STEPS = [
  { id: "basic", label: "Основная информация" },
  { id: "schedule", label: "Сроки и бюджет" },
  { id: "team", label: "Команда и материалы" },
] as const;

function formatFileSize(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function fieldClass(invalid?: boolean) {
  return cn(
    "w-full h-[44px] rounded-[12px] border bg-white px-3 text-base text-ink placeholder:text-muted",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30 focus-visible:border-orange/40",
    invalid ? "border-red-400 aria-invalid" : "border-line"
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<{
    managers: { id: number; name: string }[];
    object_types: { id: number; name: string }[];
  }>({ managers: [], object_types: DEFAULT_OBJECT_TYPES });
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FormState;
        setForm({ ...emptyForm, ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : { managers: [], object_types: DEFAULT_OBJECT_TYPES }))
      .then((s) =>
        setSettings({
          managers: s.managers || [],
          object_types: s.object_types?.length ? s.object_types : DEFAULT_OBJECT_TYPES,
        })
      )
      .catch(() =>
        setSettings({ managers: [], object_types: DEFAULT_OBJECT_TYPES })
      );

    fetch("/api/projects?list=active&_t=" + Date.now(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { filter_options: {} }))
      .then((j) => setClients(j.filter_options?.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    const next = photoFiles.map((file) => ({
      file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    setPreviews(next);
    return () => {
      next.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [photoFiles]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((err) => {
      if (!err[key]) return err;
      const copy = { ...err };
      delete copy[key];
      return copy;
    });
  };

  const dateRangeError = useMemo(() => {
    if (!form.start_date || !form.planned_end_date) return "";
    if (form.planned_end_date < form.start_date) {
      return "Дата сдачи не может быть раньше даты начала";
    }
    return "";
  }, [form.start_date, form.planned_end_date]);

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const accepted: File[] = [];
    let errorMsg = "";
    for (const file of incoming) {
      const okType =
        file.type.startsWith("image/") ||
        file.type === "application/pdf" ||
        /\.(jpe?g|png|pdf)$/i.test(file.name);
      if (!okType) {
        errorMsg = "Можно загружать JPG, PNG или PDF";
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        errorMsg = `Файл «${file.name}» больше 1.5 МБ (лимит сервера)`;
        continue;
      }
      accepted.push(file);
    }
    if (errorMsg) setFieldErrors((e) => ({ ...e, photos: errorMsg }));
    else
      setFieldErrors((e) => {
        const copy = { ...e };
        delete copy.photos;
        return copy;
      });
    if (accepted.length) {
      setPhotoFiles((prev) => [...prev, ...accepted]);
    }
  }

  function removeFile(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Укажите название проекта";
    if (!form.client.trim()) errors.client = "Укажите клиента";
    if (!form.address.trim()) errors.address = "Укажите адрес объекта";
    if (dateRangeError) errors.planned_end_date = dateRangeError;
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError("Проверьте выделенные поля");
      return false;
    }
    setFormError("");
    return true;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setFormError("");
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
          if (!file.type.startsWith("image/")) continue; // API фото принимает изображения
          const fd = new FormData();
          fd.set("file", file);
          fd.set("uploadedBy", "Менеджер");
          if (
            file.name.toLowerCase().includes("план") ||
            file.name.toLowerCase().includes("plan")
          ) {
            fd.set("comment", "План");
          }
          await fetch(`/api/projects/${projectId}/photos`, {
            method: "POST",
            body: fd,
          });
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      setToast("Объект создан");
      setTimeout(() => router.push(`/projects/${projectId}`), 400);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  function fillDemo() {
    if (!isDev) return;
    setForm({
      name: "Дом на Приморской",
      client: "Иванов А.П.",
      address: "г. Примерск, ул. Приморская, 10",
      phone: "9001234567",
      start_date: new Date().toISOString().slice(0, 10),
      planned_end_date: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
      status: "planning",
      budget: "6 500 000",
      manager: settings.managers[0]?.name || "Петров С.И.",
      object_type: settings.object_types[0]?.name || "Коттедж",
      area_sqm: "87",
      note: "Сложный участок, нужна проверка грунта",
    });
  }

  const mapHref = form.address.trim()
    ? `https://yandex.ru/maps/?text=${encodeURIComponent(form.address.trim())}`
    : "";

  const actions = (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
      <Link
        href="/dashboard"
        className="inline-flex h-[44px] items-center justify-center text-sm font-semibold text-muted hover:text-ink"
      >
        Отмена
      </Link>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <button
          type="button"
          onClick={saveDraft}
          className="inline-flex h-[44px] items-center justify-center rounded-[10px] border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-page transition-colors"
        >
          {draftSaved ? "Черновик сохранён" : "Сохранить черновик"}
        </button>
        <button
          type="submit"
          form="new-project-form"
          disabled={loading}
          className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[10px] bg-orange px-5 text-sm font-semibold text-white hover:bg-orange/90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Создаём объект…
            </>
          ) : (
            "Создать объект"
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-28 min-[901px]:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-caption text-muted mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-[10px] border border-line bg-white p-2 text-ink hover:bg-page min-h-[44px] min-w-[44px]"
              aria-label="Назад к дашборду"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <nav aria-label="Хлебные крошки" className="flex items-center gap-1.5 flex-wrap">
              <Link href="/dashboard" className="hover:text-ink">
                Дашборд
              </Link>
              <span aria-hidden>/</span>
              <span className="text-ink font-medium">Новый объект</span>
            </nav>
          </div>
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-ink">
            Новый объект
          </h1>
          <p className="mt-1 text-sm text-muted">
            Добавьте объект, чтобы вести этапы, фото и расходы
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDev && (
            <button
              type="button"
              onClick={fillDemo}
              className="inline-flex h-[42px] items-center rounded-[10px] border border-dashed border-orange/40 bg-cream px-3 text-sm font-medium text-orange"
            >
              Заполнить демо-данными
            </button>
          )}
          <button
            type="button"
            onClick={saveDraft}
            className="inline-flex h-[42px] items-center rounded-[10px] border border-line bg-white px-3 text-sm font-medium text-muted hover:text-ink"
          >
            {draftSaved ? "Сохранено" : "Сохранить черновик"}
          </button>
        </div>
      </div>

      {/* Visual stepper */}
      <ol className="flex flex-col sm:flex-row gap-2 sm:gap-3" aria-label="Разделы формы">
        {STEPS.map((step, i) => (
          <li key={step.id} className="flex-1">
            <a
              href={`#section-${step.id}`}
              className="flex items-center gap-2.5 rounded-[12px] border border-line bg-white px-3 py-2.5 hover:border-orange/30 transition-colors min-h-[44px]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-orange text-caption font-bold">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-ink">{step.label}</span>
            </a>
          </li>
        ))}
      </ol>

      {formError && (
        <div
          role="alert"
          className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      <form id="new-project-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Section 1 */}
        <section
          id="section-basic"
          className="scroll-mt-24 rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-green">О проекте</h2>
            <p className="mt-1 text-sm text-muted">
              Основные сведения об объекте. Поля со звёздочкой обязательны.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
                Название проекта <span className="text-orange">*</span>
              </label>
              <input
                ref={nameRef}
                id="name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Например: Дом на Приморской"
                required
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "name-error" : "name-hint"}
                className={fieldClass(Boolean(fieldErrors.name))}
              />
              <p id="name-hint" className="mt-1 text-caption text-muted">
                Как объект будет называться в дашборде
              </p>
              {fieldErrors.name && (
                <p id="name-error" className="mt-1 text-caption text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="client" className="block text-sm font-medium text-ink mb-1.5">
                Клиент <span className="text-orange">*</span>
              </label>
              <input
                id="client"
                list="client-list"
                value={form.client}
                onChange={(e) => setField("client", e.target.value)}
                placeholder="ФИО или компания"
                required
                aria-invalid={Boolean(fieldErrors.client)}
                aria-describedby={fieldErrors.client ? "client-error" : undefined}
                className={fieldClass(Boolean(fieldErrors.client))}
              />
              <datalist id="client-list">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {fieldErrors.client && (
                <p id="client-error" className="mt-1 text-caption text-red-600">
                  {fieldErrors.client}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-ink mb-1.5">
                Телефон клиента
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={form.phone ? formatPhoneDisplay(form.phone) : ""}
                onChange={(e) => setField("phone", formatPhoneInput(e.target.value))}
                placeholder="+7 ___ ___ __ __"
                maxLength={16}
                className={fieldClass()}
              />
            </div>

            <div>
              <label htmlFor="object_type" className="block text-sm font-medium text-ink mb-1.5">
                Тип объекта
              </label>
              <select
                id="object_type"
                value={form.object_type}
                onChange={(e) => setField("object_type", e.target.value)}
                className={fieldClass()}
              >
                <option value="">Не выбран</option>
                {settings.object_types.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-ink mb-1.5">
                Адрес объекта <span className="text-orange">*</span>
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="Город, улица, номер"
                required
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={fieldErrors.address ? "address-error" : undefined}
                className={fieldClass(Boolean(fieldErrors.address))}
              />
              {fieldErrors.address && (
                <p id="address-error" className="mt-1 text-caption text-red-600">
                  {fieldErrors.address}
                </p>
              )}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-orange hover:text-orange/80 min-h-[44px]"
                >
                  <MapPin className="w-4 h-4" aria-hidden />
                  Открыть на карте
                </a>
              )}
            </div>

            <div>
              <label htmlFor="area_sqm" className="block text-sm font-medium text-ink mb-1.5">
                Площадь объекта
              </label>
              <div className="relative">
                <input
                  id="area_sqm"
                  type="text"
                  inputMode="numeric"
                  value={form.area_sqm}
                  onChange={(e) =>
                    setField("area_sqm", e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="250"
                  className={cn(fieldClass(), "pr-12")}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  м²
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section
          id="section-schedule"
          className="scroll-mt-24 rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-green">Сроки и бюджет</h2>
            <p className="mt-1 text-sm text-muted">
              Срок сдачи можно изменить позже
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-ink mb-1.5">
                Дата начала
              </label>
              <input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                className={fieldClass()}
              />
            </div>
            <div>
              <label
                htmlFor="planned_end_date"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Планируемая сдача
              </label>
              <input
                id="planned_end_date"
                type="date"
                value={form.planned_end_date}
                onChange={(e) => setField("planned_end_date", e.target.value)}
                aria-invalid={Boolean(fieldErrors.planned_end_date || dateRangeError)}
                aria-describedby="end-date-hint end-date-error"
                className={fieldClass(Boolean(fieldErrors.planned_end_date || dateRangeError))}
              />
              <p id="end-date-hint" className="mt-1 text-caption text-muted">
                Срок сдачи можно изменить позже
              </p>
              {(fieldErrors.planned_end_date || dateRangeError) && (
                <p id="end-date-error" className="mt-1 text-caption text-red-600">
                  {fieldErrors.planned_end_date || dateRangeError}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-ink mb-1.5">
                Статус
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className={fieldClass()}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-ink mb-1.5">
                Бюджет, ₽
              </label>
              <input
                id="budget"
                type="text"
                inputMode="numeric"
                value={form.budget}
                onChange={(e) => setField("budget", formatThousands(e.target.value))}
                placeholder="0"
                className={fieldClass()}
              />
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section
          id="section-team"
          className="scroll-mt-24 rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-green">Ответственные</h2>
            <p className="mt-1 text-sm text-muted">
              Назначьте ответственного за объект. Поле «Прораб» появится, когда будет в модели данных.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="manager" className="block text-sm font-medium text-ink mb-1.5">
                Ответственный
              </label>
              {settings.managers.length > 0 ? (
                <select
                  id="manager"
                  value={form.manager}
                  onChange={(e) => setField("manager", e.target.value)}
                  className={fieldClass()}
                >
                  <option value="">Не выбран</option>
                  {settings.managers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="manager"
                  value={form.manager}
                  onChange={(e) => setField("manager", e.target.value)}
                  placeholder="Иванов П.С."
                  className={fieldClass()}
                />
              )}
            </div>
          </div>
        </section>

        {/* Section 4 photos */}
        <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-green">Фото проекта или план</h2>
            <p className="mt-1 text-sm text-muted">
              Файлы загрузятся после создания объекта
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf,.jpg,.jpeg,.png,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-[18px] border-2 border-dashed px-4 py-10 text-center cursor-pointer transition-colors duration-fast min-h-[160px] flex flex-col items-center justify-center gap-2",
              dragOver
                ? "border-orange bg-cream"
                : "border-line bg-page hover:border-orange/40 hover:bg-cream/40"
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white border border-line text-orange">
              <Upload className="w-5 h-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-ink">
              Перетащите файл сюда или выберите на компьютере
            </p>
            <p className="text-caption text-muted">
              JPG или PNG, до 1.5 МБ на файл (лимит сервера)
            </p>
          </div>
          {fieldErrors.photos && (
            <p className="mt-2 text-caption text-red-600" role="alert">
              {fieldErrors.photos}
            </p>
          )}

          {previews.length > 0 && (
            <ul className="mt-4 space-y-2">
              {previews.map((item, index) => (
                <li
                  key={`${item.file.name}-${index}`}
                  className="flex items-center gap-3 rounded-[12px] border border-line bg-page px-3 py-2.5"
                >
                  {item.url ? (
                    <img
                      src={item.url}
                      alt=""
                      className="h-12 w-12 rounded-[8px] object-cover bg-white"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-white border border-line text-muted">
                      <FileImage className="w-5 h-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{item.file.name}</p>
                    <p className="text-caption text-muted">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Удалить ${item.file.name}`}
                    onClick={() => removeFile(index)}
                    className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[10px] text-muted hover:bg-white hover:text-ink"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 5 note */}
        <section className="rounded-[18px] border border-line bg-white p-5 md:p-6 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          <label htmlFor="note" className="block text-lg font-semibold text-green mb-1">
            Комментарий
          </label>
          <p className="text-sm text-muted mb-3">Необязательно — заметка по объекту</p>
          <textarea
            id="note"
            value={form.note}
            onChange={(e) => setField("note", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                /* allow submit via ctrl+enter only if desired - don't block Enter newline */
              }
            }}
            placeholder="Например: сложный участок, нужна отдельная проверка грунта…"
            rows={4}
            className="w-full rounded-[12px] border border-line bg-white px-3 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          />
        </section>

        {/* Desktop actions */}
        <div className="hidden min-[901px]:block rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
          {actions}
        </div>
      </form>

      {/* Mobile sticky actions */}
      <div className="min-[901px]:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-white/95 backdrop-blur-sm px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {actions}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 min-[901px]:bottom-8 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-[12px] bg-green text-white px-4 py-3 text-sm font-medium shadow-soft"
        >
          <Check className="w-4 h-4" aria-hidden />
          {toast}
        </div>
      )}
    </div>
  );
}
