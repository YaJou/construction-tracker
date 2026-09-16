import imageCompression from "browser-image-compression";

const FULL_OPTIONS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
  initialQuality: 0.82,
};

const THUMB_OPTIONS = {
  maxSizeMB: 0.25,
  maxWidthOrHeight: 480,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
  initialQuality: 0.7,
};

export type CompressedPhoto = {
  full: File;
  thumb: File;
  originalName: string;
};

/** Compress + EXIF orientation via browser-image-compression; returns full + thumbnail. */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error(`«${file.name}» — не изображение`);
  }

  const full = await imageCompression(file, FULL_OPTIONS);
  const thumb = await imageCompression(file, THUMB_OPTIONS);

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  const fullFile = new File([full], `${base}.jpg`, { type: "image/jpeg" });
  const thumbFile = new File([thumb], `${base}-thumb.jpg`, { type: "image/jpeg" });

  return { full: fullFile, thumb: thumbFile, originalName: file.name };
}

export async function compressPhotos(files: File[]): Promise<CompressedPhoto[]> {
  const out: CompressedPhoto[] = [];
  for (const file of files) {
    out.push(await compressPhoto(file));
  }
  return out;
}

export function uploadPhotoWithProgress(
  projectId: number,
  payload: {
    full: File;
    thumb?: File;
    stageId?: string | number | null;
    comment?: string | null;
  },
  onProgress?: (percent: number) => void
): Promise<{ id: number; file_path: string; thumbnail_url?: string | null }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", payload.full);
    if (payload.thumb) form.set("thumbnail", payload.thumb);
    if (payload.stageId) form.set("stageId", String(payload.stageId));
    if (payload.comment?.trim()) form.set("comment", payload.comment.trim());

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${projectId}/photos`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json);
        } else {
          reject(new Error(json.error || `Ошибка загрузки (${xhr.status})`));
        }
      } catch {
        reject(new Error("Некорректный ответ сервера"));
      }
    };
    xhr.onerror = () => reject(new Error("Сеть недоступна. Попробуйте ещё раз."));
    xhr.send(form);
  });
}
