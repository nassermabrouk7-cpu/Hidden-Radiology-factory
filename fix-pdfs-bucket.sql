-- Fix pdfs bucket to private for security
-- PDFs must be delivered through signed URLs, not public access

-- Update bucket to private
update storage.buckets
set public = false
where id = 'pdfs';

-- Verify the change
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'pdfs' and public = false) then
    raise exception 'Failed to set pdfs bucket to private';
  end if;
  raise notice 'pdfs bucket successfully set to private';
end $$;
