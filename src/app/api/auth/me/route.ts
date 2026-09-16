import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, profile } = auth.ctx;
  return NextResponse.json(
    {
      user: { id: user.id, email: user.email },
      profile,
      role_label: ROLE_LABELS[profile.role],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
