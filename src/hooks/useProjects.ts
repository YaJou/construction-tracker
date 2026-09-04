"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ProjectListItem {
  id: number;
  name: string;
  client: string;
  address: string;
  start_date: string | null;
  planned_end_date: string | null;
  status: string;
  budget: number;
  manager: string | null;
  progress_percent: number;
  active_stages: number;
  total_stages: number;
  completed_stages: number;
  updated_at: string;
  preview_photos?: { file_path: string; comment: string | null }[];
  last_activity_at?: string | null;
  last_activity_summary?: string | null;
  today_photos_count?: number;
  total_spent?: number;
}

export interface FilterOptions {
  managers: string[];
  clients: string[];
  cities: string[];
  responsibles: string[];
}

export type ProjectListType = "active" | "completed" | "archived";

export function useProjects(
  listType?: ProjectListType,
  statusFilter?: string,
  search?: string,
  manager?: string,
  client?: string,
  city?: string,
  foreman?: string
) {
  const [data, setData] = useState<ProjectListItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    managers: [],
    clients: [],
    cities: [],
    responsibles: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchProjects = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (listType) params.set("list", listType);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (manager) params.set("manager", manager);
      if (client) params.set("client", client);
      if (city) params.set("city", city);
      if (foreman) params.set("foreman", foreman);
      // bust any intermediate HTTP/CDN cache
      params.set("_t", String(Date.now()));
      const res = await fetch(`/api/projects?${params}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Ошибка загрузки");
      const json = await res.json();
      if (requestId !== requestIdRef.current) return;
      setData(json.projects ?? json);
      if (json.filter_options) setFilterOptions(json.filter_options);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [listType, statusFilter, search, manager, client, city, foreman]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Next.js client cache can restore dashboard without remounting;
  // refetch when user returns to the tab/window.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchProjects();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [fetchProjects]);

  return { projects: data, filterOptions, loading, error, refetch: fetchProjects };
}
