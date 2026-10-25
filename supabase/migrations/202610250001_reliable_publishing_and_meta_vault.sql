alter table public.meta_token_health_alerts
  drop constraint if exists meta_token_health_alerts_status_check;

alter table public.meta_token_health_alerts
  add constraint meta_token_health_alerts_status_check
  check (status in ('invalid', 'expired', 'expiring', 'not_configured', 'unknown', 'unavailable', 'refresh_failed'));

create or replace function public.claim_meta_token_health_alert(
  p_token_name text,
  p_status text,
  p_alerted_on date
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.meta_token_health_alerts as existing_alert (token_name, status, alerted_on)
  values (p_token_name, p_status, p_alerted_on)
  on conflict (token_name) do update
    set status = excluded.status, alerted_on = excluded.alerted_on
    where existing_alert.status is distinct from excluded.status
       or existing_alert.alerted_on is distinct from excluded.alerted_on
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_meta_token_health_alert(text, text, date) from public, anon, authenticated;
grant execute on function public.claim_meta_token_health_alert(text, text, date) to service_role;

create table if not exists public.product_publish_daily_runs (
  run_date date primary key,
  idempotency_key text not null unique,
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb
);

alter table public.product_publish_daily_runs enable row level security;
revoke all on table public.product_publish_daily_runs from public, anon, authenticated;
grant select, update on table public.product_publish_daily_runs to service_role;

create or replace function public.claim_product_publish_daily_run(
  p_run_date date,
  p_idempotency_key text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if p_run_date <> (now() at time zone 'utc')::date
     or p_idempotency_key <> 'product-publish:' || to_char(p_run_date, 'YYYY-MM-DD') then
    return false;
  end if;

  insert into public.product_publish_daily_runs (run_date, idempotency_key, status)
  values (p_run_date, p_idempotency_key, 'running')
  on conflict do nothing
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_product_publish_daily_run(date, text) from public, anon, authenticated;
grant execute on function public.claim_product_publish_daily_run(date, text) to service_role;

create table if not exists public.meta_token_vault (
  id integer primary key check (id = 1),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);

alter table public.meta_token_vault enable row level security;
revoke all on table public.meta_token_vault from public, anon, authenticated;
grant select, insert, update on table public.meta_token_vault to service_role;

create table if not exists public.meta_token_refresh_locks (
  id integer primary key check (id = 1),
  owner uuid not null,
  lease_until timestamptz not null
);

alter table public.meta_token_refresh_locks enable row level security;
revoke all on table public.meta_token_refresh_locks from public, anon, authenticated;
grant select, update on table public.meta_token_refresh_locks to service_role;

create or replace function public.claim_meta_token_refresh_lock(
  p_owner uuid,
  p_lease_until timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.meta_token_refresh_locks as existing_lock (id, owner, lease_until)
  values (1, p_owner, p_lease_until)
  on conflict (id) do update
    set owner = excluded.owner, lease_until = excluded.lease_until
    where existing_lock.lease_until < now()
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_meta_token_refresh_lock(p_owner uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  delete from public.meta_token_refresh_locks where id = 1 and owner = p_owner;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.claim_meta_token_refresh_lock(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_meta_token_refresh_lock(uuid) from public, anon, authenticated;
grant execute on function public.claim_meta_token_refresh_lock(uuid, timestamptz) to service_role;
grant execute on function public.release_meta_token_refresh_lock(uuid) to service_role;

create table if not exists public.meta_token_refresh_attempts (
  token_expires_at timestamptz primary key,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  attempted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_token_refresh_attempts enable row level security;
revoke all on table public.meta_token_refresh_attempts from public, anon, authenticated;
grant select, update on table public.meta_token_refresh_attempts to service_role;

create or replace function public.claim_meta_token_refresh_attempt(p_token_expires_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.meta_token_refresh_attempts (token_expires_at, status)
  values (p_token_expires_at, 'running')
  on conflict do nothing
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_meta_token_refresh_attempt(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_meta_token_refresh_attempt(timestamptz) to service_role;
