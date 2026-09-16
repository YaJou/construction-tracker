export type AppRole = "owner" | "manager" | "foreman" | "client";

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Руководитель",
  manager: "Менеджер",
  foreman: "Прораб",
  client: "Клиент",
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

export function canWrite(role: AppRole | null | undefined) {
  return role === "owner" || role === "manager" || role === "foreman";
}

export function canManageSettings(role: AppRole | null | undefined) {
  return role === "owner" || role === "manager";
}

export function canManageBudget(role: AppRole | null | undefined) {
  return role === "owner" || role === "manager";
}

export function canEditAllProjects(role: AppRole | null | undefined) {
  return role === "owner";
}

export function displayName(profile: Profile | null, email?: string | null) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (email) return email.split("@")[0] || email;
  return "Пользователь";
}
