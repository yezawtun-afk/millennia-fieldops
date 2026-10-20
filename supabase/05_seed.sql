-- ============================================================================
-- Millennia FieldOps - 05_seed.sql
-- The 5 monitoring zones for Millennia Village. Run this LAST.
-- Safe to run more than once (upsert on the zone name), and re-running it
-- moves the five village zones to the coordinates below.
-- ============================================================================

-- Site centre: 2.752615639977973, 101.90646329852517 (Millennia Village).
-- The zones sit within about 1 km of it, so the map frames the whole village.
insert into public.zones (name, description, color, center_lat, center_lng, radius_m)
values
  ('Granite Ridge Trail',
   'Regrowth corridor along the ridge - flora and biodiversity plots.',
   '#16A34A', 2.754786, 101.908442, 180),
  ('Access Road & Drainage',
   'Haul road, culverts and drainage lines - hazard watch.',
   '#F59E0B', 2.752435, 101.910241, 140),
  ('Southern Slope Regrowth',
   'Revegetated south-facing slope - soil monitoring and invasive species control.',
   '#7C5CE0', 2.750083, 101.907543, 160),
  ('Quarry North Face',
   'Active quarry bench and rock face - erosion and debris monitoring.',
   '#DC2626', 2.754967, 101.903585, 150),
  ('Lakeview Wetland',
   'Settling pond and wetland buffer - water quality readings.',
   '#0284C7', 2.751169, 101.904844, 120)
on conflict (name) do update set
  description = excluded.description,
  color       = excluded.color,
  center_lat  = excluded.center_lat,
  center_lng  = excluded.center_lng,
  radius_m    = excluded.radius_m;

-- ---------------------------------------------------------------------------
-- Optional demo data.
-- Uncomment and run AFTER you have created at least one admin account
-- (see docs/SETUP.md step 2) to see the dashboard and map populated.
-- For a full randomised set instead, run 07_demo_data.sql afterwards.
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
--        2.750083, 101.907543, 'Patch spreading along the drainage line.',
--        'Dicranopteris linearis', 'Sapling', 'Healthy', 12,
--        null, null, null, null, null, admin.id
-- from admin, z where z.name = 'Southern Slope Regrowth';

-- ---------------------------------------------------------------------------
-- Handy: promote a signed-up user to admin.
-- Replace the email, then run just this line on its own.
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'you@example.com';
