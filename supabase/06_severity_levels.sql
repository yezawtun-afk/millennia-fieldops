-- ============================================================================
-- Millennia FieldOps - 06_severity_levels.sql
-- The proposal uses three hazard severity levels: Low / Medium / Critical.
-- Older databases were created with a fourth level ('high'), so this file
-- rebuilds the enum without it.
--
-- Run this ONCE on an existing database (after 05_seed.sql).
-- It is safe to run again: it does nothing if 'high' is already gone, and a
-- brand-new database created from the updated 01_schema.sql never needs it.
--
-- Any record still marked 'high' is moved to 'critical' first, so no data is
-- lost. (PostgreSQL cannot remove a value from an enum in place.)
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'hazard_severity'
      and e.enumlabel = 'high'
  ) then
    -- 1. Keep the meaning of any existing data.
    update public.records set severity = 'critical' where severity = 'high';

    -- 2. Replace the type with the three-level version.
    alter type public.hazard_severity rename to hazard_severity_old;

    create type public.hazard_severity as enum ('low', 'medium', 'critical');

    alter table public.records
      alter column severity type public.hazard_severity
      using severity::text::public.hazard_severity;

    drop type public.hazard_severity_old;

    raise notice 'hazard_severity changed to low / medium / critical';
  else
    raise notice 'hazard_severity already has three levels - nothing to do';
  end if;
end $$;
