import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { actorName, requireAuth, requireWriteAuth } from "@/lib/auth/requireAuth";
import { assertProjectAccess } from "@/lib/auth/projectAccess";
import {
  forceLocalDbMode,
  isDbUnavailableMessage,
  resolveDbMode,
} from "@/lib/dbMode";
import { ensureStoreReady, flushStore, store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "project-photos";
const MAX_BYTES = 10 * 1024 * 1024; // after client compression; hard safety cap
const LOCAL_MAX_BYTES = 1.5 * 1024 * 1024; // keep Neon JSON store small

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

function publicUrl(supabaseClient: typeof supabase, path: string) {
  const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = Number((await params).id);
    const mode = await resolveDbMode();
    if (mode === "local") {
      await ensureStoreReady({ fresh: true });
      return NextResponse.json(store.getPhotos(projectId), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const access = await assertProjectAccess(auth.ctx, projectId);
    if (!access.ok) return access.response;
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      if (isDbUnavailableMessage(error.message)) {
        forceLocalDbMode();
        await ensureStoreReady({ fresh: true });
        return NextResponse.json(store.getPhotos(projectId), {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
    }
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    try {
      forceLocalDbMode();
      const projectId = Number((await params).id);
      await ensureStoreReady({ fresh: true });
      return NextResponse.json(store.getPhotos(projectId), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
    }
  }
}

export async function POST(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const mode = await resolveDbMode();
    const useLocal = mode === "local";
    if (!useLocal) {
      const access = await assertProjectAccess(auth.ctx, projectId);
      if (!access.ok) return access.response;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const thumbFile = formData.get("thumbnail") as File | null;
    const stageId = formData.get("stageId");
    const comment = (formData.get("comment") as string) || null;
    const uploadedBy =
      (formData.get("uploadedBy") as string) || actorName(auth.ctx);

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Фото слишком большое (макс. 10 МБ после сжатия)" },
        { status: 400 }
      );
    }

    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return NextResponse.json({ error: "Можно загружать только изображения" }, { status: 400 });
    }

    const fullBuf = Buffer.from(await file.arrayBuffer());
    const thumbBuf =
      thumbFile && thumbFile.size > 0
        ? Buffer.from(await thumbFile.arrayBuffer())
        : null;

    const saveLocal = async () => {
      if (fullBuf.length > LOCAL_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              "Фото слишком большое для локального режима (сжмите сильнее, до ~1,5 МБ)",
          },
          { status: 400 }
        );
      }
      await ensureStoreReady({ fresh: true });
      const fileUrl = `data:${mime};base64,${fullBuf.toString("base64")}`;
      let thumbnailUrl: string | null = null;
      if (thumbBuf && thumbBuf.length > 0 && thumbBuf.length <= LOCAL_MAX_BYTES) {
        const tm = thumbFile?.type || "image/jpeg";
        thumbnailUrl = `data:${tm};base64,${thumbBuf.toString("base64")}`;
      }
      const id = store.addPhoto({
        project_id: projectId,
        stage_id: stageId ? Number(stageId) : null,
        file_path: fileUrl,
        thumbnail_url: thumbnailUrl,
        comment,
        uploaded_by: uploadedBy,
      });
      store.addActivity({
        project_id: projectId,
        action_type: "created",
        entity_type: "photo",
        entity_id: id,
        details: "Добавлено фото",
        user_name: uploadedBy,
      });
      await flushStore();
      return NextResponse.json({
        id,
        file_path: fileUrl,
        thumbnail_url: thumbnailUrl,
        storage: "local",
      });
    };

    if (useLocal) {
      return saveLocal();
    }

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = extFromMime(mime);
    const storagePath = `${projectId}/${stamp}.${ext}`;
    const thumbPath = `${projectId}/thumbs/${stamp}.${ext}`;

    const storageClient = auth.ctx.supabase;

    const { error: upError } = await storageClient.storage
      .from(BUCKET)
      .upload(storagePath, fullBuf, { contentType: mime, upsert: false });

    if (upError) {
      console.error("storage upload", upError);
      if (
        isDbUnavailableMessage(upError.message) ||
        /fetch failed|network|ENOTFOUND/i.test(upError.message || "")
      ) {
        forceLocalDbMode();
        return saveLocal();
      }
      return NextResponse.json(
        {
          error: `Не удалось сохранить в Storage: ${upError.message}. Выполните SQL-миграцию project-photos.`,
        },
        { status: 500 }
      );
    }

    let thumbnailUrl: string | null = null;
    if (thumbBuf && thumbBuf.length > 0) {
      const { error: tErr } = await storageClient.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBuf, {
          contentType: thumbFile?.type || "image/jpeg",
          upsert: false,
        });
      if (!tErr) {
        thumbnailUrl = publicUrl(supabase, thumbPath);
      }
    }

    const fileUrl = publicUrl(supabase, storagePath);

    const row: Record<string, unknown> = {
      project_id: projectId,
      stage_id: stageId ? Number(stageId) : null,
      file_path: fileUrl,
      comment,
      uploaded_by: uploadedBy,
      storage_path: storagePath,
      thumbnail_url: thumbnailUrl,
      mime_type: mime,
      byte_size: fullBuf.length,
    };

    let { data: inserted, error } = await supabase
      .from("photos")
      .insert(row)
      .select("id, file_path, thumbnail_url")
      .single();

    if (error && /storage_path|thumbnail_url|mime_type|byte_size/i.test(error.message)) {
      ({ data: inserted, error } = await supabase
        .from("photos")
        .insert({
          project_id: projectId,
          stage_id: stageId ? Number(stageId) : null,
          file_path: fileUrl,
          comment,
          uploaded_by: uploadedBy,
        })
        .select("id, file_path")
        .single());
    }

    if (error || !inserted) {
      console.error(error);
      if (error && isDbUnavailableMessage(error.message)) {
        forceLocalDbMode();
        return saveLocal();
      }
      try {
        await storageClient.storage.from(BUCKET).remove([storagePath]);
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: "Ошибка записи фото в базу" }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "created",
      entity_type: "photo",
      entity_id: inserted.id,
      details: "Добавлено фото",
      user_name: uploadedBy,
    });

    return NextResponse.json({
      id: inserted.id,
      file_path: inserted.file_path,
      thumbnail_url: (inserted as { thumbnail_url?: string | null }).thumbnail_url ?? thumbnailUrl,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (isDbUnavailableMessage(msg) || /fetch failed/i.test(msg)) {
      try {
        forceLocalDbMode();
        // Re-read form is not possible; ask client to retry — but new page will soft-fail
        return NextResponse.json(
          { error: "Хранилище фото временно недоступно. Объект уже создан — добавьте фото на карточке." },
          { status: 503 }
        );
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json({ error: "Ошибка загрузки фото" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const mode = await resolveDbMode();
    const useLocal = mode === "local";
    if (!useLocal) {
      const access = await assertProjectAccess(auth.ctx, projectId);
      if (!access.ok) return access.response;
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

    if (useLocal) {
      await ensureStoreReady({ fresh: true });
      const ok = store.updatePhoto(photoId, updates);
      if (!ok) {
        return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
      }
      store.addActivity({
        project_id: projectId,
        action_type: "updated",
        entity_type: "photo",
        entity_id: photoId,
        details: "Обновлено описание фото",
        user_name: actorName(auth.ctx),
      });
      await flushStore();
      return NextResponse.json({ ok: true, storage: "local" });
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
      user_name: actorName(auth.ctx),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка обновления фото" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireWriteAuth();
  if (!auth.ok) return auth.response;
  try {
    const projectId = await getProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Некорректный идентификатор проекта" }, { status: 400 });
    }
    const mode = await resolveDbMode();
    const useLocal = mode === "local";
    if (!useLocal) {
      const access = await assertProjectAccess(auth.ctx, projectId);
      if (!access.ok) return access.response;
    }
    const body = await request.json();
    const photoId = Number(body.photoId);
    if (!photoId) {
      return NextResponse.json({ error: "Не передан идентификатор фото" }, { status: 400 });
    }

    if (useLocal) {
      await ensureStoreReady({ fresh: true });
      const photo = store.getPhoto(photoId, projectId);
      if (!photo) {
        return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
      }
      store.removePhoto(photoId);
      store.addActivity({
        project_id: projectId,
        action_type: "deleted",
        entity_type: "photo",
        entity_id: photoId,
        details: "Удалено фото",
        user_name: actorName(auth.ctx),
      });
      await flushStore();
      return NextResponse.json({ ok: true, storage: "local" });
    }

    const { data: photo } = await supabase
      .from("photos")
      .select("id, storage_path, file_path")
      .eq("id", photoId)
      .eq("project_id", projectId)
      .maybeSingle();

    const { error } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .eq("project_id", projectId);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Ошибка удаления фото" }, { status: 500 });
    }

    const paths: string[] = [];
    if (photo?.storage_path) {
      paths.push(photo.storage_path);
      const thumb = photo.storage_path.replace(`/${projectId}/`, `/${projectId}/thumbs/`);
      if (thumb !== photo.storage_path) paths.push(thumb);
      const base = photo.storage_path.split("/").pop();
      if (base) paths.push(`${projectId}/thumbs/${base}`);
    }
    if (paths.length) {
      await auth.ctx.supabase.storage.from(BUCKET).remove([...new Set(paths)]);
    }

    await supabase.from("activity_log").insert({
      project_id: projectId,
      action_type: "deleted",
      entity_type: "photo",
      entity_id: photoId,
      details: "Удалено фото",
      user_name: actorName(auth.ctx),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка удаления фото" }, { status: 500 });
  }
}
