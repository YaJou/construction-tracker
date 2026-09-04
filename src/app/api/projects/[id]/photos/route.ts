import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

async function getProjectId(request: Request, params?: Promise<{ id: string }>): Promise<number> {
  if (params) {
    const id = Number((await params).id);
    if (id) return id;
  }
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
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
    }
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const stageId = formData.get("stageId");
    const comment = (formData.get("comment") as string) || null;
    const uploadedBy = (formData.get("uploadedBy") as string) || null;

    let filePath = "";
    if (file && file.size > 0) {
      // On Vercel filesystem is ephemeral — store as data URL in DB
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";
      // Cap ~1.5MB to keep row size reasonable
      if (buf.length > 1.5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Фото слишком большое (макс. 1.5 МБ)" },
          { status: 400 }
        );
      }
      filePath = `data:${mime};base64,${buf.toString("base64")}`;
    } else {
      filePath = `/placeholder-${projectId}-${Date.now()}.jpg`;
    }

    const { data: inserted, error } = await supabase
      .from("photos")
      .insert({
        project_id: projectId,
        stage_id: stageId ? Number(stageId) : null,
        file_path: filePath,
        comment,
        uploaded_by: uploadedBy,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "photo",
      entity_id: inserted.id,
      details: "Добавлено фото",
      user_name: uploadedBy,
    });

    return NextResponse.json({ id: inserted.id, file_path: filePath });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const body = await request.json();
    const photoId = Number(body.photoId);
    if (!photoId) {
      return NextResponse.json({ error: "Не передан идентификатор фото" }, { status: 400 });
    }

    const updates: { comment?: string | null; stage_id?: number | null } = {};
    if (body.comment !== undefined) updates.comment = body.comment as string | null;
    if (body.stageId !== undefined) {
      updates.stage_id =
        body.stageId === "" || body.stageId == null ? null : Number(body.stageId);
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    const { error } = await supabase
      .from("photos")
      .update(updates)
      .eq("id", photoId)
      .eq("project_id", projectId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка обновления фото" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "updated",
      entity_type: "photo",
      entity_id: photoId,
      details: "Обновлено описание фото",
      user_name: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления фото" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const body = await request.json();
    const photoId = Number(body.photoId);
    if (!photoId) {
      return NextResponse.json({ error: "Не передан идентификатор фото" }, { status: 400 });
    }

    const { error } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .eq("project_id", projectId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка удаления фото" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "deleted",
      entity_type: "photo",
      entity_id: photoId,
      details: "Удалено фото",
      user_name: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления фото" }, { status: 500 });
  }
}
