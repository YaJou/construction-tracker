"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { useAuth } from "@/components/auth/AuthProvider";
import { canManageSettings } from "@/lib/auth/roles";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { LoadingBlock } from "@/components/ui/Loading";

type Member = {
  id: number;
  user_id: string;
  role: AppRole;
  full_name: string | null;
};

type UserOption = {
  id: string;
  full_name: string | null;
  role: AppRole;
  role_label: string;
};

export function ProjectTeamCard({ projectId }: { projectId: number }) {
  const { role } = useAuth();
  const canEdit = canManageSettings(role);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [memberRole, setMemberRole] = useState<AppRole>("manager");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка");
      setMembers(json.members ?? []);
      if (canEdit) {
        const u = await fetch("/api/users", { cache: "no-store" });
        const uj = await u.json();
        if (u.ok) setUsers(uj.users ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки команды");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)]">
        <LoadingBlock compact label="Команда объекта…" />
      </div>
    );
  }

  const available = users.filter((u) => !members.some((m) => m.user_id === u.id));

  return (
    <div className="rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(23,63,52,0.06)] space-y-4">
      <div>
        <h2 className="font-semibold text-ink">Команда объекта</h2>
        <p className="text-sm text-muted mt-0.5">Кто видит и ведёт этот объект</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {m.full_name || m.user_id.slice(0, 8)}
              </p>
              <p className="text-caption text-muted">
                {ROLE_LABELS[m.role] || m.role}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                className="p-2 rounded-[10px] text-muted hover:text-red-600 hover:bg-red-50"
                aria-label="Убрать из команды"
                onClick={async () => {
                  if (!window.confirm("Убрать участника из объекта?")) return;
                  setSaving(true);
                  await fetch(`/api/projects/${projectId}/members`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: m.user_id }),
                  });
                  setSaving(false);
                  load();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-sm text-muted py-2">Пока никого не назначили</li>
        )}
      </ul>

      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-line">
          <Select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1"
            aria-label="Пользователь"
          >
            <option value="">Выберите пользователя</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.full_name || "Без имени") + ` · ${u.role_label}`}
              </option>
            ))}
          </Select>
          <Select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as AppRole)}
            className="sm:w-40"
            aria-label="Роль на объекте"
          >
            <option value="manager">Менеджер</option>
            <option value="foreman">Прораб</option>
            <option value="client">Клиент</option>
            <option value="owner">Руководитель</option>
          </Select>
          <Button
            disabled={saving || !userId}
            onClick={async () => {
              setSaving(true);
              setError("");
              const res = await fetch(`/api/projects/${projectId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, role: memberRole }),
              });
              const json = await res.json();
              setSaving(false);
              if (!res.ok) {
                setError(json.error || "Не удалось добавить");
                return;
              }
              setUserId("");
              load();
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
