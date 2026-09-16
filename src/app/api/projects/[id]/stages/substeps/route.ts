import { NextResponse } from "next/server";
import { requireWriteAuth } from "@/lib/auth/requireAuth";
import { assertProjectAccess } from "@/lib/auth/projectAccess";

export const dynamic = "force-dynamic";

function getProjectIdFromUrl(url: string): number {
  const segments = new URL(url).pathname.split("/");
  const idx = segments.indexOf("projects");
  return Number(idx >= 0 ? segments[idx + 1] : NaN);
}

async function assertSubstepInProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  projectId: number,
  substepId: number
) {
  const { data: sub } = await db
    .from("stage_substeps")
    .select("id, stage_id")
    .eq("id", substepId)
    .maybeSingle();
  if (!sub) return { ok: false as const, response: NextResponse.json({ error: "Подэтап не найден" }, { status: 404 }) };
  const { data: stage } = await db
    .from("stages")
    .select("id")
    .eq("id", sub.stage_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!stage) return { ok: false as const, response: NextResponse.json({ error: "Подэтап не найден" }, { status: 404 }) };
  return { ok: true as const, stageId: sub.stage_id as number };
}

export async function POST(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  const db = auth.ctx.db;
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const stageId = Number(body.stageId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!stageId || !name) return NextResponse.json({ error: "Укажите stageId и name" }, { status: 400 });

    const { data: stage } = await db
      .from("stages")
      .select("id")
      .eq("id", stageId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!stage) return NextResponse.json({ error: "Этап не найден" }, { status: 404 });

    const { data: existing } = await db
      .from("stage_substeps")
      .select("order_index")
      .eq("stage_id", stageId)
      .order("order_index", { ascending: false })
      .limit(1);

    const order_index = existing && existing.length ? existing[0].order_index + 1 : 0;

    const { data: inserted, error } = await db
      .from("stage_substeps")
      .insert({ stage_id: stageId, name, completed: false, order_index })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(error);
      return NextResponse.json(
        { error: error?.message || "Ошибка добавления подэтапа" },
        { status: 500 }
      );
    }
    return NextResponse.json({ id: inserted.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка добавления подэтапа" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  const db = auth.ctx.db;
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const substepId = Number(body.substepId);
    if (!substepId) return NextResponse.json({ error: "Укажите substepId" }, { status: 400 });

    const owned = await assertSubstepInProject(db, projectId, substepId);
    if (!owned.ok) return owned.response;

    const core: { name?: string; completed?: boolean } = {};
    if (body.name !== undefined) core.name = String(body.name).trim();
    if (body.completed !== undefined) core.completed = Boolean(body.completed);

    const optional: {
      not_required?: boolean;
      skip_reason?: string | null;
      on_review?: boolean;
    } = {};
    if (body.not_required !== undefined) optional.not_required = Boolean(body.not_required);
    if (body.skip_reason !== undefined) {
      optional.skip_reason = body.skip_reason == null ? null : String(body.skip_reason);
    }
    if (body.on_review !== undefined) optional.on_review = Boolean(body.on_review);

    // Keep states consistent when fields are explicitly set
    if (optional.not_required === true) {
      core.completed = false;
      optional.on_review = false;
    }
    if (core.completed === true) {
      optional.on_review = false;
      optional.not_required = false;
      optional.skip_reason = null;
    }

    if (Object.keys(core).length === 0 && Object.keys(optional).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    // 1) Always try core fields first (completed/name) — never block checkbox on missing optional columns
    if (Object.keys(core).length > 0) {
      const { data: updated, error } = await db
        .from("stage_substeps")
        .update(core)
        .eq("id", substepId)
        .select("id, completed, name")
        .maybeSingle();

      if (error) {
        console.error("stage_substeps core update:", error);
        return NextResponse.json(
          {
            error: `Не удалось сохранить подэтап: ${error.message}. В Supabase: alter table public.stage_substeps disable row level security;`,
          },
          { status: 500 }
        );
      }
      if (!updated) {
        return NextResponse.json(
          {
            error:
              "Подэтап не обновился (RLS). В Supabase SQL Editor выполните: alter table public.stage_substeps disable row level security;",
          },
          { status: 500 }
        );
      }
    }

    // 2) Optional columns — ignore if migration not applied yet
    if (Object.keys(optional).length > 0) {
      const { error: optError } = await db
        .from("stage_substeps")
        .update(optional)
        .eq("id", substepId);
      if (optError) {
        console.warn("stage_substeps optional update skipped:", optError.message);
        // If user asked only for not_required/on_review and core was empty, surface hint
        if (Object.keys(core).length === 0) {
          return NextResponse.json(
            {
              error: `Нужна миграция колонок подэтапов: ${optError.message}. Выполните supabase/migrations/20260316_setting_default_substeps.sql`,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления подэтапа" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  const db = auth.ctx.db;
  try {
    const projectId = getProjectIdFromUrl(request.url);
    if (!projectId) return NextResponse.json({ error: "Некорректный ID проекта" }, { status: 400 });
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const substepId = Number(body.substepId);
    if (!substepId) return NextResponse.json({ error: "Укажите substepId" }, { status: 400 });

    const owned = await assertSubstepInProject(db, projectId, substepId);
    if (!owned.ok) return owned.response;

    const { error } = await db.from("stage_substeps").delete().eq("id", substepId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message || "Ошибка удаления подэтапа" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления подэтапа" }, { status: 500 });
  }
}
