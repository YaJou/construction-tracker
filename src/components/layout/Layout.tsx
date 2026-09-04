import Link from "next/link";
import { cn } from "@/utils/cn";
import { LayoutDashboard, FileText, Settings } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/settings", label: "Справочники", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-white shrink-0">
        <div className="p-4 border-b border-border">
          <Link href="/" className="font-semibold text-ink text-lg tracking-tight">
            СтройУчёт
          </Link>
        </div>
        <nav className="p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors touch-target",
                "text-ink-muted hover:bg-surface-muted hover:text-ink"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
