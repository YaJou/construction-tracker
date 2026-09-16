import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { requireAuth, requireWriteAuth, actorName } from "@/lib/auth/requireAuth";
import { assertProjectAccess } from "@/lib/auth/projectAccess";
import {
  SMETA_TEMPLATES,
  findSmetaTemplate,
  lineAmount,
  type SmetaTemplateSection,
} from "@/lib/smetaTemplates";

export const dynamic = "force-dynamic";

async function getProjectId(params: Promise<{ id: string }>) {
  return Number((await params).id);
}

function mapMissingTable(error: { message?: string; code?: string } | null) {
  const msg = error?.message || "";
  if (
    error?.code === "42P01" ||
    /does not exist|schema cache|Could not find the table/i.test(msg)
  ) {
    return NextResponse.json(
      {
        error:
          "Таблицы сметы ещё не созданы. Выполните SQL из supabase/migrations/20260917_project_smeta.sql в Supabase.",
        code: "SMETA_TABLES_MISSING",
      },
      { status: 503 }
    );
  }
  return null;
}

async function loadSmeta(projectId: number) {
  const { data: sections, error: secErr } = await supabase
    .from("project_smeta_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (secErr) return { error: secErr, sections: null, items: null };

  const { data: items, error: itemErr } = await supabase
    .from("project_smeta_items")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (itemErr) return { error: itemErr, sections: null, items: null };

  return { error: null, sections: sections ?? [], items: items ?? [] };
}

function buildResponse(
  sections: Record<string, unknown>[],
  items: Record<string, unknown>[]
) {
  const bySection = sections.map((s) => {
    const sectionItems = items
      .filter((i) => Number(i.section_id) === Number(s.id))
      .map((i) => {
        const quantity = i.quantity == null ? null : Number(i.quantity);
        const unit_price = i.unit_price == null ? null : Number(i.unit_price);
        return {
          ...i,
          quantity,
          unit_price,
          amount: lineAmount(quantity, unit_price),
        };
      });
    const section_total = sectionItems.reduce((sum, i) => sum + i.amount, 0);
    return { ...s, items: sectionItems, section_total };
  });

  const total = bySection.reduce((sum, s) => sum + s.section_total, 0);
  return {
    sections: bySection,
    total,
    templates: SMETA_TEMPLATES.map((t) => ({
      name: t.name,
      items_count: t.items.length,
    })),
  };
}

async function insertSectionWithItems(
  projectId: number,
  template: SmetaTemplateSection,
  orderIndex: number
) {
  const { data: section, error: secErr } = await supabase
    .from("project_smeta_sections")
    .insert({
      project_id: projectId,
      name: template.name,
      order_index: orderIndex,
    })
    .select("*")
    .single();

  if (secErr || !section) return { error: secErr, section: null };

  if (template.items.length) {
    const rows = template.items.map((item, idx) => ({
      section_id: section.id,
      project_id: projectId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      kind: item.kind,
      note: item.note ?? null,
      order_index: idx,
    }));
    const { error: itemErr } = await supabase.from("project_smeta_items").insert(rows);
    if (itemErr) return { error: itemErr, section };
  }

  return { error: null, section };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectId(params);
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;

    const loaded = await loadSmeta(projectId);
    if (loaded.error) {
      const missing = mapMissingTable(loaded.error);
      if (missing) return missing;
      console.error(loaded.error);
      return NextResponse.json({ error: "Ошибка загрузки сметы" }, { status: 500 });
    }

    return NextResponse.json(buildResponse(loaded.sections!, loaded.items!), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки сметы" }, { status: 500 });
  }
}

/**
 * POST body:
 * - { action: "add_section", templateName: "Фундамент" }
 * - { action: "add_all_templates" }
 * - { action: "add_item", sectionId, name, unit?, quantity?, unit_price?, kind?, note? }
 * - { action: "update_item", itemId, ...fields }
 * - { action: "delete_item", itemId }
 * - { action: "delete_section", sectionId }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectId(params);
    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;

    const body = await request.json();
    const action = String(body.action || "");
    const user = actorName(auth.ctx);

    if (action === "add_section") {
      const templateName = String(body.templateName || "").trim();
      const template = findSmetaTemplate(templateName);
      if (!template) {
        return NextResponse.json({ error: "Неизвестный раздел шаблона" }, { status: 400 });
      }

      const loaded = await loadSmeta(projectId);
      if (loaded.error) {
        const missing = mapMissingTable(loaded.error);
        if (missing) return missing;
        return NextResponse.json({ error: "Ошибка сметы" }, { status: 500 });
      }

      if (loaded.sections!.some((s) => String(s.name).toLowerCase() === template.name.toLowerCase())) {
        return NextResponse.json(
          { error: `Раздел «${template.name}» уже добавлен` },
          { status: 409 }
        );
      }

      const orderIndex = loaded.sections!.length;
      const inserted = await insertSectionWithItems(projectId, template, orderIndex);
      if (inserted.error) {
        const missing = mapMissingTable(inserted.error);
        if (missing) return missing;
        console.error(inserted.error);
        return NextResponse.json({ error: "Не удалось добавить раздел" }, { status: 500 });
      }

      await supabase.from("activity_log").insert({
        project_id: projectId,
        action_type: "created",
        entity_type: "smeta",
        entity_id: inserted.section!.id,
        details: `В смету добавлен раздел «${template.name}» (${template.items.length} позиций)`,
        user_name: user,
      });

      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    if (action === "add_all_templates") {
      const loaded = await loadSmeta(projectId);
      if (loaded.error) {
        const missing = mapMissingTable(loaded.error);
        if (missing) return missing;
        return NextResponse.json({ error: "Ошибка сметы" }, { status: 500 });
      }

      const existing = new Set(
        loaded.sections!.map((s) => String(s.name).toLowerCase())
      );
      let orderIndex = loaded.sections!.length;
      let added = 0;
      for (const template of SMETA_TEMPLATES) {
        if (existing.has(template.name.toLowerCase())) continue;
        const inserted = await insertSectionWithItems(projectId, template, orderIndex);
        if (inserted.error) {
          const missing = mapMissingTable(inserted.error);
          if (missing) return missing;
          console.error(inserted.error);
          return NextResponse.json({ error: "Не удалось заполнить смету" }, { status: 500 });
        }
        orderIndex += 1;
        added += 1;
      }

      if (added > 0) {
        await supabase.from("activity_log").insert({
          project_id: projectId,
          action_type: "created",
          entity_type: "smeta",
          entity_id: projectId,
          details: `Смета заполнена шаблоном дома (${added} разделов)`,
          user_name: user,
        });
      }

      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    if (action === "add_item") {
      const sectionId = Number(body.sectionId);
      const name = String(body.name || "").trim();
      if (!sectionId || !name) {
        return NextResponse.json({ error: "Укажите раздел и название позиции" }, { status: 400 });
      }

      const { data: section } = await supabase
        .from("project_smeta_sections")
        .select("id")
        .eq("id", sectionId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!section) {
        return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
      }

      const { count } = await supabase
        .from("project_smeta_items")
        .select("id", { count: "exact", head: true })
        .eq("section_id", sectionId);

      const { error } = await supabase.from("project_smeta_items").insert({
        section_id: sectionId,
        project_id: projectId,
        name,
        unit: String(body.unit || "шт"),
        quantity: body.quantity == null || body.quantity === "" ? null : Number(body.quantity),
        unit_price:
          body.unit_price == null || body.unit_price === "" ? null : Number(body.unit_price),
        kind: String(body.kind || "material"),
        note: body.note ? String(body.note) : null,
        order_index: count ?? 0,
      });

      if (error) {
        const missing = mapMissingTable(error);
        if (missing) return missing;
        console.error(error);
        return NextResponse.json({ error: "Не удалось добавить позицию" }, { status: 500 });
      }

      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    if (action === "update_item") {
      const itemId = Number(body.itemId);
      if (!itemId) {
        return NextResponse.json({ error: "Некорректная позиция" }, { status: 400 });
      }

      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.unit !== undefined) patch.unit = String(body.unit);
      if (body.quantity !== undefined) {
        patch.quantity =
          body.quantity === "" || body.quantity == null ? null : Number(body.quantity);
      }
      if (body.unit_price !== undefined) {
        patch.unit_price =
          body.unit_price === "" || body.unit_price == null ? null : Number(body.unit_price);
      }
      if (body.kind !== undefined) patch.kind = String(body.kind);
      if (body.note !== undefined) patch.note = body.note ? String(body.note) : null;

      if (!Object.keys(patch).length) {
        return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
      }

      const { error } = await supabase
        .from("project_smeta_items")
        .update(patch)
        .eq("id", itemId)
        .eq("project_id", projectId);

      if (error) {
        const missing = mapMissingTable(error);
        if (missing) return missing;
        console.error(error);
        return NextResponse.json({ error: "Не удалось сохранить позицию" }, { status: 500 });
      }

      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    if (action === "delete_item") {
      const itemId = Number(body.itemId);
      const { error } = await supabase
        .from("project_smeta_items")
        .delete()
        .eq("id", itemId)
        .eq("project_id", projectId);
      if (error) {
        const missing = mapMissingTable(error);
        if (missing) return missing;
        return NextResponse.json({ error: "Не удалось удалить позицию" }, { status: 500 });
      }
      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    if (action === "delete_section") {
      const sectionId = Number(body.sectionId);
      const { error } = await supabase
        .from("project_smeta_sections")
        .delete()
        .eq("id", sectionId)
        .eq("project_id", projectId);
      if (error) {
        const missing = mapMissingTable(error);
        if (missing) return missing;
        return NextResponse.json({ error: "Не удалось удалить раздел" }, { status: 500 });
      }
      const refreshed = await loadSmeta(projectId);
      return NextResponse.json(buildResponse(refreshed.sections!, refreshed.items!));
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сметы" }, { status: 500 });
  }
}
