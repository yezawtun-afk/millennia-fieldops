-- ============================================================================
-- Millennia FieldOps - 12_job_completion.sql
-- Finish the job after a hazard report is approved.
--
-- Run this AFTER 01_schema.sql, 02_policies.sql, 04_triggers.sql and
-- 10_audit_logs.sql. On the live project, run this file on its own:
--   Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- What it adds:
--   * four completion fields on records (approval stays a separate decision);
--   * a complete_record() function: the submitter, and nobody else, can mark
--     their own approved hazard as done, with a note and up to 3 after photos;
--   * an audit entry ("completed the job") instead of a generic "edited";
--   * a clearer approval notification for hazards.
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Completion fields
--
-- A record can be approved (the supervisor checked the report) and completed
-- (the worker did the work) at the same time. Keeping these separate means the
-- review status, filters, exports and badges keep working exactly as before.
-- ---------------------------------------------------------------------------
alter table public.records
  add column if not exists completed_at      timestamptz,
  add column if not exists completed_by      uuid references public.profiles (id) on delete set null,
  add column if not exists completion_note   text,
  add column if not exists completion_photos jsonb not null default '[]'::jsonb;

-- The "To do" list asks for: my approved hazards that are not complete yet.
create index if not exists records_open_jobs_idx
  on public.records (submitted_by)
  where type = 'hazard' and status = 'approved' and completed_at is null;

-- ---------------------------------------------------------------------------
-- 2. Mark a job as done
--
-- A security-definer function, not a new RLS policy: the owner must not be
-- able to edit a reviewed record's content, and an RLS update policy cannot
-- restrict which columns are changed. The function accepts only the note and
-- the photo paths, checks every rule itself, and updates nothing else.
--
-- Photo paths must live in the caller's own storage folder, matching the
-- record_photos_insert policy in 03_storage.sql.
-- ---------------------------------------------------------------------------
create or replace function public.complete_record(
  p_record_id uuid,
  p_note      text  default null,
  p_photos    jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.records;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'You must be signed in with an active account.';
  end if;

  if jsonb_typeof(coalesce(p_photos, '[]'::jsonb)) <> 'array' then
    raise exception 'The photo list is not valid.';
  end if;

  if jsonb_array_length(coalesce(p_photos, '[]'::jsonb)) > 3 then
    raise exception 'At most 3 after photos are allowed.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_photos, '[]'::jsonb)) as photo(path)
    where photo.path is null or photo.path not like auth.uid()::text || '/%'
  ) then
    raise exception 'Photos must be uploaded to your own folder.';
  end if;

  -- Lock the row so two taps cannot both pass the "not complete yet" check.
  select * into v_record
  from public.records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Record not found.';
  end if;

  if v_record.submitted_by <> auth.uid() then
    raise exception 'Only the worker who submitted this report can finish the job.';
  end if;

  if v_record.type <> 'hazard' then
    raise exception 'Only hazard reports have a job to finish.';
  end if;

  if v_record.status <> 'approved' then
    raise exception 'The report must be approved before the job can be finished.';
  end if;

  if v_record.completed_at is not null then
    raise exception 'This job is already complete.';
  end if;

  update public.records
     set completed_at      = now(),
         completed_by      = auth.uid(),
         completion_note   = nullif(btrim(coalesce(p_note, '')), ''),
         completion_photos = coalesce(p_photos, '[]'::jsonb)
   where id = p_record_id;
end;
$$;

-- The app calls this as a signed-in user; anonymous callers have no business
-- here, so close the default PUBLIC grant.
revoke all on function public.complete_record(uuid, text, jsonb) from public;
grant execute on function public.complete_record(uuid, text, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Audit log: one clear "completed the job" entry
--
-- This replaces the function from 10_audit_logs.sql. Without the first branch,
-- a completion would be logged as a generic "edited" record because the review
-- status does not change. The rest of the function is unchanged.
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
    if new.completed_at is not null and old.completed_at is null then
      perform public.write_audit(
        v_actor, 'record.completed', 'record', new.id,
        v_name || ' completed the job "' || new.title || '"',
        jsonb_build_object(
          'note', new.completion_note,
          'photos', jsonb_array_length(coalesce(new.completion_photos, '[]'::jsonb))
        )
      );
    elsif new.status is distinct from old.status then
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

-- The trigger already points at this function, so no trigger change is needed.

-- ---------------------------------------------------------------------------
-- 4. Tell the worker the job exists
--
-- The existing review trigger still writes the notification. For an approved
-- hazard it now also says where to finish the job. Other statuses and record
-- types read exactly as before.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    insert into public.notifications (user_id, record_id, message, kind)
    values (
      new.submitted_by,
      new.id,
      'Your '
        || case when new.type = 'hazard' then 'hazard report' else 'record' end
        || ' "' || new.title || '" was ' || new.status::text || '.'
        || case
             when new.status = 'approved' and new.type = 'hazard'
               then ' The job is ready to finish in To do.'
             else ''
           end,
      'review'
    );
  end if;
  return new;
end;
$$;

-- The notify_record_review trigger already points at this function.

-- Ask PostgREST to pick up the new completion fields and their foreign key
-- immediately. Without this it picks them up on its next schema reload, which
-- is usually quick, but the app's joins would fail until then.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. Quick check after running
--
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'records'
--    and column_name in ('completed_at', 'completed_by', 'completion_note', 'completion_photos');
-- -- expect 4 rows
--
-- select proname from pg_proc
--  where pronamespace = 'public'::regnamespace and proname = 'complete_record';
-- -- expect 1 row
-- ---------------------------------------------------------------------------
