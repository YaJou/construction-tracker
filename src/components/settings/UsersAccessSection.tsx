"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { LoadingBlock } from "@/components/ui/Loading";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { cn } from "@/utils/cn";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2, Search, Users } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  role_label: string;
  is_active: boolean;
  created_at: string | null;
  project_ids: number[];
};

type ProjectOption = {
  id: number;
  name: string;
  status: string;
  archived: boolean;
  address: string | null;
};

export function UsersAccessSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [memberRole, setMemberRole] = useState<AppRole>("manager");
  const [projectFilter, setProjectFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setUsers(json.users ?? []);
      setProjects(json.projects ?? []);
      setCanManageRoles(Boolean(json.can_manage_roles));
      setSelectedId((prev) => {
        const list: UserRow[] = json.users ?? [];
        if (prev && list.some((u) => u.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selected.project_ids));
    setMemberRole(selected.role === "owner" ? "manager" : selected.role);
  }, [selected?.id, selected?.project_ids.join(",")]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${u.full_name || ""} ${u.email || ""} ${u.role_label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const filteredProjects = useMemo(() => {
    const q = projectFilter.trim().toLowerCase();
    const list = projects.filter((p) => !p.archived);
    if (!q) return list;
    return list.filter((p) => {
      const hay = `${p.name} ${p.address || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, projectFilter]);

  const toggleProject = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveAccess = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/users/${selected.id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIds: [...selectedIds],
          role: memberRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить доступ");
      setOk(
        `Доступ обновлён: +${json.added || 0}, −${json.removed || 0}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const patchUser = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить");
      setOk("Сохранено");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingBlock compact label="Загрузка пользователей…" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <Users className="w-5 h-5 text-orange" aria-hidden />
          Пользователи и доступ
        </h2>
        <p className="text-sm text-muted mt-1">
          Кто зарегистрировался в приложении — выдайте доступ к нужным объектам
          или заберите его.
        </p>
      </div>

      {error && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-[12px] border border-green/20 bg-green/5 px-3 py-2 text-sm text-green">
          {ok}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти по имени или email"
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ul className="rounded-[18px] border border-line bg-white divide-y divide-line overflow-hidden max-h-[70vh] overflow-y-auto">
          {filteredUsers.length === 0 && (
            <li className="px-4 py-8 text-sm text-muted text-center">
              Пока никто не зарегистрировался
            </li>
          )}
          {filteredUsers.map((u) => {
            const active = u.id === selectedId;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors",
                    active ? "bg-cream" : "hover:bg-page"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {u.full_name || "Без имени"}
                      </p>
                      <p className="text-caption text-muted truncate">
                        {u.email || "email появится после входа / SQL"}
                      </p>
                    </div>
                    {!u.is_active && (
                      <span className="text-[11px] font-medium text-red-600 shrink-0">
                        отключён
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-caption text-muted">
                    <span>{u.role_label}</span>
                    <span>·</span>
                    <span>
                      {u.project_ids.length
                        ? `${u.project_ids.length} объект(ов)`
                        : "нет доступа"}
                    </span>
                    {u.created_at && (
                      <>
                        <span>·</span>
                        <span>
                          {format(new Date(u.created_at), "d MMM yyyy", {
                            locale: ru,
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-[18px] border border-line bg-white p-4 md:p-5 space-y-4">
          {!selected ? (
            <p className="text-sm text-muted py-8 text-center">
              Выберите пользователя слева
            </p>
          ) : (
            <>
              <div>
                <h3 className="font-semibold text-ink">
                  {selected.full_name || "Без имени"}
                </h3>
                <p className="text-sm text-muted">{selected.email || "—"}</p>
              </div>

              {canManageRoles && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={selected.role}
                    onChange={(e) =>
                      void patchUser({ role: e.target.value as AppRole })
                    }
                    aria-label="Роль в приложении"
                    className="flex-1"
                  >
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={() =>
                      void patchUser({ is_active: !selected.is_active })
                    }
                  >
                    {selected.is_active ? "Отключить" : "Включить"}
                  </Button>
                </div>
              )}

              <div className="border-t border-line pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">Доступ к объектам</p>
                    <p className="text-caption text-muted">
                      Отметьте объекты — человек увидит только их
                    </p>
                  </div>
                  <Select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as AppRole)}
                    aria-label="Роль на объектах"
                    className="sm:w-40"
                  >
                    <option value="manager">Менеджер</option>
                    <option value="foreman">Прораб</option>
                    <option value="client">Клиент</option>
                  </Select>
                </div>

                <Input
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  placeholder="Фильтр объектов"
                />

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setSelectedIds(new Set(filteredProjects.map((p) => p.id)))
                    }
                  >
                    Выбрать все
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Снять все
                  </Button>
                </div>

                <ul className="max-h-[42vh] overflow-y-auto space-y-1 rounded-[12px] border border-line p-2">
                  {filteredProjects.length === 0 && (
                    <li className="text-sm text-muted py-4 text-center">
                      Нет объектов
                    </li>
                  )}
                  {filteredProjects.map((p) => {
                    const checked = selectedIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          className={cn(
                            "flex items-start gap-3 rounded-[10px] px-2.5 py-2 cursor-pointer",
                            checked ? "bg-cream" : "hover:bg-page"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleProject(p.id)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink truncate">
                              {p.name}
                            </span>
                            {p.address && (
                              <span className="block text-caption text-muted truncate">
                                {p.address}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  fullWidth
                  disabled={saving}
                  onClick={() => void saveAccess()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Сохранить доступ ({selectedIds.size})
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
