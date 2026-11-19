create table public.chat_turns (
  id uuid primary key,
  session_id uuid not null,
  owner_id uuid not null default auth.uid(),
  question text not null check(length(trim(question)) between 1 and 12000),
  search_mode text not null check(search_mode in ('auto','off','required')),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,owner_id),
  foreign key(session_id,owner_id) references public.sessions(id,owner_id)
);
create index chat_history on public.chat_turns(session_id,created_at);
create table public.chat_replies (
  id uuid primary key,
  turn_id uuid not null,
  owner_id uuid not null default auth.uid(),
  status text not null default 'working' check(status in ('working','completed','failed')),
  answer text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  foreign key(turn_id,owner_id) references public.chat_turns(id,owner_id)
);
create index replies_for_turn on public.chat_replies(turn_id,created_at desc);
alter table public.chat_turns enable row level security;
alter table public.chat_replies enable row level security;
revoke all on public.chat_turns, public.chat_replies from anon,authenticated;
grant select,insert on public.chat_turns,public.chat_replies to authenticated;
grant update(status,answer,metadata) on public.chat_replies to authenticated;
create policy own_turns on public.chat_turns to authenticated using(owner_id=(select auth.uid()));
create policy own_replies on public.chat_replies to authenticated using(owner_id=(select auth.uid()));
create function public.chat_history(target uuid)
returns table(id uuid,question text,search_mode text,status text,answer text,metadata jsonb)
language sql stable security invoker set search_path='' as $$
 select t.id,t.question,t.search_mode,
 case when r.status='working' and r.created_at < now()-interval '3 minutes' then 'failed' else r.status end,
 r.answer,r.metadata from public.chat_turns t
 join lateral(select * from public.chat_replies where turn_id=t.id order by created_at desc limit 1) r on true
 where t.session_id=target order by t.created_at,t.id
$$;
create function public.begin_turn(target uuid, turn uuid, attempt uuid, body text, search text)
returns text language plpgsql security invoker set search_path='' as $$
declare old public.chat_turns; last_status text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if not exists(select from public.sessions where id=target) then return 'missing'; end if;
 select * into old from public.chat_turns where id=turn;
 if found and (old.session_id<>target or old.question<>body or old.search_mode<>search) then return 'conflict'; end if;
 select status into last_status from public.chat_history(target) where id=turn;
 if last_status='completed' then return 'completed'; end if;
 if exists(select from public.chat_history(target) where status='working') then return 'busy'; end if;
 if old.id is not null and old.id<>(select id from public.chat_turns where session_id=target order by created_at desc limit 1) then return 'conflict'; end if;
 insert into public.chat_turns(id,session_id,question,search_mode) values(turn,target,body,search) on conflict(id) do nothing;
 update public.chat_replies set status='failed' where turn_id=turn and status='working';
 insert into public.chat_replies(id,turn_id) values(attempt,turn);
 return 'started';
end $$;
create function public.finish_turn(attempt uuid, outcome text, body text, details jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if outcome not in ('completed','failed') then return false; end if;
 update public.chat_replies set status=outcome,answer=body,metadata=details where id=attempt and status='working';
 return found;
end $$;
revoke all on function public.chat_history(uuid),public.begin_turn(uuid,uuid,uuid,text,text),public.finish_turn(uuid,text,text,jsonb) from public,anon;
grant execute on function public.chat_history(uuid),public.begin_turn(uuid,uuid,uuid,text,text),public.finish_turn(uuid,text,text,jsonb) to authenticated;
