-- Photos → Supabase Storage
-- Run in SQL Editor

-- Extra metadata on existing photos table (file_path stays the display URL)
alter table public.photos
  add column if not exists storage_path text,
  add column if not exists thumbnail_url text,
  add column if not exists mime_type text,
  add column if not exists byte_size integer;

-- Bucket (public read so reports/gallery work without signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos',
  'project-photos',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
drop policy if exists "project_photos_public_read" on storage.objects;
create policy "project_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'project-photos');

drop policy if exists "project_photos_auth_upload" on storage.objects;
create policy "project_photos_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'project-photos');

drop policy if exists "project_photos_auth_update" on storage.objects;
create policy "project_photos_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'project-photos');

drop policy if exists "project_photos_auth_delete" on storage.objects;
create policy "project_photos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'project-photos');
