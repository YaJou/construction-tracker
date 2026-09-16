"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PROJECT_STATUS_LABELS, STAGE_STATUS_LABELS } from "@/lib/constants";

type LabelsCtx = {
  project: Record<string, string>;
  stage: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<LabelsCtx>({
  project: PROJECT_STATUS_LABELS,
  stage: STAGE_STATUS_LABELS,
  loading: true,
  refresh: async () => {},
});

export function StatusLabelsProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState(PROJECT_STATUS_LABELS);
  const [stage, setStage] = useState(STAGE_STATUS_LABELS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.project_statuses)) {
        setProject(
          Object.fromEntries(j.project_statuses.map((s: { key: string; label: string }) => [s.key, s.label]))
        );
      }
      if (Array.isArray(j.stage_statuses)) {
        setStage(
          Object.fromEntries(j.stage_statuses.map((s: { key: string; label: string }) => [s.key, s.label]))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({ project, stage, loading, refresh }),
    [project, stage, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStatusLabels() {
  return useContext(Ctx);
}

export function projectStatusLabel(map: Record<string, string>, status: string) {
  return map[status] || PROJECT_STATUS_LABELS[status] || status;
}

export function stageStatusLabel(map: Record<string, string>, status: string) {
  return map[status] || STAGE_STATUS_LABELS[status] || status;
}
