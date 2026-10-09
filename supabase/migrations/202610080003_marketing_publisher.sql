alter table public.marketing_content
  add column if not exists published_at timestamptz,
  add column if not exists external_post_id text,
  add column if not exists error_message text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists platform_response jsonb;

create index if not exists marketing_content_publish_queue_idx
  on public.marketing_content (status, scheduled_at, platform);

create index if not exists marketing_content_external_post_idx
  on public.marketing_content (platform, external_post_id);

comment on column public.marketing_content.published_at
  is 'Actual time the content was successfully published to the external platform';

comment on column public.marketing_content.external_post_id
  is 'External post/media identifier returned by the platform API';

comment on column public.marketing_content.error_message
  is 'Last publishing error returned by the publisher';

comment on column public.marketing_content.publish_attempts
  is 'Number of publishing attempts';

comment on column public.marketing_content.last_attempt_at
  is 'Timestamp of the most recent publishing attempt';

comment on column public.marketing_content.platform_response
  is 'Sanitized platform API response metadata; never store access tokens or secrets';
