-- Minimal Supabase Storage schema surface for SQL policy tests.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(bucket_id text,name text);
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create function storage.filename(name text) returns text language sql as $$ select split_part(name,'/',-1) $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert on storage.objects to authenticated;
