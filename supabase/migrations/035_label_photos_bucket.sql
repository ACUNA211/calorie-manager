-- Calorie Manager: label photos in Supabase Storage (ticket #66)
-- A private bucket. A photo lives at <household id>/<file>, and only Members of that
-- Household can add, read or remove it. The read-label Edge Function reads it with the
-- caller's own sign-in, so these same policies decide who may have a label read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('label-photos', 'label-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The first folder of the path must be the id of a Household the caller belongs to.
create policy label_photos_insert_household on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'label-photos'
    and (storage.foldername(name))[1] in (select hid::text from private.my_household_ids() as hid)
  );

create policy label_photos_select_household on storage.objects
  for select to authenticated
  using (
    bucket_id = 'label-photos'
    and (storage.foldername(name))[1] in (select hid::text from private.my_household_ids() as hid)
  );

create policy label_photos_delete_household on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'label-photos'
    and (storage.foldername(name))[1] in (select hid::text from private.my_household_ids() as hid)
  );
