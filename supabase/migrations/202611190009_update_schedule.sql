create table public.knowledge_attempts (
 ticket uuid primary key, project_id uuid not null, owner_id uuid not null default auth.uid(),
 is_manual boolean not null, started_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
alter table public.knowledge_attempts enable row level security;
create policy own_attempts on public.knowledge_attempts to authenticated using(owner_id=auth.uid());
revoke all on public.knowledge_attempts from public,anon,authenticated;
grant select,insert on public.knowledge_attempts to authenticated;
create index knowledge_attempt_times on public.knowledge_attempts(project_id,started_at);
create or replace function public.claim_knowledge(target uuid,job uuid,manual boolean) returns setof public.knowledge_events language plpgsql security invoker set search_path='' as $$
declare available int; oldest timestamptz; gap interval; claimed public.knowledge_events;begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 if exists(select from public.knowledge_events where project_id=target and state='working' and leased_at>now()-interval '3 minutes') then return;end if;
 update public.knowledge_events pending set state='done' where pending.project_id=target and pending.state in ('pending','failed')
 and exists(select from public.knowledge_events prior where prior.project_id=target and prior.state='done' and prior.body=pending.body and prior.title=pending.title);
 select count(*),min(created_at) into available,oldest from public.knowledge_events where project_id=target and state in ('pending','working','failed');
 gap:=make_interval(mins=>greatest(3,10-least(7,available-1)));
 if not manual and (oldest>now()-gap or exists(select from public.knowledge_attempts where project_id=target and started_at>now()-gap) or
 (select count(*) from public.knowledge_attempts where project_id=target and not is_manual and started_at>now()-interval '24 hours')>=50) then return;end if;
 update public.knowledge_events set state='working',ticket=job,leased_at=now(),attempts=attempts+1 where id=(
 select e.id from public.knowledge_events e where project_id=target and state<>'done'
 and (state<>'failed' or manual or (attempts<3 and leased_at<now()-interval '10 minutes'))
 order by case state when 'failed' then 1 else 0 end,
 (select count(*) from public.knowledge_events a where a.project_id=target and a.session_id=e.session_id and a.created_at>now()-interval '1 hour') desc,created_at,id limit 1) returning * into claimed;
 if found then
 insert into public.knowledge_attempts(project_id,ticket,is_manual) values(target,job,manual);
 return next claimed;end if;
end $$;
notify pgrst,'reload schema';

create or replace function public.knowledge_state(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with base as(select public.knowledge_base_state(target) as data)
 select data || jsonb_build_object('autoAttempts',(select count(*) from public.knowledge_attempts where project_id=target and not is_manual and started_at>now()-interval '24 hours'), 'activity',coalesce((select jsonb_agg(log order by created_at desc,id) from (select id,title,state,attempts,created_at from public.knowledge_events where project_id=target order by created_at desc,id limit 50) log),'[]'), 'changes',coalesce((select jsonb_agg(case when m.new_node is null then c else c||jsonb_build_object('node_id',m.new_node,'original_node',c->>'node_id') end order by c->>'created_at',c->>'id')
 from jsonb_array_elements(data->'changes') c left join public.knowledge_edits m on m.separated=(c->>'id')::uuid),'[]'),
 'edits',coalesce((select jsonb_agg(e order by e.created_at) from public.knowledge_edits e join public.knowledge_nodes n on n.id=e.node_id where n.project_id=target),'[]')) from base
$$;
