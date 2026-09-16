import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { actorName, requireAuth, requireWriteAuth } from "@/lib/auth/requireAuth";
import { assertProjectAccess } from "@/lib/auth/projectAccess";
import { lineAmount } from "@/lib/smetaTemplates";

export const dynamic = "force-dynamic";

async function getProjectIdFromUrl(request: Request): Promise<number> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const idx = segments.indexOf("projects");
  return Number(idx >= 0 ? segments[idx + 1] : NaN);
}

function computeAmount(body: {
  amount?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
}) {
  const qty =
    body.quantity === "" || body.quantity == null ? null : Number(body.quantity);
  const price =
    body.unit_price === "" || body.unit_price == null ? null : Number(body.unit_price);
  if (qty != null && price != null && Number.isFinite(qty) && Number.isFinite(price)) {
    return lineAmount(qty, price);
  }
  if (body.amount != null && body.amount !== "") {
    return Number(body.amount);
  }
  return null;
}

function optionalText(v: unknown) {
  if (v == null || v === "") return null;
  return String(v);
}

function optionalNumber(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = Number((await params).id);
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const [{ data: expenses, error: expensesError }, { data: project }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase.from("projects").select("budget, name, address, client, manager").eq("id", projectId).maybeSingle(),
      ]);

    if (expensesError) {
      console.error(expensesError);
      return NextResponse.json({ error: "Ошибка загрузки расходов" }, { status: 500 });
    }

    const list = expenses ?? [];
    const budget = Number(project?.budget ?? 0);
    const hasBudget = Number.isFinite(budget) && budget > 0;
    const totalSpent = list.reduce((sum, e) => sum + Number(e.amount), 0);
    return NextResponse.json(
      {
        expenses: list,
        total_spent: totalSpent,
        budget: hasBudget ? budget : 0,
        has_budget: hasBudget,
        budget_remaining: hasBudget ? budget - totalSpent : null,
        project: project
          ? {
              name: project.name,
              address: project.address,
              client: project.client,
              manager: project.manager,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки расходов" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const { date, category, description, added_by } = body;
    const amount = computeAmount(body);
    if (!date || !category || amount == null || !Number.isFinite(amount)) {
      return NextResponse.json(
        { error: "Укажите дату, категорию и сумму (или кол-во × цену)" },
        { status: 400 }
      );
    }

    const addedBy = added_by || actorName(auth.ctx);
    const subcategory = optionalText(body.subcategory) || optionalText(description);
    const row: Record<string, unknown> = {
      project_id: projectId,
      date: String(date),
      category: String(category),
      description: subcategory,
      amount: Number(amount),
      added_by: addedBy,
    };

    // New smeta fields — retry without them if columns missing
    const extended = {
      ...row,
      subcategory,
      quantity: optionalNumber(body.quantity),
      unit_price: optionalNumber(body.unit_price),
      unit: optionalText(body.unit),
      kind: optionalText(body.kind),
    };

    let { data: inserted, error: insertError } = await supabase
      .from("expenses")
      .insert(extended)
      .select("id")
      .single();

    if (
      insertError &&
      /subcategory|unit_price|quantity|column|schema cache/i.test(insertError.message || "")
    ) {
      ({ data: inserted, error: insertError } = await supabase
        .from("expenses")
        .insert(row)
        .select("id")
        .single());
    }

    if (insertError || !inserted) {
      console.error(insertError);
      return NextResponse.json(
        {
          error: insertError?.message?.includes("column")
            ? "Нужно обновить таблицу expenses в Supabase (миграция 20260917_expenses_smeta_fields.sql)"
            : "Ошибка добавления расхода",
          details: insertError?.message,
        },
        { status: 500 }
      );
    }

    const label = subcategory ? `${category} / ${subcategory}` : category;
    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "expense",
      entity_id: inserted.id,
      details: `Добавлена позиция сметы: ${label} — ${amount} ₽`,
      user_name: addedBy,
    });

    return NextResponse.json({ id: inserted.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка добавления расхода" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const expenseId = Number(body.expenseId);
    if (!expenseId) {
      return NextResponse.json({ error: "Не передан идентификатор расхода" }, { status: 400 });
    }

    const { data: expense } = await supabase
      .from("expenses")
      .select("id")
      .eq("id", expenseId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!expense) {
      return NextResponse.json({ error: "Расход не найден" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.date !== undefined) updates.date = String(body.date);
    if (body.category !== undefined) updates.category = String(body.category);
    if (body.subcategory !== undefined || body.description !== undefined) {
      const sub = optionalText(body.subcategory ?? body.description);
      updates.subcategory = sub;
      updates.description = sub;
    }
    if (body.quantity !== undefined) updates.quantity = optionalNumber(body.quantity);
    if (body.unit_price !== undefined) updates.unit_price = optionalNumber(body.unit_price);
    if (body.unit !== undefined) updates.unit = optionalText(body.unit);
    if (body.kind !== undefined) updates.kind = optionalText(body.kind);

    const amount = computeAmount({
      amount: body.amount,
      quantity: body.quantity !== undefined ? body.quantity : undefined,
      unit_price: body.unit_price !== undefined ? body.unit_price : undefined,
    });
    if (body.amount !== undefined || body.quantity !== undefined || body.unit_price !== undefined) {
      if (amount == null || !Number.isFinite(amount)) {
        return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
      }
      updates.amount = amount;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    let { error: updateError } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", expenseId)
      .eq("project_id", projectId);

    if (
      updateError &&
      /subcategory|unit_price|quantity|column|schema cache/i.test(updateError.message || "")
    ) {
      const legacy: Record<string, unknown> = {};
      if (updates.date !== undefined) legacy.date = updates.date;
      if (updates.category !== undefined) legacy.category = updates.category;
      if (updates.description !== undefined) legacy.description = updates.description;
      if (updates.amount !== undefined) legacy.amount = updates.amount;
      ({ error: updateError } = await supabase
        .from("expenses")
        .update(legacy)
        .eq("id", expenseId)
        .eq("project_id", projectId));
    }

    if (updateError) {
      console.error(updateError);
      return NextResponse.json(
        { error: "Ошибка обновления расхода", details: updateError.message },
        { status: 500 }
      );
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "updated",
      entity_type: "expense",
      entity_id: expenseId,
      details: "Обновлена позиция сметы",
      user_name: actorName(auth.ctx),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления расхода" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const body = await request.json();
    const expenseId = Number(body.expenseId);
    if (!expenseId) {
      return NextResponse.json({ error: "Не передан идентификатор расхода" }, { status: 400 });
    }

    const { data: toDelete } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!toDelete) {
      return NextResponse.json({ error: "Расход не найден" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("project_id", projectId);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json({ error: "Ошибка удаления расхода" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "deleted",
      entity_type: "expense",
      entity_id: expenseId,
      details: `Удалена позиция сметы: ${toDelete.category} — ${toDelete.amount} ₽`,
      user_name: actorName(auth.ctx),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления расхода" }, { status: 500 });
  }
}
