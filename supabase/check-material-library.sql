-- Read-only. Report object names and grants without reading any project data.
with required(migration, signature) as (values
 ('190001_sources','public.list_materials(uuid,integer)'),
 ('190001_sources','public.claim_material(uuid,uuid)'),
 ('190001_sources','public.read_material(uuid,uuid)'),
 ('190001_sources','public.save_material(uuid,text,text,text,text,text,text,text)'),
 ('190001_sources','public.finish_material(uuid,uuid,uuid,text,text,text)'),
 ('190003_source_turn','public.begin_source_turn(uuid,uuid,uuid,text,text,uuid)'),
 ('190004_material_library','public.search_materials(uuid,integer,text,text)')
)
select migration,signature as object,
 case when to_regprocedure(signature) is null then 'missing'
 when has_function_privilege('authenticated',to_regprocedure(signature),'execute') then 'ready'
 else 'missing grant' end as status from required
union all select '190001_sources','project_materials',case when to_regclass('public.project_materials') is null then 'missing' else 'ready' end
union all select '190001_sources','archive_completed_reply',case when exists(select from pg_trigger where tgrelid=to_regclass('public.chat_replies') and tgname='archive_completed_reply' and tgenabled in ('O','A')) then 'ready' else 'missing or disabled' end
union all select '190002_material_storage',p,case when exists(select from pg_policies where schemaname='storage' and tablename='objects' and policyname=p) then 'ready' else 'missing' end
from (values ('material_pdf_read'),('material_pdf_insert')) as policies(p)
order by 1,2;
