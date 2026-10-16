-- ============================================================================
-- Millennia FieldOps - 01_schema.sql
-- Enums, tables and indexes. Run this FIRST in the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (created only if they do not exist yet)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('field_worker', 'supervisor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.record_type as enum ('flora', 'soil_water', 'hazard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.record_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.hazard_severity as enum ('low', 'medium', 'critical');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles - one row per account, linked 1:1 to Supabase Auth users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null,
  email       text        not null unique,
  role        public.user_role not null default 'field_worker',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- zones - monitoring areas, drawn as circles on the map
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  color       text not null default '#16A34A',
  center_lat  double precision not null,
  center_lng  double precision not null,
  radius_m    double precision not null default 150,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- records - every field observation (flora / soil_water / hazard)
-- ---------------------------------------------------------------------------
create table if not exists public.records (
  id                  uuid primary key default gen_random_uuid(),
  type                public.record_type   not null,
  title               text                 not null,
  zone_id             uuid references public.zones (id) on delete restrict,
  observed_date       timestamptz          not null default now(),
  latitude            double precision,
  longitude           double precision,
  photos              jsonb                not null default '[]'::jsonb,
  notes               text,
  status              public.record_status not null default 'pending',
  supervisor_feedback text,

  -- Flora fields
  species_name        text,
  growth_stage        text,
  health_condition    text,
  estimated_count     integer,

  -- Hazard fields
  hazard_type         text,
  severity            public.hazard_severity,

  -- Soil / water fields
  reading_type        text,
  reading_value       double precision,
  reading_unit        text,

  submitted_by        uuid not null references public.profiles (id) on delete restrict,
  reviewed_by         uuid references public.profiles (id) on delete set null,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists records_zone_id_idx       on public.records (zone_id);
create index if not exists records_status_idx        on public.records (status);
create index if not exists records_type_idx          on public.records (type);
create index if not exists records_observed_date_idx on public.records (observed_date);
create index if not exists records_submitted_by_idx  on public.records (submitted_by);
create index if not exists records_severity_idx      on public.records (severity);

-- ---------------------------------------------------------------------------
-- notifications - tells a worker their record was reviewed
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  record_id  uuid references public.records (id) on delete cascade,
  message    text not null,
  kind       text not null default 'review',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_unread_idx  on public.notifications (user_id) where read_at is null;
