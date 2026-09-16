# Фото → Supabase Storage

## SQL (обязательно один раз)

В SQL Editor выполните файл:
`supabase/migrations/20260316_photos_storage.sql`

Он создаёт bucket `project-photos` и колонки `storage_path`, `thumbnail_url`, `mime_type`, `byte_size`.

## Что умеет приложение

- Сжатие на устройстве (до ~1.2 МБ, ширина до 1920px) + EXIF-поворот
- Превью (thumbnail) для сетки
- Несколько фото за раз + прогресс + повтор при ошибке
- Файлы в Storage, в БД только URL (не base64)

Старые фото с data-URL продолжают открываться, пока не перезальёте.
