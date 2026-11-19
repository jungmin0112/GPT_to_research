create table public.app_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id)
);
alter table public.app_owner enable row level security;
revoke all on public.app_owner from anon, authenticated;
grant select on public.app_owner to authenticated;
create policy own_identity on public.app_owner for select to authenticated using (owner_id = (select auth.uid()));

create table public.projects (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references public.app_owner(owner_id),
  name text not null check (length(trim(name)) between 1 and 120),
  purpose text not null default '' check (length(purpose) <= 2000),
  created_at timestamptz not null default now(),
  unique(id, owner_id)
);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  project_id uuid not null,
  kind text not null check (kind = 'main'),
  title text not null default '메인 세션',
  foreign key(project_id, owner_id) references public.projects(id, owner_id),
  unique(id, owner_id)
);
create unique index one_main on public.sessions(project_id) where kind = 'main';

alter table public.projects enable row level security;
alter table public.sessions enable row level security;
revoke all on public.projects, public.sessions from anon, authenticated;
grant select, insert on public.projects, public.sessions to authenticated;
create policy owner_projects on public.projects to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy owner_sessions on public.sessions to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create function public.create_project(request_id uuid, project_name text, project_purpose text)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.projects(id,name,purpose) values(request_id,project_name,project_purpose)
    on conflict(id) do nothing;
  if not exists(select from public.projects where id=request_id and name=project_name and purpose=project_purpose)
    then raise exception 'project request conflict'; end if;
  insert into public.sessions(project_id,kind) values(request_id,'main')
    on conflict(project_id) where kind='main' do nothing;
  return (select id from public.sessions where project_id=request_id and kind='main');
end $$;
create function public.project_list() returns table(id uuid,name text,purpose text,session_id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.name,p.purpose,s.id from public.projects p join public.sessions s on s.project_id=p.id
  where s.kind='main' order by p.created_at desc,p.id
$$;
revoke all on function public.create_project(uuid,text,text),public.project_list() from public, anon;
grant execute on function public.create_project(uuid,text,text),public.project_list() to authenticated;
