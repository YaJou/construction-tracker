import { Suspense } from "react";
import DashboardView from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted">Загрузка…</div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}
