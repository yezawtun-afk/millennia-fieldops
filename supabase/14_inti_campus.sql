-- ============================================================================
-- Millennia FieldOps - 14_inti_campus.sql
-- A second demo site: three monitoring zones and ten records around the INTI
-- International University campus in Nilai, Seremban - about 18 km south-west
-- of Millennia Village. This ADDS to the village data and never touches it.
--
-- Safe to run more than once: the zones upsert on their name, and the records
-- are cleared and re-created each run, so a second run refreshes this site
-- instead of filling the table with duplicates.
--
-- Before running it you need at least one approved field-worker account,
-- because every record must belong to somebody. Reviewed rows also want a
-- supervisor or admin, otherwise their reviewer fields stay empty. Without a
-- worker nothing is inserted and a notice says so.
--
-- Coordinates sit inside the campus outline (2.8077-2.8170 N,
-- 101.7568-101.7597 E) as mapped by OpenStreetMap.
--
-- Expect "Success. No rows returned": an insert reports no rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The three zones. Zone names are unique, so a re-run moves the circles
--    back to these positions rather than creating copies.
-- ---------------------------------------------------------------------------
insert into public.zones (name, description, color, center_lat, center_lng, radius_m)
values
  ('INTI Campus Green',
   'Campus grounds and planting plots - flora survey and soil moisture.',
   '#16A34A', 2.81149, 101.75877, 260),
  ('INTI Drainage Line',
   'Roadside drains and the culvert below the carpark - runoff watch.',
   '#F59E0B', 2.80900, 101.75920, 130),
  ('INTI Perimeter Buffer',
   'Boundary slope and walking path - erosion and debris monitoring.',
   '#DC2626', 2.81480, 101.75730, 150)
on conflict (name) do update set
  description = excluded.description,
  color       = excluded.color,
  center_lat  = excluded.center_lat,
  center_lng  = excluded.center_lng,
  radius_m    = excluded.radius_m;

-- ---------------------------------------------------------------------------
-- 2. The ten records: four flora, three soil/water and three hazards, five
--    approved, three waiting for review and two rejected with feedback.
--    Dates run from yesterday back three weeks. Photos stay empty on purpose -
--    a made-up file path would only show a broken image in the gallery.
-- ---------------------------------------------------------------------------
do $$
declare
  worker_id   uuid;
  reviewer_id uuid;
  zone_green  uuid;
  zone_drain  uuid;
  zone_buffer uuid;
