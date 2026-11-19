-- Capture the user-selected reference together with the in-flight attempt.
create function public.begin_source_turn(target uuid, turn uuid, attempt uuid, body text, search text, material uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare outcome text;
begin
 if not exists(select from public.sessions s join public.project_materials m on m.project_id=s.project_id
    where s.id=target and m.id=material and m.state='ready') then return 'missing'; end if;
 outcome:=public.begin_turn(target,turn,attempt,body,search);
 if outcome='started' then update public.chat_replies set metadata=jsonb_build_object('explicit_ref',material) where id=attempt; end if;
 return outcome;
end $$;
revoke all on function public.begin_source_turn(uuid,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.begin_source_turn(uuid,uuid,uuid,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
