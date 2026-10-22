-- ============================================================================
-- Millennia FieldOps - 10_audit_logs.sql
-- An append-only activity log: who did what, and when.
--
-- Run this AFTER 01_schema.sql, 02_policies.sql and 04_triggers.sql.
-- Safe to run more than once.
--
-- What is recorded:
--   * a record submitted, edited, approved, rejected or deleted;
--   * an account's role, active flag or approval decision changed;
--   * account created / deleted (written by the web dashboard, which uses the
--     service role and therefore has no signed-in user inside the database).
--
-- Deliberately NOT recorded: changes made from the SQL editor or by maintenance
-- scripts (auth.uid() is null there) - those are trusted operator actions, and
-- logging them would bury the real activity under demo-data seeding.
-- ============================================================================

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text not null,
  action      text not null,      -- record.approved, account.declined, ...
  entity      text not null,      -- record | account
  entity_id   uuid,
  summary     text not null,      -- human sentence for the activity page
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx      on public.audit_logs (actor_id);
create index if not exists audit_logs_action_idx     on public.audit_logs (action);

-- ---------------------------------------------------------------------------
-- One writer used by every trigger below.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_actor_id  uuid,
  p_action    text,
  p_entity    text,
  p_entity_id uuid,
  p_summary   text,
  p_details   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = p_actor_id;

  insert into public.audit_logs (actor_id, actor_name, action, entity, entity_id, summary, details)
  values (
    p_actor_id,
    coalesce(v_name, 'System'),
    p_action,
    p_entity,
    p_entity_id,
    p_summary,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- records: submitted / reviewed / edited / deleted
-- ---------------------------------------------------------------------------
create or replace function public.audit_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
  v_action text;
  v_summary text;
begin
  -- Seed data and SQL-editor maintenance have no signed-in user.
  if v_actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select full_name into v_name from public.profiles where id = v_actor;
  v_name := coalesce(v_name, 'Someone');

  if tg_op = 'INSERT' then
    perform public.write_audit(
      v_actor, 'record.created', 'record', new.id,
      v_name || ' submitted "' || new.title || '"',
      jsonb_build_object('type', new.type, 'status', new.status, 'zone_id', new.zone_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      v_action := 'record.' || new.status::text;
      v_summary := v_name || ' marked "' || new.title || '" as ' || new.status::text;
      perform public.write_audit(
        v_actor, v_action, 'record', new.id, v_summary,
        jsonb_build_object(
          'from', old.status,
          'to', new.status,
          'feedback', new.supervisor_feedback
        )
      );
    elsif new is distinct from old then
      perform public.write_audit(
        v_actor, 'record.updated', 'record', new.id,
        v_name || ' edited "' || new.title || '"',
        jsonb_build_object('status', new.status)
      );
    end if;
    return new;
  end if;

  perform public.write_audit(
    v_actor, 'record.deleted', 'record', old.id,
    v_name || ' deleted "' || old.title || '"',
    jsonb_build_object('type', old.type, 'status', old.status)
  );
  return old;
end;
$$;

drop trigger if exists audit_records_trigger on public.records;
create trigger audit_records_trigger
  after insert or update or delete on public.records
  for each row execute function public.audit_records();

-- ---------------------------------------------------------------------------
-- profiles: role, active flag and approval decisions
-- ---------------------------------------------------------------------------
create or replace function public.audit_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
begin
  if v_actor is null then
    return new;
  end if;

  select full_name into v_name from public.profiles where id = v_actor;
  v_name := coalesce(v_name, 'Someone');

  if new.role is distinct from old.role then
    perform public.write_audit(
      v_actor, 'account.role', 'account', new.id,
      v_name || ' changed ' || new.full_name || '''s role to ' || new.role::text,
      jsonb_build_object('from', old.role, 'to', new.role)
    );
  end if;

  if new.is_active is distinct from old.is_active then
    perform public.write_audit(
      v_actor,
      case when new.is_active then 'account.activated' else 'account.deactivated' end,
      'account', new.id,
      v_name || case when new.is_active then ' reactivated ' else ' deactivated ' end
        || new.full_name,
      jsonb_build_object('is_active', new.is_active)
    );
  end if;

  if new.status is distinct from old.status then
    perform public.write_audit(
      v_actor, 'account.' || new.status::text, 'account', new.id,
      v_name || ' set ' || new.full_name || '''s request to ' || new.status::text,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_profiles_trigger on public.profiles;
create trigger audit_profiles_trigger
  after update on public.profiles
  for each row execute function public.audit_profiles();

-- ---------------------------------------------------------------------------
-- Read access: administrators only. There is no insert/update/delete policy,
-- so only triggers and the service role can write - the log cannot be edited
-- from the dashboard.
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());
