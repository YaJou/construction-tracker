"use client";

import { useState, useEffect, useCallback } from "react";

export interface StageSubstep {
  id: number;
  stage_id: number;
  name: string;
  completed: boolean;
  order_index: number;
  not_required?: boolean;
  skip_reason?: string | null;
  on_review?: boolean;
}

export interface Stage {
  id: number;
  project_id: number;
  name: string;
  order_index: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  responsible: string | null;
  comment: string | null;
  progress_percent: number;
  substeps?: StageSubstep[];
}

export interface ProjectDetail {
  id: number;
  name: string;
  client: string;
  address: string;
  phone?: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  status: string;
  budget: number;
  manager: string | null;
  foreman?: string | null;
  object_type?: string | null;
  area_sqm?: number | null;
  note?: string | null;
  progress_percent: number;
  total_spent: number;
  budget_remaining: number;
  stages: Stage[];
  archived?: boolean;
  last_activity?: { created_at: string; details: string | null } | null;
  timeline_entries?: { created_at: string; details: string | null }[];
}

export function useProject(id: number | null) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Проект не найден");
      const json = await res.json();
      setProject(json);
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const refetch = useCallback(() => fetchProject({ silent: true }), [fetchProject]);

  return { project, setProject, loading, error, refetch, reload: () => fetchProject() };
}