begin
  select id into worker_id
  from public.profiles
  where role = 'field_worker' and is_active and status = 'approved'
  order by created_at
  limit 1;

  if worker_id is null then
    raise notice 'No approved field worker found - INTI records were not inserted. Sign up in the app, then run this file again.';
    return;
  end if;

  select id into reviewer_id
  from public.profiles
  where role in ('supervisor', 'admin') and is_active and status = 'approved'
  order by created_at
  limit 1;

  select id into zone_green  from public.zones where name = 'INTI Campus Green';
  select id into zone_drain  from public.zones where name = 'INTI Drainage Line';
  select id into zone_buffer from public.zones where name = 'INTI Perimeter Buffer';

  -- Only this site's records, so the village demo set keeps every row.
  delete from public.records
  where zone_id in (zone_green, zone_drain, zone_buffer);

  insert into public.records (
    type, title, zone_id, observed_date, latitude, longitude, photos, notes,
    status, supervisor_feedback,
    species_name, growth_stage, health_condition, estimated_count,
    hazard_type, severity,
    reading_type, reading_value, reading_unit,
    submitted_by, reviewed_by, reviewed_at
  )
  values
  -- Campus Green -------------------------------------------------------------
  ('flora', 'Resprouting ferns along the campus path', zone_green,
   now() - interval '4 days', 2.81210, 101.75920, '[]'::jsonb,
   'Regrowth coming back over the cut line and spreading uphill.',
   'approved', null,
   'Dicranopteris linearis', 'Sapling', 'Healthy', 18,
   null, null, null, null, null,
   worker_id, reviewer_id, now() - interval '3 days'),

  ('flora', 'Melastoma spreading behind Block C', zone_green,
   now() - interval '9 days', 2.81070, 101.75830, '[]'::jsonb,
   'Dense patch under the shade trees, several plants in flower.',
   'approved', null,
   'Melastoma malabathricum', 'Mature', 'Stressed', 26,
   null, null, null, null, null,
   worker_id, reviewer_id, now() - interval '8 days'),

  ('flora', 'Seedlings on the east lawn', zone_green,
   now() - interval '1 day', 2.81170, 101.75790, '[]'::jsonb,
   'New seedlings along the mown edge after the weekend rain.',
   'pending', null,
   'Macaranga tanarius', 'Seedling', 'Healthy', 40,
   null, null, null, null, null,
   worker_id, null, null),

  ('soil_water', 'Soil moisture after morning rain', zone_green,
   now() - interval '2 days', 2.81090, 101.75940, '[]'::jsonb,
   'Sample taken 10 cm below the surface on shaded ground by the walkway.',
   'pending', null,
   null, null, null, null,
   null, null,
   'Moisture', 58, '%',
   worker_id, null, null),

  -- Drainage Line ------------------------------------------------------------
  ('soil_water', 'Drain pH below the carpark', zone_drain,
   now() - interval '6 days', 2.80940, 101.75950, '[]'::jsonb,
   'Reading taken at the outflow below the carpark apron.',
   'approved', null,
   null, null, null, null,
   null, null,
   'pH', 6.4, 'pH',
   worker_id, reviewer_id, now() - interval '5 days'),

  ('soil_water', 'Turbid runoff after the storm', zone_drain,
   now() - interval '12 days', 2.80870, 101.75890, '[]'::jsonb,
   'Grey water with visible silt at the outlet.',
   'rejected', 'The drain had just been flushed upstream - please re-sample after a dry day.',
   null, null, null, null,
   null, null,
   'Turbidity', 84, 'NTU',
   worker_id, reviewer_id, now() - interval '11 days'),

  ('hazard', 'Blocked drainage at the culvert', zone_drain,
   now() - interval '3 days', 2.80890, 101.75960, '[]'::jsonb,
   'Litter and silt blocking the culvert mouth; water pooling on the road shoulder.',
   'pending', null,
   null, null, null, null,
   'Blocked drainage', 'medium',
   null, null, null,
   worker_id, null, null),

  -- Perimeter Buffer ---------------------------------------------------------
  ('hazard', 'Eroded ground above the fence line', zone_buffer,
   now() - interval '15 days', 2.81520, 101.75760, '[]'::jsonb,
   'Rill erosion about a metre long on the slope above the boundary fence.',
   'approved', null,
   null, null, null, null,
   'Eroded ground', 'medium',
   null, null, null,
   worker_id, reviewer_id, now() - interval '14 days'),

  ('hazard', 'Fallen debris on the boundary path', zone_buffer,
   now() - interval '8 days', 2.81450, 101.75700, '[]'::jsonb,
   'Dry branches across the walking path; passable on foot only.',
   'approved', null,
   null, null, null, null,
   'Fallen debris', 'low',
   null, null, null,
   worker_id, reviewer_id, now() - interval '7 days'),

  ('flora', 'Grass encroaching on the boundary markers', zone_buffer,
   now() - interval '11 days', 2.81470, 101.75770, '[]'::jsonb,
   'Marker posts half covered by grass and hard to find on the walk.',
   'rejected', 'The markers sit on the campus edge, not inside this buffer - please re-pin at the actual post.',
   'Imperata cylindrica', 'Mature', 'Stressed', 30,
   null, null, null, null, null,
   worker_id, reviewer_id, now() - interval '10 days');

  raise notice 'INTI campus site ready: 3 zones and 10 records.';
end $$;
