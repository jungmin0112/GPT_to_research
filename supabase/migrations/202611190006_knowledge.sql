create table public.knowledge_events (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,owner_id uuid not null default auth.uid(),
 kind text not null,source_id uuid not null,session_id uuid,title text not null,body text not null,origin jsonb not null,
 created_at timestamptz not null default now(),state text not null default 'pending' check(state in ('pending','working','done','failed')),
 ticket uuid,leased_at timestamptz, attempts int not null default 0,
 unique(project_id,kind,source_id),foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create table public.knowledge_nodes (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,owner_id uuid not null default auth.uid(),
 title text not null,topic text not null,body text not null,revision int not null default 1,
 unique(project_id,title), foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create table public.knowledge_changes (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid(),node_id uuid not null references public.knowledge_nodes,
 event_id uuid not null unique references public.knowledge_events,quote text not null,reason text not null,
 previous text not null,proposal text not null,accepted text,base_revision int not null,
 state text not null check(state in ('applied','review','rejected')),weight int not null check(weight between 0 and 3),
 created_at timestamptz not null default now(),decided_at timestamptz
);
do $$ declare n text; begin foreach n in array array['knowledge_events','knowledge_nodes','knowledge_changes'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('create policy own_records on public.%I to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',n);
 execute format('revoke all on public.%I from public, anon, authenticated',n);
 execute format('grant select,insert on public.%I to authenticated',n);
end loop;end $$;
grant update(state,ticket,leased_at,attempts) on public.knowledge_events to authenticated;
grant update(body,revision,topic) on public.knowledge_nodes to authenticated;
grant update(state,accepted,decided_at) on public.knowledge_changes to authenticated;
create function public.capture_research_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='project_materials' then
 if new.state='ready' and trim(new.body)<>'' then
 insert into public.knowledge_events(project_id,owner_id,kind,source_id,title,body,origin)
 values(new.project_id,new.owner_id,'material',new.id,new.title,new.body,jsonb_build_object('kind',new.kind,'origin',new.origin)) on conflict do nothing;
 end if;
 elsif new.status='completed' and not (new.metadata ? 'reading_turn') then
 insert into public.knowledge_events(project_id,owner_id,kind,source_id,session_id,title,body,origin)
 select s.project_id,t.owner_id,'reply',new.id,s.id,t.question,new.answer,new.metadata from public.chat_turns t join public.sessions s on s.id=t.session_id where t.id=new.turn_id on conflict do nothing;
 end if;
 return new;
end $$;
create trigger capture_material_event after insert or update of state,body on public.project_materials for each row execute function public.capture_research_event();
create trigger capture_answer_event after insert or update of status on public.chat_replies for each row execute function public.capture_research_event();
insert into public.knowledge_events(project_id,owner_id,kind,source_id,title,body,origin,created_at)
select project_id,owner_id,'material',id,title,body,jsonb_build_object('kind',kind,'origin',origin),created_at from public.project_materials where state='ready' and trim(body)<>'' on conflict do nothing;
insert into public.knowledge_events(project_id,owner_id,kind,source_id,session_id,title,body,origin,created_at)
select s.project_id,t.owner_id,'reply',r.id,s.id,t.question,r.answer,r.metadata,r.created_at from public.chat_replies r join public.chat_turns t on t.id=r.turn_id join public.sessions s on s.id=t.session_id where r.status='completed' and not(r.metadata ? 'reading_turn') on conflict do nothing;
create index knowledge_queue on public.knowledge_events(project_id,state,created_at);
create function public.claim_knowledge(target uuid,job uuid,manual boolean) returns setof public.knowledge_events language plpgsql security invoker set search_path='' as $$
declare available int; oldest timestamptz;begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 if exists(select from public.knowledge_events where project_id=target and state='working' and leased_at>now()-interval '3 minutes') then return;end if;
 update public.knowledge_events pending set state='done' where pending.project_id=target and pending.state in ('pending','failed')
 and exists(select from public.knowledge_events prior where prior.project_id=target and prior.state='done' and prior.body=pending.body and prior.title=pending.title);
 select count(*),min(created_at) into available,oldest from public.knowledge_events where project_id=target and state in ('pending','working','failed');
 if not manual and (oldest>now()-make_interval(mins=>greatest(3,10-least(7,available-1))) or
 (select count(*) from public.knowledge_events where project_id=target and leased_at>now()-interval '24 hours')>=50) then return;end if;
 return query update public.knowledge_events set state='working',ticket=job,leased_at=now(),attempts=attempts+1 where id=(
 select id from public.knowledge_events where project_id=target and state<>'done'
 and (state<>'failed' or manual or (attempts<3 and leased_at<now()-interval '10 minutes'))
 order by case state when 'failed' then 1 else 0 end,created_at,id limit 1) returning *;
end $$;
create function public.commit_knowledge(target uuid,job uuid,decision jsonb) returns text language plpgsql security invoker set search_path='' as $$
declare e public.knowledge_events;n public.knowledge_nodes;mode text:=decision->>'action';q text:=decision->>'quote';body_new text:=decision->>'body';result text;begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 select * into e from public.knowledge_events where project_id=target and ticket=job and state='working' for update;
 if not found then return 'stale';end if;
 if mode='failed' then update public.knowledge_events set state='failed' where id=e.id;return 'failed';end if;
 if mode='skip' then result:='skipped';
 else
 if mode not in ('new','extend','conflict') or coalesce(length(q),0)=0 or strpos(e.body,q)=0 or coalesce(length(trim(body_new)),0)=0 or coalesce(length(trim(decision->>'title')),0)=0 then raise exception 'invalid evidence';end if;
 select * into n from public.knowledge_nodes where project_id=target and title=trim(decision->>'title') for update;
 if not found then
 insert into public.knowledge_nodes(project_id,title,topic,body) values(target,trim(decision->>'title'),decision->>'topic',body_new) returning * into n;
 insert into public.knowledge_changes(node_id,event_id,quote,reason,previous,proposal,accepted,base_revision,state,weight)
 values(n.id,e.id,q,decision->>'reason','',body_new,body_new,0,'applied',2);result:='created';
 elsif exists(select from public.knowledge_changes where node_id=n.id and quote=q and state<>'rejected') or n.body=body_new then result:='duplicate';
 elsif mode='extend' and n.revision=(decision->>'revision')::int then
 insert into public.knowledge_changes(node_id,event_id,quote,reason,previous,proposal,accepted,base_revision,state,weight)
 values(n.id,e.id,q,decision->>'reason',n.body,body_new,n.body||E'\n\n'||body_new,n.revision,'applied',1);
 update public.knowledge_nodes set body=n.body||E'\n\n'||body_new,revision=n.revision+1 where id=n.id;result:='extended';
 else
 insert into public.knowledge_changes(node_id,event_id,quote,reason,previous,proposal,base_revision,state,weight)
 values(n.id,e.id,q,decision->>'reason',n.body,body_new,n.revision,'review',1);result:='review';end if;
 end if;
 update public.knowledge_events set state='done' where id=e.id;return result;
end $$;
create function public.review_knowledge(target uuid,item uuid,expected int,choice text,edited text) returns text language plpgsql security invoker set search_path='' as $$
declare c public.knowledge_changes;n public.knowledge_nodes;begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 select * into c from public.knowledge_changes where id=item for update;
 select * into strict n from public.knowledge_nodes where id=c.node_id and project_id=target for update;
 if c.state<>'review' then return c.state;end if;
 if expected<>n.revision then return 'stale';end if;
 if choice='reject' then update public.knowledge_changes set state='rejected',decided_at=now() where id=item;return 'rejected';end if;
 if choice<>'accept' or trim(edited)='' then raise exception 'invalid decision';end if;
 update public.knowledge_nodes set body=edited,revision=revision+1 where id=n.id;
 update public.knowledge_changes set state='applied',accepted=edited,decided_at=now() where id=item;return 'applied';
end $$;
create function public.knowledge_state(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('nodes',coalesce((select jsonb_agg(n order by topic,title) from public.knowledge_nodes n where project_id=target),'[]'),
 'changes',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('kind',e.kind,'source_id',e.source_id,'session_id',e.session_id,'origin',e.origin,'source_title',e.title) order by c.created_at) from public.knowledge_changes c join public.knowledge_events e on e.id=c.event_id where e.project_id=target),'[]'),
 'pending',(select count(*) from public.knowledge_events where project_id=target and state<>'done'),
 'failed',(select count(*) from public.knowledge_events where project_id=target and state='failed'))
$$;
revoke all on function public.claim_knowledge(uuid,uuid,boolean),public.commit_knowledge(uuid,uuid,jsonb),public.review_knowledge(uuid,uuid,integer,text,text),public.knowledge_state(uuid) from public,anon;
grant execute on function public.claim_knowledge(uuid,uuid,boolean),public.commit_knowledge(uuid,uuid,jsonb),public.review_knowledge(uuid,uuid,integer,text,text),public.knowledge_state(uuid) to authenticated;
notify pgrst,'reload schema';
