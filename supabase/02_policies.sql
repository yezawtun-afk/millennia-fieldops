-- ============================================================================
-- Millennia FieldOps - 02_policies.sql
-- Helper functions and Row Level Security. Run this SECOND.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- `security definer` lets them read profiles without triggering RLS again.
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active and status = 'approved';
$$;

create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('supervisor', 'admin') and is_active and status = 'approved'
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and is_active and status = 'approved'
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- A deactivated or not-yet-approved account keeps its history but loses every
-- read and write. Pending and declined requests can therefore sign in at most
-- to their own profile row (see profiles_select), never to site data.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_active and status = 'approved' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Turn Row Level Security on for every table
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.zones         enable row level security;
alter table public.records       enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   read:   any signed-in user (names show up on records and the users page)
--   update: your own row, or an admin editing anyone
--   insert/delete: handled by the Auth trigger / admins only
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_active_user());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- zones
--   read:   any signed-in user
--   write:  supervisors and administrators
-- ---------------------------------------------------------------------------
drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones
  for select to authenticated
  using (public.is_active_user());

drop policy if exists zones_insert_admin on public.zones;
create policy zones_insert_admin on public.zones
  for insert to authenticated
  with check (public.is_reviewer());

drop policy if exists zones_update_admin on public.zones;
create policy zones_update_admin on public.zones
  for update to authenticated
  using (public.is_reviewer())
  with check (public.is_reviewer());

drop policy if exists zones_delete_admin on public.zones;
create policy zones_delete_admin on public.zones
  for delete to authenticated
  using (public.is_reviewer());

-- ---------------------------------------------------------------------------
-- records
--   read:   any signed-in user sees the whole site
--   insert: only as yourself, and always starting as 'pending'
--   update: a reviewer may update anything; an owner may edit their own
--           record while it is still pending
--   delete: administrators only (policy records_delete_admin);
--           the submitter may also delete their own record while it is still
--           pending - that policy lives in 09_delete_own_pending.sql
-- ---------------------------------------------------------------------------
drop policy if exists records_select on public.records;
create policy records_select on public.records
  for select to authenticated
  using (public.is_active_user());

drop policy if exists records_insert_own on public.records;
create policy records_insert_own on public.records
  for insert to authenticated
  with check (public.is_active_user() and submitted_by = auth.uid() and status = 'pending');

drop policy if exists records_update_reviewer on public.records;
create policy records_update_reviewer on public.records
  for update to authenticated
  using (public.is_reviewer())
  with check (public.is_reviewer());

drop policy if exists records_update_owner_pending on public.records;
create policy records_update_owner_pending on public.records
  for update to authenticated
  using (public.is_active_user() and submitted_by = auth.uid() and status = 'pending')
  with check (submitted_by = auth.uid());

drop policy if exists records_delete_admin on public.records;
create policy records_delete_admin on public.records
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
--   read:   your own only
--   update: your own (to mark as read)
--   insert: done by the review trigger (security definer), so no user insert
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (public.is_active_user() and user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (public.is_active_user() and user_id = auth.uid())
  with check (user_id = auth.uid());
