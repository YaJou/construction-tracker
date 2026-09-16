"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  HardHat,
  Menu,
  X,
  Check,
  ArrowRight,
  LayoutGrid,
  Camera,
  Wallet,
  Users,
  FileText,
  CalendarClock,
  ImageOff,
  HelpCircle,
  MessageSquareWarning,
  Files,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";

const NAV_LINKS = [
  { href: "#features", label: "Возможности" },
  { href: "#how", label: "Как это работает" },
  { href: "#audience", label: "Для кого" },
  { href: "#faq", label: "Вопросы" },
];

const AUDIENCE = {
  foreman: {
    label: "Прораб",
    text: "Фиксируйте работу на объекте без таблиц и переписок в чатах.",
    benefits: [
      "Отмечайте этапы и прикрепляйте фото прямо с площадки",
      "Вносите расходы по категориям за минуту",
      "Держите комментарии и историю в карточке объекта",
    ],
  },
  manager: {
    label: "Руководитель",
    text: "Смотрите прогресс, бюджет и риски по всем объектам в одном экране.",
    benefits: [
      "Сводка по объектам, срокам и перерасходу",
      "Понятные отчёты без ручной сборки",
      "Контроль ответственных и зон работ",
    ],
  },
  client: {
    label: "Заказчик",
    text: "Видите, что сделано и сколько потрачено — без лишних звонков.",
    benefits: [
      "Прогресс по этапам с фотоподтверждением",
      "Прозрачные расходы и остаток бюджета",
      "Аккуратный отчёт в PDF по запросу",
    ],
  },
} as const;

type AudienceKey = keyof typeof AUDIENCE;

const FAQ = [
  {
    q: "Кому подходит СтройУчёт?",
    a: "Прорабам, руководителям подрядных компаний и заказчикам, которым важно видеть этапы, фото и расходы по объектам в одном месте.",
  },
  {
    q: "Можно ли вести несколько объектов?",
    a: "Да. Каждый объект — отдельная карточка со своими этапами, фото, бюджетом и журналом изменений.",
  },
  {
    q: "Как прикреплять фото?",
    a: "Загружайте фото в карточку объекта и при необходимости привязывайте к этапу. Дата и подпись сохраняются вместе со снимком.",
  },
  {
    q: "Как формируется отчёт?",
    a: "Отчёт собирается из данных объекта: этапы, прогресс, фото и расходы. Его можно открыть и сохранить в PDF через печать браузера.",
  },
  {
    q: "Где хранятся данные?",
    a: "Рабочие данные проекта хранятся в вашей базе (Supabase). Доступ к приложению и объектам контролируете вы.",
  },
];

function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[72px] bg-white/95 backdrop-blur-sm border-b border-line",
        scrolled && "shadow-soft"
      )}
    >
      <div className="mx-auto flex h-full max-w-content items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 min-h-[44px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-cream text-orange">
            <HardHat className="w-5 h-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink">
            СтройУчёт
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Разделы страницы">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-btn text-sm font-medium text-muted hover:text-ink hover:bg-surface transition-colors duration-fast min-h-[44px] inline-flex items-center"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden sm:flex items-center gap-2">
          <Link
            href="/login"
            className="px-3 py-2 rounded-btn text-sm font-medium text-muted hover:text-ink transition-colors duration-fast min-h-[44px] inline-flex items-center"
          >
            Войти
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-btn bg-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 transition-colors duration-fast min-h-[44px]"
          >
            Открыть приложение
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden inline-flex items-center justify-center rounded-btn border border-line p-2.5 text-ink min-h-[44px] min-w-[44px] hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="lg:hidden border-t border-line bg-white px-5 py-4 space-y-1 shadow-soft"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-btn px-3 py-3 text-base font-medium text-ink hover:bg-surface min-h-[44px]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-btn border border-line px-4 py-3 text-sm font-semibold text-ink min-h-[44px]"
              onClick={() => setOpen(false)}
            >
              Войти
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-btn bg-orange px-4 py-3 text-sm font-semibold text-white min-h-[44px]"
              onClick={() => setOpen(false)}
            >
              Открыть приложение
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function AppPreview() {
  const projects = [
    { name: "Дом 87 м²", progress: 65, spent: "420 000 ₽", status: "Фундамент" },
    { name: "Таунхаус, уч. 12", progress: 38, spent: "186 000 ₽", status: "Стены" },
    { name: "Коттедж «Сосны»", progress: 82, spent: "910 000 ₽", status: "Отделка" },
  ];

  return (
    <div className="relative">
      <div className="rounded-card border border-line bg-white p-4 sm:p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-caption text-muted">Дашборд</p>
            <h3 className="text-lg font-semibold text-ink">Объекты</h3>
          </div>
          <span className="rounded-btn bg-cream text-orange text-caption font-medium px-2.5 py-1">
            Активные
          </span>
        </div>
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.name}
              className="rounded-field border border-line bg-page p-3.5"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-ink text-sm">{p.name}</p>
                  <p className="text-caption text-muted mt-0.5">{p.status}</p>
                </div>
                <p className="text-caption font-medium text-ink shrink-0">{p.spent}</p>
              </div>
              <div className="h-2 rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-caption text-muted">{p.progress}% готовности</p>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -left-2 sm:-left-4 top-8 rounded-btn bg-white border border-line shadow-soft px-3 py-2 text-caption font-medium text-green flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-orange" aria-hidden />
        Этап закрыт
      </div>
      <div className="absolute -right-1 sm:-right-3 bottom-16 rounded-btn bg-white border border-line shadow-soft px-3 py-2 text-caption font-medium text-ink">
        − 128 500 ₽ расходов
      </div>
    </div>
  );
}

