-- ============================================================================
-- Millennia FieldOps - 05_seed.sql
-- The 5 monitoring zones for Millennia Village. Run this LAST.
-- Safe to run more than once (upsert on the zone name).
-- ============================================================================

insert into public.zones (name, description, color, center_lat, center_lng, radius_m)
values
  ('Granite Ridge Trail',
   'Regrowth corridor along the ridge - flora and biodiversity plots.',
   '#16A34A', 2.9111, 101.8402, 200),
  ('Access Road & Drainage',
   'Haul road, culverts and drainage lines - hazard watch.',
   '#F59E0B', 2.9141, 101.8447, 180),
  ('Southern Slope Regrowth',
   'Revegetated south-facing slope - soil monitoring and invasive species control.',
   '#7C5CE0', 2.9104, 101.8424, 150),
  ('Quarry North Face',
   'Active quarry bench and rock face - erosion and debris monitoring.',
   '#DC2626', 2.9152, 101.8421, 150),
  ('Lakeview Wetland',
   'Settling pond and wetland buffer - water quality readings.',
   '#0284C7', 2.9125, 101.8452, 120)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Optional demo data.
-- Uncomment and run AFTER you have created at least one admin account
-- (see docs/SETUP.md step 2) to see the dashboard and map populated.
-- ---------------------------------------------------------------------------
-- with admin as (
--   select id from public.profiles where role = 'admin' order by created_at limit 1
-- ), z as (
--   select id, name from public.zones
-- )
-- insert into public.records
--   (type, title, zone_id, observed_date, latitude, longitude, notes,
--    species_name, growth_stage, health_condition, estimated_count,
--    hazard_type, severity, reading_type, reading_value, reading_unit, submitted_by)
-- select 'flora', 'Resprouting ferns - Southern Slope', z.id, now() - interval '3 days',
--        2.9104, 101.8424, 'Patch spreading along the drainage line.',
--        'Dicranopteris linearis', 'Sapling', 'Healthy', 12,
--        null, null, null, null, null, admin.id
-- from admin, z where z.name = 'Southern Slope Regrowth';

-- ---------------------------------------------------------------------------
-- Handy: promote a signed-up user to admin.
-- Replace the email, then run just this line on its own.
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'you@example.com';
