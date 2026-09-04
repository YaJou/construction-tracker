"use client";

import Link from "next/link";
import {
  LayoutGrid,
  ImagePlus,
  DollarSign,
  FileText,
  Calendar,
  Users,
  ArrowRight,
  CheckCircle2,
  Building2,
} from "lucide-react";

const features = [
  {
    icon: LayoutGrid,
    title: "Объекты и этапы",
    text: "Ведите объекты строительства, дробите на этапы и подэтапы, отмечайте прогресс и сроки.",
  },
  {
    icon: ImagePlus,
    title: "Фото и отчёты",
    text: "Привязывайте фото к этапам и объектам, формируйте отчёты и PDF для заказчиков.",
  },
  {
    icon: DollarSign,
    title: "Бюджет и расходы",
    text: "Задавайте бюджет по объекту, фиксируйте расходы по категориям, контролируйте остаток.",
  },
  {
    icon: FileText,
    title: "Отчёты и журнал",
    text: "Печатные отчёты по объекту и полный журнал изменений и активности.",
  },
  {
    icon: Users,
    title: "Ответственные и прорабы",
    text: "Назначайте менеджеров и прорабов, фильтруйте объекты по ответственным.",
  },
  {
    icon: Calendar,
    title: "Сроки и контроль",
    text: "Планируемая сдача, дни до сдачи, индикаторы задержек и перерасхода бюджета.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-4 py-1.5 text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" />
            Учёт строительства
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-ink tracking-tight">
            СтройУчёт — объекты, этапы, фото и расходы в одном месте
          </h1>
          <p className="mt-6 text-lg text-ink-muted max-w-2xl">
            Удобный учёт этапов строительства, фото-отчёты по объектам, контроль бюджета и расходов.
            Для прорабов, руководителей и заказчиков.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-ink text-white px-6 py-3.5 text-base font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              Открыть приложение
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-white px-6 py-3.5 text-base font-semibold text-ink hover:bg-surface-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ink/20 focus:ring-offset-2"
            >
              Перейти к дашборду
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 border-t border-border">
        <h2 className="text-2xl font-semibold text-ink mb-2">Что умеет СтройУчёт</h2>
        <p className="text-ink-muted mb-10 max-w-2xl">
          Всё необходимое для контроля строительных объектов: от карточки объекта до отчёта в PDF.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-white p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/10 text-ink">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-ink">{title}</h3>
              </div>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 flex-1">
        <div className="rounded-2xl bg-ink text-white p-8 md:p-12 max-w-3xl">
          <div className="flex items-center gap-2 text-amber-300 mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Готово к работе</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">
            Начните вести учёт объектов уже сегодня
          </h2>
          <p className="mt-3 text-white/80">
            Создайте первый объект, добавьте этапы и фото — всё хранится локально и под вашим контролем.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-ink px-6 py-3.5 text-base font-semibold hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ink"
          >
            Открыть приложение
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
