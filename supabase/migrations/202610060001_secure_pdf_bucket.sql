-- PDF products must not be available through Supabase's unauthenticated public URLs.
-- The application now creates short-lived signed URLs after an administrator confirms payment.
update storage.buckets
set public = false
where id = 'pdfs';

-- Fail clearly if the expected bucket is absent instead of silently implying it is protected.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'pdfs' and public = false) then
    raise exception 'Supabase Storage bucket "pdfs" is missing; create it as a private bucket before enabling order delivery.';
  end if;
end $$;
