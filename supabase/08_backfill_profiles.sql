-- ============================================================================
-- Millennia FieldOps - 08_backfill_profiles.sql
-- Repair script: create missing profiles for accounts that already exist.
--
-- WHEN YOU NEED THIS
-- ------------------
-- 04_triggers.sql makes a profiles row automatically when someone signs up.
-- If accounts were created BEFORE that trigger existed (for example the schema
-- was only added to a Supabase project that already had test users, as
-- happened here), those users have no profile row. The apps then log in but
-- every page fails because there is no profile to read the role from.
--
-- The subscription tab also shows the affected case: Supabase -> Authentication
-- -> Users lists users, but Profiles table has zero rows.
--
-- Safe to run repeatedly (on conflict do nothing).
--
-- If zones is also empty, run 05_seed.sql first.
-- ============================================================================

insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.email,
  'field_worker'
from auth.users as u
on conflict (id) do nothing;

-- Every newcomer starts as field_worker, which is right for records that field
-- workers submit. Promote the accounts that should review them instead:

-- update public.profiles set role = 'admin'      where email = 'admin@millennia.my';
-- update public.profiles set role = 'supervisor' where email = 'supervisor@millennia.my';

-- Check what you now have:
--
--   select email, role from public.profiles order by email;
