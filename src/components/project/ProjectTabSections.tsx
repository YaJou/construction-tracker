"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { formatActivityDetails } from "@/lib/format";
import { LoadingBlock } from "@/components/ui/Loading";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export { ProjectPhotosSection } from "./ProjectPhotosSection";
export { ProjectExpensesSection } from "./ProjectExpensesSection";

export function ProjectActivitySection({ projectId }: { projectId: number }) {
  const [log, setLog] = useState<
    { action_type: string; details: string | null; user_name: string | null; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/activity`)
      .then((r) => r.json())
      .then(setLog)
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-ink">Журнал действий</h2>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingBlock compact label="Загрузка журнала…" />
        ) : (
          <>
            <ul className="space-y-3">
              {log.map((entry, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 text-ink-subtle">
                    {format(new Date(entry.created_at), "d MMM, HH:mm", { locale: ru })}
                  </span>
                  <span className="text-ink-muted">
                    {formatActivityDetails(entry.details) || entry.action_type}
                  </span>
                  {entry.user_name && <span className="text-ink-subtle">— {entry.user_name}</span>}
                </li>
              ))}
            </ul>
            {log.length === 0 && <p className="text-sm text-ink-muted">Пока нет записей</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
