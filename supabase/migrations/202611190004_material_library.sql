-- Existing list_materials remains available to earlier clients.
create or replace function public.search_materials(target uuid, page_offset integer, query_text text, source_type text)
returns table(id uuid,kind text,title text,origin text,state text,cited boolean,candidate boolean,manual boolean)
language sql stable security invoker set search_path='' as $$
 select m.id,m.kind,m.title,m.origin,m.state,m.cited,m.candidate,m.manual
 from public.project_materials m
 where m.project_id=target and (source_type='' or m.kind=source_type)
 and (strpos(lower(m.title),lower(query_text))>0 or strpos(lower(m.origin),lower(query_text))>0)
 order by m.created_at desc,m.id limit 50 offset greatest(page_offset,0)
$$;
revoke all on function public.search_materials(uuid,integer,text,text) from public,anon;
grant execute on function public.search_materials(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
