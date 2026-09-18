"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { compressPhoto, uploadPhotoWithProgress } from "@/lib/compressImage";
import { Loader2, Camera, Pencil, Trash2 } from "lucide-react";
import { LoadingBlock } from "@/components/ui/Loading";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type PhotoRow = {
  id: number;
  file_path: string;
  thumbnail_url?: string | null;
  comment: string | null;
  created_at: string;
  stage_id: number | null;
};

function photoSrc(p: { file_path: string; thumbnail_url?: string | null }, preferThumb = true) {
  if (preferThumb && p.thumbnail_url) return p.thumbnail_url;
  return p.file_path;
}

export function ProjectPhotosSection({
  projectId,
  stages,
  photoStageId,
  setPhotoStageId,
  photoComment,
  setPhotoComment,
  fileInputRef,
  refetch,
}: {
  projectId: number;
  stages: { id: number; name: string }[];
  photoStageId: string;
  setPhotoStageId: (v: string) => void;
  photoComment: string;
  setPhotoComment: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoUpload?: (file: File) => Promise<void> | void;
  uploadingPhoto?: boolean;
  refetch: () => void;
}) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [activePhoto, setActivePhoto] = useState<PhotoRow | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [editPhotoComment, setEditPhotoComment] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);

  const loadPhotos = () => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/photos`)
      .then((r) => r.json())
      .then((data) => setPhotos(Array.isArray(data) ? data : []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPhotos();
  }, [projectId, refetch]);

  async function uploadList(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    setFailedFiles([]);
    const failed: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, percent: 0 });
      try {
        const compressed = await compressPhoto(file);
        await uploadPhotoWithProgress(
          projectId,
          {
            full: compressed.full,
            thumb: compressed.thumb,
            stageId: photoStageId || null,
            comment: photoComment || null,
          },
          (percent) => setProgress({ current: i + 1, total: files.length, percent })
        );
      } catch (e) {
        failed.push(file);
        setUploadError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    }
    setFailedFiles(failed);
    setUploading(false);
    setProgress(null);
    if (failed.length === 0) {
      setSelectedFiles([]);
      setPhotoStageId("");
      setPhotoComment("");
      setIsAdding(false);
    } else {
      setSelectedFiles(failed);
    }
    loadPhotos();
    refetch();
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="font-semibold text-ink">Фото-отчёты</h2>
          <Button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            variant={isAdding ? "secondary" : "primary"}
            size="lg"
            className="touch-target w-full sm:w-auto sm:ml-auto"
          >
            {isAdding ? "Отмена" : "Добавить фото"}
          </Button>
        </div>
        {isAdding && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  if (!list.length) return;
                  setSelectedFiles((prev) => [...prev, ...list]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="lg"
                className="touch-target w-full sm:w-auto"
              >
                <Camera className="w-5 h-5 mr-2" />
                Выбрать фото
              </Button>
              <span className="text-xs text-ink-muted">
                {selectedFiles.length
                  ? `Выбрано: ${selectedFiles.length}`
                  : "Несколько сразу · сжатие на устройстве"}
              </span>
            </div>
            {selectedFiles.length > 0 && (
              <ul className="text-caption text-muted space-y-1 max-h-28 overflow-auto">
                {selectedFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="truncate">
                    {f.name} · {(f.size / 1024 / 1024).toFixed(1)} МБ
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={photoStageId}
                onChange={(e) => setPhotoStageId(e.target.value)}
                className="w-full sm:w-48"
              >
                <option value="">Этап не выбран</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Комментарий к фото"
                value={photoComment}
                onChange={(e) => setPhotoComment(e.target.value)}
                className="w-full sm:flex-1"
              />
              <Button
                type="button"
                onClick={() => uploadList(selectedFiles)}
                disabled={uploading || selectedFiles.length === 0}
                size="lg"
                className="touch-target w-full sm:w-auto"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Загрузить"}
              </Button>
            </div>
            {progress && (
              <div className="space-y-1">
                <p className="text-caption text-muted">
                  Файл {progress.current} из {progress.total} · {progress.percent}%
                </p>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-orange transition-[width] duration-fast"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}
            {uploadError && (
              <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex flex-wrap items-center gap-2">
                <span>{uploadError}</span>
                {failedFiles.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => uploadList(failedFiles)}
                    disabled={uploading}
                  >
                    Повторить ({failedFiles.length})
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingBlock compact label="Загрузка фото…" />
        ) : (
          <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-lg overflow-hidden bg-surface-muted flex flex-col cursor-pointer relative"
              onClick={() => setActivePhoto(photo)}
            >
              <div className="flex-1 w-full relative">
                {photo.file_path.startsWith("/placeholder") ? (
                  <div className="w-full h-full flex items-center justify-center text-ink-subtle text-4xl">
                    📷
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc(photo, true)}
                    alt={photo.comment || "Фото объекта"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 rounded-lg p-1">
                  <button
                    type="button"
                    className="p-1.5 rounded text-white hover:bg-white/20"
                    title="Редактировать описание"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPhotoId(photo.id);
                      setEditPhotoComment(photo.comment || "");
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded text-white hover:bg-red-500/80"
                    title="Удалить фото"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm("Удалить это фото?")) return;
                      await fetch(`/api/projects/${projectId}/photos`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ photoId: photo.id }),
                      });
                      loadPhotos();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {editingPhotoId === photo.id ? (
                <div
                  className="p-2 bg-white border-t flex flex-col gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    value={editPhotoComment}
                    onChange={(e) => setEditPhotoComment(e.target.value)}
                    placeholder="Описание фото"
                    className="text-xs min-h-0 py-1.5"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 py-1 text-xs"
                      disabled={savingPhoto}
                      onClick={async () => {
                        setSavingPhoto(true);
                        await fetch(`/api/projects/${projectId}/photos`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            photoId: photo.id,
                            comment: editPhotoComment.trim() || null,
                          }),
                        });
                        setSavingPhoto(false);
                        setEditingPhotoId(null);
                        loadPhotos();
                      }}
                    >
                      {savingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : "Сохранить"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="py-1 text-xs"
                      onClick={() => setEditingPhotoId(null)}
                      disabled={savingPhoto}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="p-2 text-xs text-ink-muted bg-white border-t line-clamp-2 min-h-[3rem]">
                  {photo.comment || "Без описания"}
                </p>
              )}
            </div>
          ))}
        </div>
        {photos.length === 0 && (
          <p className="text-center text-ink-muted py-8">Пока нет загруженных фото</p>
        )}

        {activePhoto && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm text-ink-muted">Фото объекта</span>
                <button
                  className="text-ink-muted hover:text-ink text-sm"
                  onClick={() => setActivePhoto(null)}
                >
                  Закрыть
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-surface-muted min-h-[200px]">
                {activePhoto.file_path.startsWith("/placeholder") ? (
                  <div className="text-ink-subtle text-6xl">📷</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc(activePhoto, false)}
                    alt={activePhoto.comment || "Фото"}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                )}
              </div>
              <div className="px-4 py-3 border-t border-border space-y-2">
                <p className="text-sm text-ink">{activePhoto.comment || "Без описания"}</p>
                <p className="text-xs text-ink-muted">
                  {format(new Date(activePhoto.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm("Удалить это фото?")) return;
                    await fetch(`/api/projects/${projectId}/photos`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ photoId: activePhoto.id }),
                    });
                    setActivePhoto(null);
                    loadPhotos();
                  }}
                >
                  Удалить
                </Button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
