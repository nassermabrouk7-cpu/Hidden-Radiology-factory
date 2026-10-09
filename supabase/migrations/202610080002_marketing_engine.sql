create extension if not exists pgcrypto;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  name text not null,
  objective text not null,
  audience text not null,
  positioning text not null,
  theme text not null,
  language_strategy text not null default 'ar+en',
  status text not null default 'ready'
    check (status in ('ready', 'active', 'paused', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  product_id text not null,
  platform text not null
    check (platform in ('instagram', 'facebook', 'linkedin')),
  language text not null
    check (language in ('ar', 'en')),
  content_type text not null
    check (content_type in ('authority', 'education', 'case', 'product', 'trust', 'conversion')),
  title text not null,
  hook text not null,
  body text not null,
  cta text not null,
  hashtags text[] not null default '{}',
  destination_url text,
  scheduled_at timestamptz,
  status text not null default 'queued'
    check (status in ('queued', 'approved', 'scheduled', 'published', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_product_created_idx
  on public.marketing_campaigns (product_id, created_at desc);

create index if not exists marketing_content_schedule_idx
  on public.marketing_content (status, scheduled_at);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_content enable row level security;

drop policy if exists "marketing_campaigns_no_client_access" on public.marketing_campaigns;
create policy "marketing_campaigns_no_client_access"
  on public.marketing_campaigns
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "marketing_content_no_client_access" on public.marketing_content;
create policy "marketing_content_no_client_access"
  on public.marketing_content
  for all
  to anon, authenticated
  using (false)
  with check (false);
