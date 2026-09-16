"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import {
  LayoutDashboard,
  FileText,
  Settings,
  HardHat,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/settings", label: "Справочники", icon: Settings },
];

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="h-14 px-3 border-b border-line flex items-center">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 min-h-[44px] group"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-cream text-orange">
            <HardHat className="w-4 h-4" aria-hidden />
          </span>
          <span className="font-semibold text-ink tracking-tight group-hover:text-green transition-colors">
            СтройУчёт
          </span>
        </Link>
      </div>
      <nav className="p-2 space-y-0.5 flex-1" aria-label="Основное меню">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors duration-fast touch-target",
                active
                  ? "bg-cream text-green"
                  : "text-muted hover:bg-surface hover:text-ink"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-orange"
                  aria-hidden
                />
              )}
              <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line p-3">
        <div className="mb-2 px-1">
          <p className="text-sm font-semibold text-ink">Аккаунт</p>
          <p className="text-caption text-muted">
            Авторизация подключается. Пока доступ открыт для команды.
          </p>
          <Link
            href="/login"
            onClick={onNavigate}
            className="mt-2 inline-flex h-[42px] items-center rounded-[10px] border border-line px-3 text-sm font-medium text-ink hover:bg-surface"
          >
            Войти
          </Link>
        </div>
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-medium text-muted hover:bg-surface hover:text-ink transition-colors touch-target min-h-[42px]"
        >
          <Settings className="w-4 h-4" aria-hidden />
          Настройки
        </Link>
      </div>
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicHome = pathname === "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (isPublicHome) {
    return <div className="min-h-screen bg-page text-ink">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-surface text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden min-[901px]:flex w-[232px] min-h-screen border-r border-line bg-white shrink-0 flex-col sticky top-0 h-screen">
        <SidebarNav pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="min-[901px]:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-line bg-white flex items-center gap-3 px-4">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-[10px] border border-line p-2 text-ink min-h-[42px] min-w-[42px] hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          aria-label="Открыть меню"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-cream text-orange">
            <HardHat className="w-4 h-4" aria-hidden />
          </span>
          СтройУчёт
        </Link>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="min-[901px]:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Закрыть меню"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[232px] bg-white shadow-soft flex flex-col animate-fade-in">
            <div className="absolute right-2 top-2">
              <button
                type="button"
                className="p-2 rounded-[10px] text-muted hover:bg-surface min-h-[42px] min-w-[42px]"
                aria-label="Закрыть"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 min-[901px]:pt-0">
        <div className="w-full max-w-[1280px] mx-auto px-5 md:px-8 py-5 md:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
