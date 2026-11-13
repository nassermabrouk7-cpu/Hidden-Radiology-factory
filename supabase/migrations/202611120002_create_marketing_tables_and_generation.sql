-- Create marketing_content table if it doesn't exist
create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  product_id text,
  platform text not null,
  language text not null,
  content_type text not null,
  title text not null,
  hook text not null,
  body text not null,
  cta text not null,
  hashtags jsonb default '[]'::jsonb,
  destination_url text,
  scheduled_at timestamptz,
  status text not null default 'queued',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publish_attempts integer default 0,
  last_attempt_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  error_message text,
  platform_response jsonb default '{}'::jsonb
);

-- Create marketing_campaigns table if it doesn't exist
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  name text not null,
  objective text not null,
  audience text not null,
  positioning text not null,
  theme text not null,
  language_strategy text not null,
  status text not null default 'ready',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now apply the constraint changes to marketing_content
alter table public.marketing_content
  drop constraint if exists marketing_content_platform_check;

alter table public.marketing_content
  add constraint marketing_content_platform_check
  check (platform in ('telegram', 'instagram', 'facebook', 'linkedin', 'threads'));

-- Create marketing_generation_daily_runs table
create table if not exists public.marketing_generation_daily_runs (
  run_date date primary key,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb
);

-- Enable RLS and grant permissions
alter table public.marketing_generation_daily_runs enable row level security;
revoke all on table public.marketing_generation_daily_runs from public, anon, authenticated;
grant select, update on table public.marketing_generation_daily_runs to service_role;

-- Create the function
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

-- Enable RLS for marketing tables
alter table public.marketing_content enable row level security;
alter table public.marketing_campaigns enable row level security;

-- Grant permissions for marketing tables
revoke all on table public.marketing_content from public, anon, authenticated;
revoke all on table public.marketing_campaigns from public, anon, authenticated;

grant select, insert, update on table public.marketing_content to service_role;
grant select, insert, update on table public.marketing_campaigns to service_role;
