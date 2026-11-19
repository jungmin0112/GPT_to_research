alter table public.sessions drop constraint sessions_kind_check;
alter table public.sessions add column parent_id uuid, add column material_id uuid,
 add column context_level integer not null default 0 check(context_level between 0 and 3),
 add column cross_project boolean not null default false,
 add unique(id,project_id);
alter table public.project_materials add unique(id,project_id);
alter table public.sessions add foreign key(parent_id,project_id) references public.sessions(id,project_id),
 add foreign key(material_id,project_id) references public.project_materials(id,project_id),
 add check ((kind='main' and parent_id is null and material_id is null) or
 (kind='branch' and parent_id is not null) or (kind='mini' and material_id is not null and parent_id is null));
create unique index material_conversation on public.sessions(material_id) where kind='mini';
grant update(context_level,cross_project) on public.sessions to authenticated;

create function public.explore_sessions(target uuid) returns setof public.sessions language sql stable security invoker set search_path='' as $$
 select * from public.sessions where project_id=target order by kind,title,id
$$;
create function public.open_exploration(target uuid, parent uuid, material uuid, label text, mini boolean, request_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if mini then
  insert into public.sessions(project_id,kind,title,material_id)
  select target,'mini',m.title,m.id from public.project_materials m where m.id=material and m.project_id=target and m.state='ready'
  on conflict(material_id) where kind='mini' do nothing;
  select id into strict result from public.sessions where material_id=material and project_id=target and kind='mini';
 else
  if trim(label)='' or length(label)>120 then raise exception 'invalid title'; end if;
  insert into public.sessions(id,project_id,parent_id,material_id,kind,title) values(request_id,target,parent,material,'branch',trim(label)) on conflict(id) do nothing;
  select id into strict result from public.sessions where id=request_id and project_id=target and parent_id=parent and title=trim(label) and material_id is not distinct from material;
 end if;
 return result;
end $$;
create function public.context_settings(target uuid,level integer,external boolean) returns void language sql security invoker set search_path='' as $$
 update public.sessions set context_level=level,cross_project=external where id=target and kind<>'mini'
$$;
create function public.related_records(target uuid,question text) returns table(id uuid,session_id uuid,answer text) language sql stable security invoker set search_path='' as $$
 select t.id,s.id,left(r.answer,1500) from public.sessions current_session
 join public.sessions s on s.id<>current_session.id and s.kind<>'mini' and (s.project_id=current_session.project_id or current_session.cross_project)
 join public.chat_turns t on t.session_id=s.id join public.chat_replies r on r.turn_id=t.id and r.status='completed'
 where current_session.id=target and current_session.kind<>'mini' and exists(select from regexp_split_to_table(trim(question),'\s+') w where length(w)>1 and strpos(lower(t.question||' '||r.answer),lower(w))>0)
 order by (s.id=current_session.parent_id) desc,t.created_at desc,t.id limit (select context_level*2 from public.sessions where id=target)
$$;
create table public.reading_transfers(turn_id uuid primary key references public.chat_turns(id),destination uuid not null unique references public.chat_turns(id),owner_id uuid not null default auth.uid() references public.app_owner(owner_id));
alter table public.reading_transfers enable row level security;
create policy own_transfers on public.reading_transfers to authenticated using(owner_id=auth.uid());
grant select,insert on public.reading_transfers to authenticated;
create function public.forward_reading(target uuid,mini_id uuid,selected uuid[]) returns integer language plpgsql security invoker set search_path='' as $$
declare main_id uuid; row record; dst uuid; attempt uuid; n int:=0;
begin
 select id into strict main_id from public.sessions where project_id=target and kind='main';
 perform pg_advisory_xact_lock(hashtextextended(main_id::text,0));
 if not exists(select from public.sessions where id=mini_id and project_id=target and kind='mini') then raise exception 'invalid reading'; end if;
 for row in select h.*,s.material_id,s.title from public.chat_history(mini_id) h join public.sessions s on s.id=mini_id where h.id=any(selected) and h.status='completed' loop
  if exists(select from public.reading_transfers where turn_id=row.id) then continue; end if;
  dst:=gen_random_uuid();attempt:=gen_random_uuid();
  if public.begin_turn(main_id,dst,attempt,row.question,'off')<>'started' then raise exception 'main session busy'; end if;
  perform public.finish_turn(attempt,'completed',row.answer,row.metadata||jsonb_build_object('reading_turn',row.id,'explicit_ref',row.material_id,'explicit_ref_title',row.title));
  insert into public.reading_transfers(turn_id,destination) values(row.id,dst);
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.explore_sessions(uuid),public.open_exploration(uuid,uuid,uuid,text,boolean,uuid),public.context_settings(uuid,integer,boolean),public.related_records(uuid,text),public.forward_reading(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.explore_sessions(uuid),public.open_exploration(uuid,uuid,uuid,text,boolean,uuid),public.context_settings(uuid,integer,boolean),public.related_records(uuid,text),public.forward_reading(uuid,uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';
