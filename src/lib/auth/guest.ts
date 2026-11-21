import type { AppRole, Profile } from "@/lib/auth/roles";

/** Fixed synthetic guest id (not a real auth.users row). */
export const GUEST_USER_ID = "00000000-0000-4000-8000-000000000001";

/** Guest access is ON unless explicitly disabled. */
export function isGuestAccessEnabled() {
  return process.env.NEXT_PUBLIC_GUEST_ACCESS !== "false";
}

export function guestProfile(): Profile {
  return {
    id: GUEST_USER_ID,
    full_name: "Гость",
    role: "owner" as AppRole,
    is_active: true,
  };
}

export function guestUser() {
  return { id: GUEST_USER_ID, email: "guest@local" };
}
