-- ============================================================================
-- Millennia FieldOps - 11_zone_control.sql
-- Two small database changes so zones can be managed from the site map:
--   1. Supervisors can add and delete zones, not only administrators.
--   2. A zone can be deleted even when field records point at it. The records
--      keep everything they hold (photos, readings, status) and simply end up
--      with no zone.
-- Run this once in the Supabase SQL Editor. Safe to run again.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Zone changes: supervisors as well as administrators.
--    is_reviewer() is true for an approved, active supervisor or admin.
-- ---------------------------------------------------------------------------
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
-- 2. Deleting a zone keeps its records instead of failing.
--    The foreign key was created as records_zone_id_fkey in 01_schema.sql.
-- ---------------------------------------------------------------------------
alter table public.records
  drop constraint if exists records_zone_id_fkey;

alter table public.records
  add constraint records_zone_id_fkey
  foreign key (zone_id) references public.zones (id) on delete set null;
