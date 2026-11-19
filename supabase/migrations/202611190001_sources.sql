-- Project archives share one row per URL, PDF digest or text digest.
create table public.project_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null default auth.uid(),
  kind text not null check(kind in ('url','pdf','text')),
  identity_key text not null,
  title text not null,
  origin text not null,
  body text not null default '',
  state text not null check(state in ('link','ready','failed')),
  note text not null default '',
  cited boolean not null default false,
  candidate boolean not null default false,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id),
  unique(project_id,kind,identity_key)
);
alter table public.project_materials enable row level security;
revoke all on public.project_materials from public,anon,authenticated;
grant select,insert,update on public.project_materials to authenticated;
create policy own_materials on public.project_materials to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create index material_listing on public.project_materials(project_id,created_at desc,id);

create function public.material_url_key(link text) returns text language sql immutable strict set search_path='' as $$
 with parsed as (
   select regexp_match(split_part(link,'#',1),'^(https?)://([^/?#]+)(.*)$','i') as parts
 ), normalized as (
   select lower(parts[1]) as scheme,lower(parts[2]) as authority,parts[3] as suffix from parsed
 )
 select encode(sha256(convert_to(scheme||'://'||regexp_replace(authority,case when scheme='https' then ':443$' else ':80$' end,'')
   ||case when suffix='' or left(suffix,1)='?' then '/' else '' end||suffix,'UTF8')),'hex') from normalized
$$;
create function public.save_material(target uuid, source_kind text, source_title text, source_origin text, source_body text, source_state text, source_note text, pdf_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare k text; result uuid;
begin
 if source_kind='url' then k:=public.material_url_key(source_origin);
 elsif source_kind='text' then k:=encode(sha256(convert_to(source_body,'UTF8')),'hex');
 elsif source_kind='pdf' and pdf_hash ~ '^[a-f0-9]{64}$' then k:=pdf_hash;
 else raise exception 'invalid source'; end if;
 insert into public.project_materials as m(project_id,kind,identity_key,title,origin,body,state,note,manual)
 values(target,source_kind,k,source_title,source_origin,source_body,source_state,source_note,true)
 on conflict(project_id,kind,identity_key) do update set manual=true,
 title=case when m.state='ready' then m.title else excluded.title end,
 body=case when m.state='ready' then m.body else excluded.body end,
 state=case when m.state='ready' then m.state else excluded.state end,
 note=case when m.state='ready' then m.note else excluded.note end
 returning id into result;
 return result;
end $$;
create function public.list_materials(target uuid, page_offset int)
returns table(id uuid,kind text,title text,state text,cited boolean,candidate boolean,manual boolean)
language sql stable security invoker set search_path='' as $$
 select m.id,m.kind,m.title,m.state,m.cited,m.candidate,m.manual from public.project_materials m
 where m.project_id=target order by m.created_at desc,m.id limit 50 offset greatest(page_offset,0)
$$;
create function public.read_material(target uuid, item uuid)
returns setof public.project_materials language sql stable security invoker set search_path='' as $$
 select * from public.project_materials where project_id=target and id=item
$$;

-- Apply the same operation to historical replies and newly completed replies.
create function public.archive_material_refs(target uuid, principal uuid, refs jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.project_materials as m(project_id,owner_id,kind,identity_key,title,origin,state,cited,candidate)
 select target,principal,'url',public.material_url_key(r.url),
 coalesce(max(nullif(r.title,'')) filter(where r.kind='citation'),max(nullif(r.title,'')),min(r.url)),
 min(r.url),'link',bool_or(r.kind='citation'),bool_or(r.kind='candidate')
 from jsonb_to_recordset(case when jsonb_typeof(refs)='array' then refs else '[]'::jsonb end) as r(kind text,url text,title text)
 where r.kind in ('citation','candidate') and r.url ~* '^https?://' and public.material_url_key(r.url) is not null group by public.material_url_key(r.url)
 order by public.material_url_key(r.url)
 on conflict(project_id,kind,identity_key) do update set cited=m.cited or excluded.cited,candidate=m.candidate or excluded.candidate,
 title=case when m.title=m.origin then excluded.title else m.title end
$$;
create function public.archive_reply_materials() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform public.archive_material_refs(s.project_id,new.owner_id,new.metadata->'references')
 from public.chat_turns t join public.sessions s on s.id=t.session_id where t.id=new.turn_id;
 return new;
end $$;
create trigger archive_completed_reply after insert or update of status on public.chat_replies
 for each row when(new.status='completed') execute function public.archive_reply_materials();

select public.archive_material_refs(s.project_id,r.owner_id,r.metadata->'references')
from public.chat_replies r join public.chat_turns t on t.id=r.turn_id join public.sessions s on s.id=t.session_id
where r.status='completed' and jsonb_typeof(r.metadata->'references')='array';

revoke all on function public.material_url_key(text), public.archive_material_refs(uuid,uuid,jsonb), public.archive_reply_materials(), public.save_material(uuid,text,text,text,text,text,text,text),public.list_materials(uuid,int),public.read_material(uuid,uuid) from public,anon;
grant execute on function public.material_url_key(text), public.archive_material_refs(uuid,uuid,jsonb), public.save_material(uuid,text,text,text,text,text,text,text),public.list_materials(uuid,int),public.read_material(uuid,uuid) to authenticated;

alter table public.project_materials add column attempted_at timestamptz, add column lease uuid;
create function public.claim_material(target uuid, ticket uuid) returns table(id uuid,origin text)
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,1));
 if (select count(*) from public.project_materials where project_id=target and attempted_at>now()-interval '1 day')>=25 then return; end if;
 return query update public.project_materials m set attempted_at=now(),lease=ticket where m.id=(
  select s.id from public.project_materials s where s.project_id=target and s.kind='url' and s.state='link' and not s.manual
  and (s.attempted_at is null or s.attempted_at<now()-interval '3 minutes')
  order by s.cited desc,s.created_at desc,s.id limit 1 for update skip locked
 ) returning m.id,m.origin;
end $$;
create function public.finish_material(target uuid,item uuid,ticket uuid,new_title text,new_body text,new_note text)
returns void language sql security invoker set search_path='' as $$
 update public.project_materials set state=case when new_note='' then 'ready' else 'failed' end,
 body=new_body,title=case when title=origin and new_title<>'' then new_title else title end,note=new_note,lease=null
 where id=item and project_id=target and lease=ticket and state='link'
$$;
revoke all on function public.claim_material(uuid,uuid),public.finish_material(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.claim_material(uuid,uuid),public.finish_material(uuid,uuid,uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';
