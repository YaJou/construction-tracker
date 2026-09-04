import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

async function getProjectIdFromUrl(request: Request): Promise<number> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const idx = segments.indexOf("projects");
  return Number(idx >= 0 ? segments[idx + 1] : NaN);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectId = Number((await params).id);
    const [{ data: expenses, error: expensesError }, { data: project }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase.from("projects").select("budget").eq("id", projectId).maybeSingle(),
      ]);

    if (expensesError) {
      console.error(expensesError);
      return NextResponse.json({ error: "Ошибка загрузки расходов" }, { status: 500 });
    }

    const list = expenses ?? [];
    const budget = Number(project?.budget ?? 0);
    const totalSpent = list.reduce((sum, e) => sum + Number(e.amount), 0);
    return NextResponse.json(
      {
        expenses: list,
        total_spent: totalSpent,
        budget,
        budget_remaining: budget - totalSpent,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки расходов" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const body = await request.json();
    const { date, category, description, amount, added_by } = body;
    if (!date || !category || amount == null) {
      return NextResponse.json({ error: "Укажите дату, категорию и сумму" }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("expenses")
      .insert({
        project_id: projectId,
        date: String(date),
        category: String(category),
        description: description || null,
        amount: Number(amount),
        added_by: added_by || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error(insertError);
      return NextResponse.json({ error: "Ошибка добавления расхода" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "expense",
      entity_id: inserted.id,
      details: `Добавлен расход: ${category} — ${amount} ₽`,
      user_name: added_by || null,
    });

    return NextResponse.json({ id: inserted.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка добавления расхода" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
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
    if (body.description !== undefined)
      updates.description = body.description === "" ? null : String(body.description);
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", expenseId)
      .eq("project_id", projectId);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: "Ошибка обновления расхода" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "updated",
      entity_type: "expense",
      entity_id: expenseId,
      details: "Обновлён расход",
      user_name: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления расхода" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const projectId = await getProjectIdFromUrl(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
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
      details: `Удалён расход: ${toDelete.category} — ${toDelete.amount} ₽`,
      user_name: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления расхода" }, { status: 500 });
  }
}
