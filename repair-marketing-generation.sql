BEGIN;

ALTER TABLE public.marketing_content
  DROP CONSTRAINT IF EXISTS marketing_content_platform_check;

ALTER TABLE public.marketing_content
  ADD CONSTRAINT marketing_content_platform_check
  CHECK (platform IN (
    'telegram',
    'instagram',
    'facebook',
    'linkedin',
    'threads'
  ));

CREATE TABLE IF NOT EXISTS public.marketing_generation_daily_runs (
  run_date date PRIMARY KEY,
  status text NOT NULL
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.marketing_generation_daily_runs
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_generation_daily_runs
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE
  ON TABLE public.marketing_generation_daily_runs
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_marketing_generation_daily_run(
  p_run_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed boolean;
BEGIN
  IF p_run_date IS DISTINCT FROM
     (now() AT TIME ZONE 'utc')::date THEN
    RETURN false;
  END IF;

  INSERT INTO public.marketing_generation_daily_runs AS existing_run
    (run_date, status)
  VALUES
    (p_run_date, 'running')

  ON CONFLICT (run_date) DO UPDATE
  SET
    status = 'running',
    started_at = now(),
    completed_at = NULL,
    result = '{}'::jsonb

  WHERE existing_run.status = 'failed'
     OR (
       existing_run.status = 'running'
       AND existing_run.started_at < now() - interval '30 minutes'
     )

  RETURNING true INTO claimed;

  RETURN coalesce(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION
  public.claim_marketing_generation_daily_run(date)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_marketing_generation_daily_run(date)
  TO service_role;

COMMIT;
