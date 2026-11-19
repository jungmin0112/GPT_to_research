-- Read-only inventory for 005–009. All rows must say ready.
with funcs(signature) as (values
 ('public.open_exploration(uuid,uuid,uuid,text,boolean,uuid)'),('public.forward_reading(uuid,uuid,uuid[])'),
 ('public.claim_knowledge(uuid,uuid,boolean)'),('public.commit_knowledge(uuid,uuid,jsonb)'),
 ('public.review_knowledge(uuid,uuid,integer,text,text)'),('public.knowledge_state(uuid)'),
 ('public.research_search(text,text,integer)'),('public.anchored_branch(uuid,uuid,text,uuid,uuid,uuid)'),
 ('public.edit_knowledge(uuid,uuid,integer,text,text,uuid,text)'),('public.begin_node_turn(uuid,uuid,uuid,text,text,uuid)'),
 ('public.context_policy(uuid,integer,boolean,integer,integer,integer)'),('public.context_records(uuid,text)'),
 ('public.reading_digest(uuid,text,jsonb)')
), tables(name) as (values ('reading_transfers'),('reading_digests'),('knowledge_changes'),('knowledge_nodes'),('knowledge_events'),('knowledge_edits'),('knowledge_attempts'))
select signature as object, case when to_regprocedure(signature) is not null
 and has_function_privilege('authenticated',to_regprocedure(signature),'execute')
 and not has_function_privilege('anon',to_regprocedure(signature),'execute') then 'ready' else 'check RPC/grants' end as status from funcs
union all select name,case when exists(select from pg_class where oid=to_regclass('public.'||name) and relrowsecurity) then 'ready' else 'check table/RLS' end from tables
union all select t,case when exists(select from pg_trigger where tgname=t and tgrelid=to_regclass(rel) and tgenabled in ('A','O')) then 'ready' else 'check trigger' end
from (values ('capture_material_event','public.project_materials'),('capture_answer_event','public.chat_replies')) triggers(t,rel)
order by 1;
