alter table public.marketing_content
  drop constraint if exists marketing_content_platform_check;

alter table public.marketing_content
  add constraint marketing_content_platform_check
  check (platform in ('telegram', 'instagram', 'facebook', 'linkedin', 'threads'));

create table if not exists public.marketing_generation_daily_runs (
  run_date date primary key,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb
);

alter table public.marketing_generation_daily_runs enable row level security;
revoke all on table public.marketing_generation_daily_runs from public, anon, authenticated;
grant select, update on table public.marketing_generation_daily_runs to service_role;

create or replace function public.claim_marketing_generation_daily_run(p_run_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if p_run_date <> (now() at time zone 'utc')::date then
    return false;
  end if;

  insert into public.marketing_generation_daily_runs as existing_run (run_date, status)
  values (p_run_date, 'running')
  on conflict (run_date) do update
    set status = 'running',
        started_at = now(),
        completed_at = null,
        result = '{}'::jsonb
    where existing_run.status = 'failed'
       or (
         existing_run.status = 'running'
         and existing_run.started_at < now() - interval '30 minutes'
       )
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_marketing_generation_daily_run(date) from public, anon, authenticated;
grant execute on function public.claim_marketing_generation_daily_run(date) to service_role;
