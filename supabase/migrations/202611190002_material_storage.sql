-- The private research-files bucket is created in 202611180002_storage.sql.
create policy material_pdf_read on storage.objects for select to authenticated using (
 bucket_id='research-files' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
 and exists(select from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2] and p.owner_id=(select auth.uid()))
);
create policy material_pdf_insert on storage.objects for insert to authenticated with check (
 bucket_id='research-files' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
 and storage.filename(name) ~ '^[a-f0-9]{64}\.pdf$'
 and exists(select from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2] and p.owner_id=(select auth.uid()))
);
