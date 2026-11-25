"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  mergeProjectsWithClientLocal,
  replaceClientLocalProjects,
} from "@/lib/clientLocalStore";

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

const STALE_MS = 15_000;

export function useProjects(
  listType?: ProjectListType,
  statusFilter?: string,
  search?: string,
  manager?: string,
  client?: string,
  city?: string,
  foreman?: string,
  objectType?: string
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
  const fetchedAtRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProjects = useCallback(async (opts?: { silent?: boolean }) => {
    const requestId = ++requestIdRef.current;
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (listType) params.set("list", listType);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (manager) params.set("manager", manager);
      if (client) params.set("client", client);
      if (city) params.set("city", city);
      if (foreman) params.set("foreman", foreman);
      if (objectType) params.set("object_type", objectType);
      params.set("_t", String(Date.now()));
      const res = await fetch(`/api/projects?${params}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Ошибка загрузки");
      const json = await res.json();
      if (requestId !== requestIdRef.current) return;
      const remote = (json.projects ?? json) as ProjectListItem[];
      // Shared Neon store is source of truth — don't mix device-only localStorage ghosts
      setData(remote);
      replaceClientLocalProjects(
        remote.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          address: p.address,
          phone: null,
          start_date: p.start_date,
          planned_end_date: p.planned_end_date,
          status: p.status,
          budget: p.budget,
          manager: p.manager,
          object_type: null,
          area_sqm: null,
          note: null,
          archived: false,
          created_at: p.updated_at,
          updated_at: p.updated_at,
          progress_percent: p.progress_percent,
          active_stages: p.active_stages,
          total_stages: p.total_stages,
          completed_stages: p.completed_stages,
          preview_photos: p.preview_photos,
          last_activity_at: p.last_activity_at,
          last_activity_summary: p.last_activity_summary,
          today_photos_count: p.today_photos_count,
          total_spent: p.total_spent,
          storage: json.storage || "local",
        }))
      );
      if (json.filter_options) setFilterOptions(json.filter_options);
      fetchedAtRef.current = Date.now();
      setError(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      const local = mergeProjectsWithClientLocal([]) as ProjectListItem[];
      if (local.length > 0) {
        setData(local);
        setError(null);
        fetchedAtRef.current = Date.now();
      } else if (!silent) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    } finally {
      if (requestId === requestIdRef.current && !silent) setLoading(false);
    }
  }, [listType, statusFilter, search, manager, client, city, foreman, objectType]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAtRef.current < STALE_MS) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchProjects({ silent: true });
      }, 1200);
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchProjects]);

  return {
    projects: data,
    filterOptions,
    loading,
    error,
    refetch: () => fetchProjects({ silent: true }),
  };
}
