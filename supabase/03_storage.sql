-- ============================================================================
-- Millennia FieldOps - 03_storage.sql
-- The private bucket that holds record photos, plus its access rules.
-- Run this THIRD.
-- ============================================================================

-- A private bucket (public = false): photos are only served with a signed URL.
insert into storage.buckets (id, name, public)
values ('record-photos', 'record-photos', false)
on conflict (id) do nothing;

-- Read any photo (signed-in users only).
drop policy if exists record_photos_read on storage.objects;
create policy record_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'record-photos');

-- Upload into your own folder: the path must start with your user id,
-- e.g.  3f7c...-/site-photo.jpg
drop policy if exists record_photos_insert on storage.objects;
create policy record_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'record-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete your own photos (admins may delete any).
drop policy if exists record_photos_delete on storage.objects;
create policy record_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'record-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
