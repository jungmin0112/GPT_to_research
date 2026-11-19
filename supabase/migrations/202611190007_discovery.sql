create function public.research_search(query_text text,category text,page_offset integer)
returns table(kind text,id uuid,project_id uuid,title text,excerpt text) language sql stable security invoker set search_path='' as $$
 select r.kind,r.id,r.project_id,r.title,left(r.content,320) from (
 select 'project'::text kind,p.id,p.id project_id,p.name title,p.purpose content from public.projects p
 union all select 'session',s.id,s.project_id,s.title,s.kind from public.sessions s
 union all select 'material',m.id,m.project_id,m.title,m.origin||' '||m.body from public.project_materials m
 union all select 'knowledge',n.id,n.project_id,n.title,n.topic||' '||n.body from public.knowledge_nodes n
 ) r where (category='' or category=r.kind) and strpos(lower(r.title||' '||r.content),lower(trim(query_text)))>0
 order by r.title,r.kind,r.id limit 50 offset greatest(page_offset,0)
$$;
create function public.begin_node_turn(target uuid,turn uuid,attempt uuid,body text,search text,node uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare outcome text;begin
 if not exists(select from public.sessions s join public.knowledge_nodes n on n.project_id=s.project_id where s.id=target and n.id=node) then return 'missing';end if;
 outcome:=public.begin_turn(target,turn,attempt,body,search);
 if outcome='started' then update public.chat_replies set metadata=jsonb_build_object('explicit_node',node) where id=attempt;end if;
 return outcome;
end $$;
revoke all on function public.research_search(text,text,int),public.begin_node_turn(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.research_search(text,text,int),public.begin_node_turn(uuid,uuid,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';

create table public.knowledge_edits(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.app_owner(owner_id),
 node_id uuid not null references public.knowledge_nodes,previous jsonb not null,updated jsonb not null,
 separated uuid unique references public.knowledge_changes,new_node uuid references public.knowledge_nodes,created_at timestamptz not null default now()
);
alter table public.knowledge_edits enable row level security;
create policy own_edits on public.knowledge_edits to authenticated using(owner_id=auth.uid());
revoke all on public.knowledge_edits from public,anon,authenticated;
grant select,insert on public.knowledge_edits to authenticated;
create function public.edit_knowledge(target uuid,node uuid,expected int,content text,category text,separate uuid,new_title text) returns text language plpgsql security invoker set search_path='' as $$
declare n public.knowledge_nodes; change public.knowledge_changes; dest uuid;before jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 select * into strict n from public.knowledge_nodes where id=node and project_id=target for update;
 if n.revision<>expected then return 'stale';end if;
 if trim(content)='' or trim(category)='' then raise exception 'empty edit';end if;
 before:=to_jsonb(n);
 if separate is not null then
 select * into strict change from public.knowledge_changes where id=separate and node_id=node and state='applied';
 if trim(new_title)='' then raise exception 'missing title';end if;
 insert into public.knowledge_nodes(project_id,title,topic,body) values(target,trim(new_title),trim(category),change.proposal) returning id into dest;
 end if;
 update public.knowledge_nodes set body=content,topic=trim(category),revision=revision+1 where id=node returning * into n;
 insert into public.knowledge_edits(node_id,previous,updated,separated,new_node) values(node,before,to_jsonb(n),separate,dest);return 'saved';
end $$;
alter function public.knowledge_state(uuid) rename to knowledge_base_state;
create function public.knowledge_state(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with base as(select public.knowledge_base_state(target) as data)
 select data || jsonb_build_object('changes',coalesce((select jsonb_agg(case when m.new_node is null then c else c||jsonb_build_object('node_id',m.new_node,'original_node',c->>'node_id') end order by c->>'created_at',c->>'id')
 from jsonb_array_elements(data->'changes') c left join public.knowledge_edits m on m.separated=(c->>'id')::uuid),'[]'),
 'edits',coalesce((select jsonb_agg(e order by e.created_at) from public.knowledge_edits e join public.knowledge_nodes n on n.id=e.node_id where n.project_id=target),'[]')) from base
$$;
revoke all on function public.edit_knowledge(uuid,uuid,int,text,text,uuid,text),public.knowledge_state(uuid) from public,anon;
grant execute on function public.edit_knowledge(uuid,uuid,int,text,text,uuid,text),public.knowledge_state(uuid) to authenticated;

alter table public.sessions add column anchor_turn uuid references public.chat_turns,add column anchor_node uuid references public.knowledge_nodes;
grant update(anchor_turn,anchor_node) on public.sessions to authenticated;
create function public.anchored_branch(target uuid,parent uuid,label text,request_id uuid,anchor_turn uuid,anchor_node uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare child uuid;begin
 if (anchor_turn is null)=(anchor_node is null) then raise exception 'choose one anchor';end if;
 if anchor_turn is not null and not exists(select from public.chat_turns where id=anchor_turn and session_id=parent) then raise exception 'unknown turn';end if;
 if anchor_node is not null and not exists(select from public.knowledge_nodes where id=anchor_node and project_id=target) then raise exception 'unknown node';end if;
 child:=public.open_exploration(target,parent,null,label,false,request_id);
 update public.sessions s set anchor_turn=anchored_branch.anchor_turn,anchor_node=anchored_branch.anchor_node where s.id=child and
 (s.anchor_turn is null and s.anchor_node is null or s.anchor_turn is not distinct from anchored_branch.anchor_turn and s.anchor_node is not distinct from anchored_branch.anchor_node);
 if not found then raise exception 'branch conflict';end if;return child;
end $$;
revoke all on function public.anchored_branch(uuid,uuid,text,uuid,uuid,uuid) from public,anon;
grant execute on function public.anchored_branch(uuid,uuid,text,uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
