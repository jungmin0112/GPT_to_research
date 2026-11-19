alter table public.sessions drop constraint sessions_context_level_check;
alter table public.sessions add check(context_level between 0 and 4),
 add column parent_scope int not null default 4 check(parent_scope between 0 and 4),
 add column peer_scope int not null default 4 check(peer_scope between 0 and 4),
 add column knowledge_scope int not null default 0 check(knowledge_scope between 0 and 4);
grant update(parent_scope,peer_scope,knowledge_scope) on public.sessions to authenticated;
create function public.context_policy(target uuid,level int,external boolean,parent_scope int,peer_scope int,knowledge_scope int) returns void language sql security invoker set search_path='' as $$
 update public.sessions set context_level=level,cross_project=external,parent_scope=context_policy.parent_scope,peer_scope=context_policy.peer_scope,knowledge_scope=context_policy.knowledge_scope where id=target and kind<>'mini'
$$;
create function public.context_records(target uuid,question text) returns table(id uuid,session_id uuid,answer text,category text) language sql stable security invoker set search_path='' as $$
 with cfg as(select * from public.sessions where id=target and kind<>'mini' and context_level>0), candidates as(
 select t.id,s.id session_id,left(r.answer,1500) answer,
 case when s.id=c.parent_id then 'parent' else 'peer' end category,t.question||' '||r.answer haystack,
 case when s.id=c.parent_id then c.parent_scope else c.peer_scope end cap,t.created_at stamp
 from cfg c join public.sessions s on s.kind<>'mini' and s.id<>target and (s.project_id=c.project_id or c.cross_project)
 join public.chat_turns t on t.session_id=s.id join public.chat_replies r on r.turn_id=t.id and r.status='completed'
 union all select n.id,null::uuid,left(n.body,1500),'knowledge',n.title||' '||n.body,c.knowledge_scope,'epoch'::timestamptz
 from cfg c join public.knowledge_nodes n on n.project_id=c.project_id or c.cross_project
 ), ranked as(select v.*,row_number() over(partition by v.category order by v.stamp desc,v.id) ord from candidates v where cap>0 and
 exists(select from regexp_split_to_table(trim(question),'\s+') w where length(w)>1 and strpos(lower(v.haystack),lower(w))>0))
 select r.id,r.session_id,r.answer,r.category from ranked r where ord<=cap*2 order by ord,case r.category when 'parent' then 0 when 'peer' then 1 else 2 end limit (select context_level*2 from cfg)
$$;
create table public.reading_digests(id uuid primary key default gen_random_uuid(),session_id uuid not null,owner_id uuid not null default auth.uid(),fingerprint text not null,digest jsonb not null,created_at timestamptz not null default now(),
 foreign key(session_id,owner_id) references public.sessions(id,owner_id),unique(session_id,fingerprint));
alter table public.reading_digests enable row level security;
create policy own_digests on public.reading_digests to authenticated using(owner_id=auth.uid());
revoke all on public.reading_digests from public,anon,authenticated;grant select,insert on public.reading_digests to authenticated;
create function public.reading_digest(target uuid,signature text,summary jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select from public.sessions where id=target and kind='mini') then raise exception 'invalid mini session'; end if;
 if summary is not null then insert into public.reading_digests(session_id,fingerprint,digest) values(target,signature,summary) on conflict do nothing;end if;
 return (select digest from public.reading_digests where session_id=target and fingerprint=signature);
end $$;
revoke all on function public.context_policy(uuid,int,boolean,int,int,int),public.context_records(uuid,text),public.reading_digest(uuid,text,jsonb) from public,anon;
grant execute on function public.context_policy(uuid,int,boolean,int,int,int),public.context_records(uuid,text),public.reading_digest(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
