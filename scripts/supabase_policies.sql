-- Supabase setup script for Family Task Manager
-- Safe to run multiple times; uses IF EXISTS where possible and unique policy names.

-- 1) Safe trigger function to sync auth.users -> public.users without forcing family_id
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, phone, role, family_id, verified)
  values (
    new.id,
    new.email,
    nullif(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'role', 'child'),
    null,
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    email    = excluded.email,
    phone    = excluded.phone,
    role     = coalesce(excluded.role, public.users.role),
    verified = excluded.verified;

  return new;
end;
$$;

-- Ensure function owner is postgres to bypass RLS properly under SECURITY DEFINER
alter function public.handle_new_user() owner to postgres;

-- 2) public.users constraints adjustments
-- Email uniqueness is already enforced by auth.users; avoid duplicate conflicts here
alter table if exists public.users drop constraint if exists users_email_key;
-- Phone uniqueness may be optional; uncomment next line if phone must not be unique
-- alter table if exists public.users drop constraint if exists users_phone_key;

-- family_id must allow NULL (it is set later after login)
alter table if exists public.users alter column family_id drop not null;

-- 3) RLS policies
-- families
alter table if exists public.families enable row level security;

-- Drop legacy/duplicate policies if they exist (best-effort by common names)
drop policy if exists "Allow all to read families" on public.families;
drop policy if exists "Select families (all authenticated)" on public.families;
drop policy if exists "Family members can read family info" on public.families;
drop policy if exists "Insert families (all authenticated)" on public.families;
drop policy if exists "Parents can create families" on public.families;
drop policy if exists "Allow family members to update family" on public.families;
drop policy if exists "Parents can update family info" on public.families;

-- Create minimal safe policies (idempotent create; names are unique)
create policy if not exists "families select authenticated"
  on public.families
  for select
  to authenticated
  using (true);

create policy if not exists "families insert authenticated"
  on public.families
  for insert
  to authenticated
  with check (true);

create policy if not exists "families update only members"
  on public.families
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.family_id = public.families.family_id
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.family_id = public.families.family_id
    )
  );

-- users
alter table if exists public.users enable row level security;

-- Drop potential conflicting policies by common names (best-effort)
drop policy if exists "Users can read own profile" on public.users;
drop policy if exists "Users can read family members" on public.users;
drop policy if exists "Users can insert self" on public.users;
drop policy if exists "Users can update self" on public.users;

-- Select: user can see self and members of the same family
create policy if not exists "users select self and family"
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid() or (
      exists (
        select 1 from public.users me
        where me.id = auth.uid() and me.family_id is not null and me.family_id = public.users.family_id
      )
    )
  );

-- Insert: user can insert a row only for self (id=auth.uid())
create policy if not exists "users insert self"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

-- Update: user can update only own row
create policy if not exists "users update self"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4) Ensure triggers on auth.users call this function (best-effort)
-- Note: needs owner privileges; adjust if names differ in your project
-- CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL) EXECUTE FUNCTION public.handle_new_user();
