-- Serialize manual one-product/one-channel publishing attempts. The lock is
-- released only after the provider result is persisted; a persistence failure
-- intentionally leaves the attempt fail-closed for manual reconciliation.
create unique index if not exists marketing_campaigns_single_channel_inflight_idx
  on public.marketing_campaigns (product_id, (metadata ->> 'selected_channel'))
  where metadata ->> 'single_channel_publish' = 'true'
    and metadata ->> 'attempt_in_progress' = 'true';
