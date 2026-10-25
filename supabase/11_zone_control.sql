-- ============================================================================
-- Millennia FieldOps - 11_zone_control.sql
--
-- SUPERSEDED - DO NOT RUN ON A NEW DATABASE. Both rules below now live in the
-- main files, so this script only repeats them:
--   1. Supervisors can add and delete zones, not only administrators.
--      -> already in 02_policies.sql (zones_insert_admin / zones_update_admin /
--         zones_delete_admin all use public.is_reviewer(), which is true for
--         supervisors as well as administrators).
--   2. A zone can be deleted even when field records point at it, and the
--      records are kept with no zone.
--      -> already in 01_schema.sql:100,
--         `zone_id uuid references public.zones (id) on delete set null`.
--
-- This is why tools/bundle-db-sql.ps1 does not include it in setup_all.sql.
-- It is kept only so projects set up before the change have a record of what
-- was applied. Safe to run again if you do run it: every statement is idempotent.
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
