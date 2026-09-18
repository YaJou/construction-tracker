import { Suspense } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { LoadingBlock } from "@/components/ui/Loading";

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Загрузка дашборда…" />}>
      <DashboardView />
    </Suspense>
  );
}
