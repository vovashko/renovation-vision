-- T63: HEIC is converted to JPEG in the browser (src/features/media/domain/normalize-image.ts), so the
-- storage buckets and the documents table no longer accept image/heic.

-- Buckets: updated in place, every other allowed type is kept.
update storage.buckets
set allowed_mime_types = array_remove(allowed_mime_types, 'image/heic')
where id in ('project-media', 'project-documents');

-- documents.mime_type: drop and re-add the check without image/heic. NOT VALID keeps any HEIC row an
-- earlier upload left behind readable while the constraint still applies to every new or updated row.
alter table public.documents drop constraint documents_mime_type_check;
alter table public.documents add constraint documents_mime_type_check check (mime_type in (
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
)) not valid;
