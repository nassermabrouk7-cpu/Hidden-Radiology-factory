create table if not exists public.meta_token_health_alerts (
  token_name text primary key check (token_name in ('facebook', 'instagram')),
  status text not null check (status in ('invalid', 'expired', 'expiring')),
  alerted_on date not null
);

alter table public.meta_token_health_alerts enable row level security;
revoke all on table public.meta_token_health_alerts from public, anon, authenticated;
grant delete on table public.meta_token_health_alerts to service_role;

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
  returning true into claimed;
  if claimed is null then
    return false;
  end if;
  return claimed;
end;
$$;

revoke all on function public.claim_meta_token_health_alert(text, text, date) from public, anon, authenticated;
grant execute on function public.claim_meta_token_health_alert(text, text, date) to service_role;
