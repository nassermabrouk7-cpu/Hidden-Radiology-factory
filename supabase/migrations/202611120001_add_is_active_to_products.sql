-- Add is_active column to products table if it doesn't exist
alter table public.products
add column if not exists is_active boolean default true;

-- Update existing products to be active
update public.products
set is_active = true
where is_active is null;
