-- Leave room for multipart overhead under Vercel's 4.5 MB function request limit.
-- NOT VALID preserves existing evidence metadata above the new limit while
-- enforcing the smaller limit on all new or updated document rows.
alter table public.documents
  add constraint documents_vercel_upload_limit
  check (size_bytes <= 4194304) not valid;

update storage.buckets
  set file_size_limit = 4194304
  where id = 'loan-documents';
