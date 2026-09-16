"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import {
  LayoutDashboard,
  FileText,
  Settings,
  HardHat,
  UserRound,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/settings", label: "Справочники", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicHome = pathname === "/";

  if (isPublicHome) {
    return <div className="min-h-screen bg-page text-ink">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-page">
      <aside className="md:w-[232px] md:min-h-screen border-b md:border-b-0 md:border-r border-line bg-white shrink-0 flex flex-col">
        <div className="h-[72px] px-4 border-b border-line flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 min-h-[44px] group">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cream text-orange">
              <HardHat className="w-5 h-5" aria-hidden />
            </span>
            <span className="font-semibold text-ink text-lg tracking-tight group-hover:text-green transition-colors">
              СтройУчёт
            </span>
          </Link>
        </div>
        <nav className="p-2 space-y-0.5 flex-1" aria-label="Основное меню">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors touch-target",
                  active
                    ? "bg-cream text-orange"
                    : "text-muted hover:bg-surface hover:text-ink"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-muted hover:bg-surface hover:text-ink transition-colors touch-target min-h-[44px]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-green">
              <UserRound className="w-4 h-4" aria-hidden />
            </span>
            Профиль
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