function ObjectPreview() {
  return (
    <div className="rounded-card border border-line bg-white p-5 sm:p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-caption text-muted">Карточка объекта</p>
          <h3 className="text-xl font-semibold text-ink mt-1">Дом 87 м²</h3>
          <p className="text-caption text-muted mt-1">СНТ Малинки · заказчик Иванов</p>
        </div>
        <span className="rounded-btn bg-surface text-green text-caption font-medium px-2.5 py-1">
          В строительстве
        </span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Готовность", value: "65%" },
          { label: "Фото", value: "8" },
          { label: "Расходы", value: "420 000 ₽" },
        ].map((item) => (
          <div key={item.label} className="rounded-field bg-page border border-line p-3">
            <p className="text-caption text-muted">{item.label}</p>
            <p className="text-lg font-semibold text-ink mt-1">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        {[
          { name: "Подготовка участка", done: true },
          { name: "Фундамент", done: false, current: true },
          { name: "Стены", done: false },
        ].map((s) => (
          <div
            key={s.name}
            className={cn(
              "flex items-center justify-between rounded-field border px-3 py-2.5",
              s.current ? "border-orange/40 bg-cream/60" : "border-line bg-white"
            )}
          >
            <span className="text-sm font-medium text-ink">{s.name}</span>
            <span className="text-caption text-muted">
              {s.done ? "Завершён" : s.current ? "В работе" : "Не начат"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: { q: string; a: string };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 py-4 text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 rounded-btn"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="font-semibold text-ink text-base md:text-[17px]">{item.q}</span>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-muted shrink-0 transition-transform duration-soft",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </h3>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-soft ease-out",
          open ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-body text-muted pr-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [audience, setAudience] = useState<AudienceKey>("foreman");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const current = AUDIENCE[audience];

  const features = [
    {
      icon: LayoutGrid,
      title: "Объекты и этапы",
      text: "Этапы, подэтапы, сроки и процент готовности по каждому объекту.",
    },
    {
      icon: Camera,
      title: "Фотоотчёты",
      text: "Фото с датой, подписью и привязкой к этапу — без потери в чатах.",
    },
    {
      icon: Wallet,
      title: "Бюджет и расходы",
      text: "План, факт, категории и остаток бюджета на одном экране.",
    },
    {
      icon: Users,
      title: "Ответственные",
      text: "Прорабы, подрядчики и зоны ответственности по объекту.",
    },
    {
      icon: FileText,
      title: "Отчёты для заказчика",
      text: "Аккуратный PDF без ручной сборки из таблиц и переписок.",
    },
    {
      icon: CalendarClock,
      title: "Сроки и контроль",
      text: "Ближайшие задачи и просрочки — сразу видно, где риск.",
    },
  ];

  const painPoints = [
    { icon: ImageOff, title: "Потерянные фото", text: "Снимки разбросаны по чатам и телефонам" },
    { icon: HelpCircle, title: "Непонятные расходы", text: "Сложно сверить план и факт без сводки" },
    { icon: MessageSquareWarning, title: "Вопросы «что сделано»", text: "Статус объекта выясняется звонками" },
    { icon: Files, title: "Разрозненные отчёты", text: "PDF собирается вручную перед встречей" },
  ];

  const steps = [
    {
      n: "01",
      title: "Создайте объект",
      text: "Адрес, заказчик, бюджет и сроки — в одной карточке.",
    },
    {
      n: "02",
      title: "Отмечайте работу",
      text: "Этап, фото, комментарий и расходы по мере хода стройки.",
    },
    {
      n: "03",
      title: "Покажите результат",
      text: "Заказчик видит прогресс, руководитель — цифры и риски.",
    },
  ];

  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero */}
        <section className="bg-page">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-[84px]">
            <div className="grid lg:grid-cols-[48%_52%] gap-10 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center rounded-btn bg-cream text-orange px-3 py-1.5 text-caption font-medium">
                  Учёт строительства без хаоса
                </span>
                <h1 className="mt-5 text-h1-mobile md:text-h1 text-ink tracking-tight">
                  Все объекты, этапы и расходы — под контролем
                </h1>
                <p className="mt-5 text-body text-muted max-w-xl">
                  СтройУчёт помогает прорабу, руководителю и заказчику видеть, что сделано,
                  сколько потрачено и что дальше
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-btn bg-orange px-5 py-3.5 text-base font-semibold text-white hover:bg-orange/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 transition-colors duration-fast min-h-[44px] w-full sm:w-auto"
                  >
                    Открыть приложение
                    <ArrowRight className="w-5 h-5" aria-hidden />
                  </Link>
                  <a
                    href="#how"
                    className="inline-flex items-center justify-center rounded-btn border border-line bg-white px-5 py-3.5 text-base font-semibold text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-green/30 focus-visible:ring-offset-2 transition-colors duration-fast min-h-[44px] w-full sm:w-auto"
                  >
                    Посмотреть, как работает
                  </a>
                </div>
                <ul className="mt-8 space-y-2.5">
                  {[
                    "Фото привязаны к этапам",
                    "Отчёт за пару минут",
                    "Данные хранятся локально",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-ink">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green/10 text-green">
                        <Check className="w-3.5 h-3.5" aria-hidden />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:pl-4 overflow-x-clip">
                <AppPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-line bg-white" aria-label="Для кого сервис">
          <div className="mx-auto max-w-content px-5 md:px-8 py-8 md:py-10">
            <p className="text-center text-sm md:text-base text-muted">
              Для прорабов · руководителей · подрядчиков · заказчиков
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                "1 место для всех объектов",
                "Фото и отчёты по этапам",
                "Понятно заказчику без звонков",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-card border border-line bg-page px-4 py-4 text-center text-sm font-semibold text-ink"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pain points */}
        <section className="bg-cream/70">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
              <div>
                <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight">
                  Меньше таблиц и чатов — больше контроля
                </h2>
                <p className="mt-4 text-body text-muted max-w-md">
                  Всё, что обычно теряется между объектами, переписками и Excel, собирается в одной
                  системе.
                </p>
              </div>
              <ul className="grid sm:grid-cols-2 gap-4">
                {painPoints.map(({ icon: Icon, title, text }) => (
                  <li
                    key={title}
                    className="rounded-card border border-line/80 bg-white p-4"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-field bg-surface text-green">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <p className="mt-3 font-semibold text-ink">{title}</p>
                    <p className="mt-1 text-caption text-muted">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-8 text-sm md:text-base font-medium text-green">
              СтройУчёт собирает это в одну карточку объекта
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-white scroll-mt-24">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight max-w-2xl">
              Всё, что нужно для ведения объекта
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-card border border-line bg-page p-5 hover:shadow-soft transition-shadow duration-soft"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-field bg-surface text-ink">
                    <Icon className="w-5 h-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                  <a
                    href="#how"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange hover:text-orange/80 min-h-[44px]"
                  >
                    Подробнее
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-page scroll-mt-24">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight max-w-2xl">
              От объекта до отчёта — три шага
            </h2>
            <div className="mt-10 grid lg:grid-cols-2 gap-10 lg:gap-12 items-start">
              <ol className="space-y-5">
                {steps.map((s) => (
                  <li
                    key={s.n}
                    className="rounded-card border border-line bg-white p-5 flex gap-4"
                  >
                    <span className="text-caption font-bold text-orange shrink-0 pt-0.5">
                      {s.n}
                    </span>
                    <div>
                      <h3 className="font-semibold text-ink text-lg">{s.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <ObjectPreview />
            </div>
          </div>
        </section>

        {/* Audience */}
        <section id="audience" className="bg-white scroll-mt-24">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight">
              Для кого
            </h2>
            <div
              className="mt-6 inline-flex flex-wrap gap-1 rounded-field bg-surface p-1"
              role="tablist"
              aria-label="Роли"
            >
              {(Object.keys(AUDIENCE) as AudienceKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={audience === key}
                  className={cn(
                    "rounded-btn px-4 py-2.5 text-sm font-semibold min-h-[44px] transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40",
                    audience === key
                      ? "bg-white text-ink shadow-soft"
                      : "text-muted hover:text-ink"
                  )}
                  onClick={() => setAudience(key)}
                >
                  {AUDIENCE[key].label}
                </button>
              ))}
            </div>
            <div
              key={audience}
              role="tabpanel"
              className="mt-8 max-w-2xl animate-fade-in"
            >
              <p className="text-body text-ink font-medium">{current.text}</p>
              <ul className="mt-5 space-y-3">
                {current.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm leading-6 text-muted">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream text-orange shrink-0">
                      <Check className="w-3.5 h-3.5" aria-hidden />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Trust / security */}
        <section className="bg-green text-white">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <h2 className="text-[28px] leading-9 md:text-h2 tracking-tight text-white max-w-2xl">
              Понятно, что происходит на каждом объекте
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "История изменений",
                "Фото по датам",
                "Прозрачные расходы",
                "Отчёт в PDF",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-card border border-white/10 bg-white/5 px-4 py-5"
                >
                  <span className="mb-3 block h-1.5 w-1.5 rounded-full bg-orange" aria-hidden />
                  <p className="font-semibold text-white">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mini demo */}
        <section className="bg-surface">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight">
                  Посмотрите пример объекта
                </h2>
                <p className="mt-2 text-caption font-medium text-orange">
                  Демонстрационные данные
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-btn bg-orange px-5 py-3 text-sm font-semibold text-white hover:bg-orange/90 min-h-[44px] transition-colors duration-fast"
              >
                Открыть демо
              </Link>
            </div>
            <div className="rounded-card border border-line bg-white p-5 sm:p-6 shadow-soft max-w-3xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">Дом 87 м²</p>
                  <p className="text-caption text-muted mt-1">Этап: Фундамент</p>
                </div>
                <span className="rounded-btn bg-cream text-orange text-caption font-semibold px-2.5 py-1">
                  65% готовности
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-field bg-page border border-line p-3">
                  <p className="text-caption text-muted">Фото</p>
                  <p className="mt-1 font-semibold text-ink">8</p>
                </div>
                <div className="rounded-field bg-page border border-line p-3">
                  <p className="text-caption text-muted">Расход</p>
                  <p className="mt-1 font-semibold text-ink">420 000 ₽</p>
                </div>
                <div className="rounded-field bg-page border border-line p-3 col-span-2 sm:col-span-1">
                  <p className="text-caption text-muted">Статус</p>
                  <p className="mt-1 font-semibold text-ink">В работе</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white scroll-mt-24">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <h2 className="text-[28px] leading-9 md:text-h2 text-ink tracking-tight">
              Вопросы
            </h2>
            <div className="mt-8 max-w-3xl">
              {FAQ.map((item, i) => (
                <FaqItem
                  key={item.q}
                  item={item}
                  open={faqOpen === i}
                  onToggle={() => setFaqOpen(faqOpen === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-page">
          <div className="mx-auto max-w-content px-5 md:px-8 py-14 md:py-20">
            <div className="rounded-cta bg-green text-white px-6 py-10 md:px-12 md:py-14 shadow-soft">
              <h2 className="text-[28px] leading-9 md:text-h2 tracking-tight max-w-2xl">
                Начните вести первый объект сегодня
              </h2>
              <p className="mt-4 text-body text-white/80 max-w-xl">
                Создайте карточку объекта и добавьте первый этап — это займёт пару минут
              </p>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-btn bg-white px-5 py-3.5 text-base font-semibold text-green hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green transition-colors duration-fast min-h-[44px]"
                >
                  Открыть приложение
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-white/90 hover:text-white underline-offset-4 hover:underline min-h-[44px] inline-flex items-center"
                >
                  Перейти к дашборду
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-green text-white">
        <div className="mx-auto max-w-content px-5 md:px-8 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-white/10 text-orange">
                  <HardHat className="w-5 h-5" aria-hidden />
                </span>
                <span className="font-semibold text-lg">СтройУчёт</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/75 max-w-sm">
                Учёт объектов, этапов, фотоотчётов и расходов для строительных команд.
              </p>
            </div>
            <div>
              <p className="text-caption font-semibold text-white/50 uppercase tracking-wide">
                Разделы
              </p>
              <ul className="mt-3 space-y-1">
                <li>
                  <a href="#features" className="text-sm text-white/85 hover:text-white min-h-[44px] inline-flex items-center">
                    Возможности
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-sm text-white/85 hover:text-white min-h-[44px] inline-flex items-center">
                    Помощь
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-caption font-semibold text-white/50 uppercase tracking-wide">
                Контакты
              </p>
              <ul className="mt-3 space-y-1">
                <li>
                  <a href="#faq" className="text-sm text-white/85 hover:text-white min-h-[44px] inline-flex items-center">
                    Документы
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-sm text-white/85 hover:text-white min-h-[44px] inline-flex items-center">
                    Контакты
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 text-caption text-white/50">
            © {new Date().getFullYear()} СтройУчёт. Учёт строительства объектов.
          </div>
        </div>
      </footer>

    </>
  );
}
