create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  product_ids text[] not null default '{}',
  payment_gateway text not null check (payment_gateway = 'paymob'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  paymob_order_id text unique,
  transaction_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  paid_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paymob_webhook_events (
  transaction_id text primary key,
  reference_id text not null,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.payment_fulfillment_outbox (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent')),
  attempts integer not null default 0,
  last_error text,
  processing_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.purchases enable row level security;
alter table public.paymob_webhook_events enable row level security;
alter table public.payment_fulfillment_outbox enable row level security;

drop policy if exists "purchases_no_client_access" on public.purchases;
create policy "purchases_no_client_access" on public.purchases
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "paymob_webhook_events_no_client_access" on public.paymob_webhook_events;
create policy "paymob_webhook_events_no_client_access" on public.paymob_webhook_events
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "payment_fulfillment_outbox_no_client_access" on public.payment_fulfillment_outbox;
create policy "payment_fulfillment_outbox_no_client_access" on public.payment_fulfillment_outbox
  for all to anon, authenticated using (false) with check (false);

create or replace function public.apply_paymob_success(
  p_reference_id text,
  p_paymob_order_id text,
  p_transaction_id text,
  p_amount_minor bigint,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_row public.purchases%rowtype;
  inserted_event_count integer;
begin
  select * into purchase_row
  from public.purchases
  where reference_id = p_reference_id
    and paymob_order_id = p_paymob_order_id
  for update;

  if not found then
    raise exception 'Paymob purchase not found';
  end if;

  if purchase_row.amount_minor <> p_amount_minor or purchase_row.currency <> p_currency then
    raise exception 'Paymob amount or currency mismatch';
  end if;

  if purchase_row.status = 'paid' then
    if purchase_row.transaction_id = p_transaction_id then
      return jsonb_build_object('duplicate', true, 'reference_id', p_reference_id);
    end if;
    raise exception 'Purchase is already paid by a different transaction';
  end if;

  if purchase_row.status <> 'pending' then
    raise exception 'Purchase is not pending';
  end if;

  insert into public.paymob_webhook_events(transaction_id, reference_id, event_type)
  values (p_transaction_id, p_reference_id, 'transaction.success')
  on conflict (transaction_id) do nothing;
  get diagnostics inserted_event_count = row_count;
  if inserted_event_count = 0 then
    return jsonb_build_object('duplicate', true, 'reference_id', p_reference_id);
  end if;

  update public.purchases
  set status = 'paid',
      transaction_id = p_transaction_id,
      paid_at = now(),
      email_error = null,
      updated_at = now()
  where id = purchase_row.id;

  update public.orders
  set status = 'confirmed', confirmed_at = now()
  where reference_id = p_reference_id and status = 'pending_verification';
  if not found then
    raise exception 'Order is not awaiting payment confirmation';
  end if;

  insert into public.payment_fulfillment_outbox(reference_id)
  values (p_reference_id)
  on conflict (reference_id) do nothing;

  return jsonb_build_object('duplicate', false, 'reference_id', p_reference_id);
end;
$$;

create or replace function public.claim_payment_fulfillment(p_reference_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_fulfillment_outbox
  set status = 'processing', processing_at = now(), attempts = attempts + 1, last_error = null
  where reference_id = p_reference_id
    and (status = 'pending' or (status = 'processing' and processing_at < now() - interval '5 minutes'));
  return found;
end;
$$;

create or replace function public.apply_paymob_failure(
  p_reference_id text,
  p_paymob_order_id text,
  p_transaction_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_id_value uuid;
begin
  select id into purchase_id_value
  from public.purchases
  where reference_id = p_reference_id
    and paymob_order_id = p_paymob_order_id
    and status = 'pending'
  for update;

  if not found then
    return false;
  end if;

  insert into public.paymob_webhook_events(transaction_id, reference_id, event_type)
  values (p_transaction_id, p_reference_id, 'transaction.failed')
  on conflict (transaction_id) do nothing;

  update public.purchases
  set status = 'failed', transaction_id = p_transaction_id, updated_at = now()
  where id = purchase_id_value and status = 'pending';

  return found;
end;
$$;

revoke all on function public.apply_paymob_success(text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.apply_paymob_success(text, text, text, bigint, text) to service_role;
revoke all on function public.apply_paymob_failure(text, text, text) from public, anon, authenticated;
grant execute on function public.apply_paymob_failure(text, text, text) to service_role;
revoke all on function public.claim_payment_fulfillment(text) from public, anon, authenticated;
grant execute on function public.claim_payment_fulfillment(text) to service_role;
