-- ============================================================================
-- Millennia FieldOps - 07_demo_data.sql
-- Fills the database with randomised demo records so the dashboard, the map
-- and the mobile "My records / Notifications" screens have something to show.
--
-- >>> WARNING: this DELETES every existing record first, so you get a clean,
-- >>> freshly randomised set each time you run it. Do not run it on data you
-- >>> care about.
--
-- Before running it you need (in this order):
--   1. 01..05 already run (tables + the 5 zones exist), plus 06 if your
--      database was created before the three-level severity change.
--   2. At least one account signed up, so there is a field worker to own the
--      records. Ideally one supervisor or admin too, so records can be shown
--      as reviewed. If no worker exists, nothing is inserted (no error).
--
-- Photos are deliberately left empty: real photo files must live in the
-- storage bucket, so seeding fake paths would only show broken images.
-- ============================================================================

delete from public.notifications;
delete from public.records;

-- ---------------------------------------------------------------------------
-- Random mix of records: ~70 rows spread over the last ~75 days, across all
-- zones, all three types and all three statuses, with type-appropriate detail.
-- ---------------------------------------------------------------------------
with zone_list as (
  select
    id,
    name,
    center_lat,
    center_lng,
    row_number() over (order by name) as zn,
    count(*) over () as zc
  from public.zones
),
people as (
  select
    (select id from public.profiles where role = 'field_worker' order by created_at limit 1) as worker_id,
    (select id from public.profiles
      where role in ('supervisor', 'admin') order by created_at limit 1) as reviewer_id
),
-- One row per record, with every random choice rolled once.
picks as (
  select
    g.n,
    floor(random() * 3)::int  + 1 as type_i,
    floor(random() * 100)::int     as status_pct,
    floor(random() * 3)::int  + 1 as severity_i,
    floor(random() * 6)::int  + 1 as species_i,
    floor(random() * 3)::int  + 1 as stage_i,
    floor(random() * 5)::int  + 1 as health_i,
    floor(random() * 5)::int  + 1 as hazard_i,
    floor(random() * 6)::int  + 1 as reading_i,
    floor(random() * 6)::int  + 1 as note_i,
    4 + floor(random() * 40)::int as counted,
    random() as day_frac,
    random() as lat_jitter,
    random() as lng_jitter,
    random() as value_frac,
    random() as feedback_frac
  from generate_series(1, 70) as g(n)
),
typed as (
  select
    p.*,
    (array['flora', 'soil_water', 'hazard']::public.record_type[])[p.type_i] as rtype,
    (case
       when p.status_pct < 45 then 'pending'
       when p.status_pct < 80 then 'approved'
       else 'rejected'
     end)::public.record_status as rstatus,
    (array['low', 'medium', 'critical']::public.hazard_severity[])[p.severity_i] as severity,
    (array['Dicranopteris linearis', 'Melastoma malabathricum', 'Nephrolepis biserrata',
            'Imperata cylindrica', 'Macaranga tanarius', 'Ficus fistulosa'])[p.species_i] as species,
    (array['Seedling', 'Sapling', 'Mature'])[p.stage_i] as stage,
    (array['Healthy', 'Stressed', 'Diseased', 'Dying', 'Dead'])[p.health_i] as health,
    (array['Fallen debris', 'Eroded ground', 'Blocked drainage', 'Silt runoff',
            'Rockfall risk'])[p.hazard_i] as hazard,
    (array['pH', 'Moisture', 'Water level', 'Turbidity', 'Temperature', 'Soil depth'])[p.reading_i] as reading,
    (array['Rain over the last few days - re-check next week.',
            'Access track muddy but passable.',
            'Follow-up needed with the site team.',
            'Seen while walking the regular transect.',
            'Nothing unusual beyond what is noted.',
            'Cut vegetation was piled nearby.'])[p.note_i] as note
  from picks p
),
demo as (
  select
    t.*,
    now() - (t.day_frac * interval '75 days') as observed_at
  from typed t
)
insert into public.records (
  type, title, zone_id, observed_date, latitude, longitude, photos, notes, status,
  supervisor_feedback, species_name, growth_stage, health_condition, estimated_count,
  hazard_type, severity, reading_type, reading_value, reading_unit,
  submitted_by, reviewed_by, reviewed_at, created_at
)
select
  d.rtype,
  case
    when d.rtype = 'flora'  then 'Flora survey - ' || z.name
    when d.rtype = 'hazard' then 'Hazard check - ' || d.hazard
    else                         'Water quality reading - ' || z.name
  end,
  z.id,
  d.observed_at,
  z.center_lat + (d.lat_jitter - 0.5) * 0.0014,
  z.center_lng + (d.lng_jitter - 0.5) * 0.0014,
  '[]'::jsonb,
  d.note,
  d.rstatus,
  case
    when d.rstatus = 'pending' then null
    when d.rstatus = 'approved' then
      case when d.feedback_frac < 0.6
        then 'Checked on site - looks right. Keep an eye on it.'
        else 'Approved. Thank you for the clear notes.'
      end
    else 'Could not verify this one - please re-capture with more detail.'
  end,
  case when d.rtype = 'flora' then d.species        else null end,
  case when d.rtype = 'flora' then d.stage          else null end,
  case when d.rtype = 'flora' then d.health         else null end,
  case when d.rtype = 'flora' then d.counted        else null end,
  case when d.rtype = 'hazard' then d.hazard        else null end,
  case when d.rtype = 'hazard' then d.severity      else null end,
  case when d.rtype = 'soil_water' then d.reading   else null end,
  case
    when d.rtype <> 'soil_water' then null
    when d.reading = 'pH'           then round((5.2 + d.value_frac * 2.2)::numeric, 2)
    when d.reading = 'Moisture'     then round((18 + d.value_frac * 55)::numeric, 1)
    when d.reading = 'Water level'  then round((0.10 + d.value_frac * 1.4)::numeric, 2)
    when d.reading = 'Turbidity'    then round((4 + d.value_frac * 60)::numeric, 1)
    when d.reading = 'Temperature'  then round((25 + d.value_frac * 7)::numeric, 1)
    else                                 round((0.2 + d.value_frac * 2.5)::numeric, 2)
  end,
  case
    when d.rtype <> 'soil_water' then null
    when d.reading = 'pH'          then 'pH'
    when d.reading = 'Moisture'    then '%'
    when d.reading = 'Water level' then 'm'
    when d.reading = 'Turbidity'   then 'NTU'
    when d.reading = 'Temperature' then 'C'
    else                                'm'
  end,
  p.worker_id,
  case when d.rstatus = 'pending' then null else p.reviewer_id end,
  case when d.rstatus = 'pending' then null else d.observed_at + interval '8 hours' end,
  d.observed_at
from demo d
join zone_list z on z.zn = ((d.n - 1) % z.zc) + 1
cross join people p
where p.worker_id is not null;

-- ---------------------------------------------------------------------------
-- A matching notification for every record that was approved or rejected, so
-- the mobile Notifications tab and its unread badge are not empty.
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, record_id, message, kind, read_at, created_at)
select
  r.submitted_by,
  r.id,
  'Your record "' || r.title || '" was ' || r.status::text || '.',
  'review',
  case when random() < 0.5 then now() else null end,
  coalesce(r.reviewed_at, r.observed_date) + interval '1 minute'
from public.records r
where r.status <> 'pending';

-- ---------------------------------------------------------------------------
-- Quick check after running it:
--
--   select type, status, count(*) from public.records group by type, status
--   order by type, status;
--
--   select severity, count(*) from public.records where type = 'hazard'
--   group by severity order by severity;
-- ---------------------------------------------------------------------------
