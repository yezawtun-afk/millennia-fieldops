-- ============================================================================
-- Millennia FieldOps - 13_remediation.sql
-- Turn an approved hazard into a work order: assign it, fix it, verify it.
--
-- Run this AFTER 01_schema.sql, 02_policies.sql, 10_audit_logs.sql and
-- 12_job_completion.sql. On the live project, run this file on its own:
--   Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- What it adds:
--   * assignment fields on records (worker, priority, due date);
--   * a close step: a supervisor verifies the after photos and closes the job;
--   * a send-back step: the fix is rejected, the attempt is archived, and the
--     worker can try again;
--   * assign_remediation(), verify_close() and reopen_remediation();
--   * complete_record() now accepts the assigned worker, not only the reporter;
--   * audit entries for assigned / verified / reopened;
--   * notifications for the assignee and for every closure decision.
--
-- The review status (pending / approved / rejected) is never changed here: a
-- hazard is approved once, then moved through the repair loop.
--
-- Safe to run more than once.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Work-order fields
--
-- Three moments are kept apart on purpose:
--   assigned_at  the work was handed to someone
--   completed_at the worker says it is fixed (12_job_completion.sql)
--   closed_at    a supervisor checked the fix and closed the ticket
--
-- Only closed_at removes the hazard from the health score, so "fixed" is a
-- claim and "closed" is a verified outcome.
-- ---------------------------------------------------------------------------

-- The one-time backfill at the end of this section must run exactly once. On a
-- re-run it would close jobs a worker has just fixed but a supervisor has not
-- verified yet, quietly skipping the review step. So ask whether the loop
-- columns exist *before* adding them, and remember the answer for this session.
do $$ begin
  perform set_config(
    'millennia.remediation_first_run',
    case
      when exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'records'
          and column_name = 'closed_at'
      ) then '0'
      else '1'
    end,
    false
  );
end $$;

alter table public.records
  add column if not exists assigned_to       uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_by       uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_at       timestamptz,
  add column if not exists priority          text,
  add column if not exists due_on            date,
  add column if not exists closed_at         timestamptz,
  add column if not exists closed_by         uuid references public.profiles (id) on delete set null,
  add column if not exists close_note        text,
  add column if not exists reopened_at       timestamptz,
  add column if not exists reopen_reason     text,
  -- Each send-back keeps the failed attempt here, so no photo is deleted from
  -- storage and the supervisor can always see what was rejected.
  add column if not exists previous_attempts jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.records
    add constraint records_priority_check check (priority in ('low', 'medium', 'high'));
exception when duplicate_object then null; end $$;

-- "My assigned work" and the supervisor's "awaiting verification" queue.
create index if not exists records_assigned_open_idx
  on public.records (assigned_to)
  where assigned_to is not null and closed_at is null;

create index if not exists records_awaiting_verification_idx
  on public.records (completed_at)
  where completed_at is not null and closed_at is null;

-- Jobs finished before this migration were treated as done for good, so they
-- become closed rather than dropping the live health score overnight. This is
-- the one-time step guarded above: re-running the file never closes a job that
-- is waiting for a supervisor.
do $$ begin
  if current_setting('millennia.remediation_first_run', true) = '1' then
    update public.records
       set closed_at = completed_at,
           closed_by = completed_by
     where completed_at is not null
       and closed_at is null;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Assign the work
--
-- The update policies let a reviewer edit any record, so the checks have to
-- live in one function: only a reviewer may assign, only an approved hazard can
-- be assigned, and only an active field worker can take it.
-- ---------------------------------------------------------------------------
create or replace function public.assign_remediation(
  p_record_id uuid,
  p_assignee  uuid,
  p_priority  text default null,
  p_due_on    date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record   public.records;
  v_role     public.user_role;
  v_active   boolean;
  v_status   public.account_status;
  v_worker   text;
begin
  if not public.is_reviewer() then
    raise exception 'Only a supervisor can assign remediation work.';
  end if;

  select * into v_record
  from public.records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Record not found.';
  end if;

  if v_record.type <> 'hazard' then
    raise exception 'Only hazard reports have remediation work.';
  end if;

  if v_record.status <> 'approved' then
    raise exception 'Approve the hazard before assigning the work.';
  end if;

  if v_record.closed_at is not null then
    raise exception 'This job is already closed.';
  end if;

  -- The work is already done and waiting for a decision. Handing it to someone
  -- else would leave a finished attempt attached to a job nobody worked on.
  if v_record.completed_at is not null then
    raise exception 'This fix is waiting for verification. Close it or send it back first.';
  end if;

  if p_priority is not null and p_priority not in ('low', 'medium', 'high') then
    raise exception 'Unknown priority.';
  end if;

  select role, is_active, status, full_name
    into v_role, v_active, v_status, v_worker
  from public.profiles
  where id = p_assignee;

  if v_role is null then
    raise exception 'Choose a field worker.';
  end if;

  if v_role <> 'field_worker' then
    raise exception 'Only a field worker can be assigned remediation work.';
  end if;

  if not v_active or v_status <> 'approved' then
    raise exception 'That account cannot take work right now.';
  end if;

  -- The priority follows the severity unless the supervisor overrides it: a
  -- blocked culvert is urgent because it is critical, not because it is old.
  update public.records
     set assigned_to = p_assignee,
         assigned_by = auth.uid(),
         assigned_at = now(),
         priority    = coalesce(
                         p_priority,
                         case v_record.severity
                           when 'critical' then 'high'
                           when 'medium'   then 'medium'
                           else 'low'
                         end
                       ),
         due_on      = p_due_on
   where id = p_record_id;

  if v_record.assigned_to is distinct from p_assignee then
    insert into public.notifications (user_id, record_id, message, kind)
    values (
      p_assignee,
      p_record_id,
      'You were assigned "' || v_record.title || '". Open To do to finish it.',
      'assignment'
    );
  end if;
end;
$$;

revoke all on function public.assign_remediation(uuid, uuid, text, date) from public;
grant execute on function public.assign_remediation(uuid, uuid, text, date)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 3. Finish the work (replaces the owner-only version from 12)
--
-- The person who holds the job is the assignee; when nobody was assigned, the
-- hazard stays with the reporter so the old one-tap flow keeps working.
-- At least one after photo is required: a closure decision without evidence is
-- just a second opinion.
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
  v_record   public.records;
  v_owner    uuid;
  v_photos   jsonb := coalesce(p_photos, '[]'::jsonb);
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'You must be signed in with an active account.';
  end if;

  if jsonb_typeof(v_photos) <> 'array' then
    raise exception 'The photo list is not valid.';
  end if;

  if jsonb_array_length(v_photos) > 3 then
    raise exception 'At most 3 after photos are allowed.';
  end if;

  if jsonb_array_length(v_photos) < 1 then
    raise exception 'Add at least one photo of the finished work.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_photos) as photo(path)
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

  v_owner := coalesce(v_record.assigned_to, v_record.submitted_by);

  if v_owner <> auth.uid() then
    raise exception 'Only the worker assigned to this job can finish it.';
  end if;

  if v_record.type <> 'hazard' then
    raise exception 'Only hazard reports have a job to finish.';
  end if;

  if v_record.status <> 'approved' then
    raise exception 'The report must be approved before the job can be finished.';
  end if;

  if v_record.closed_at is not null then
    raise exception 'This job is already closed.';
  end if;

  if v_record.completed_at is not null then
    raise exception 'This job is already complete.';
  end if;

  update public.records
     set completed_at       = now(),
         completed_by       = auth.uid(),
         completion_note    = nullif(btrim(coalesce(p_note, '')), ''),
         completion_photos  = v_photos,
         -- A successful retry clears the send-back note, which is already kept
         -- in previous_attempts.
         reopened_at        = null,
         reopen_reason      = null
   where id = p_record_id;
end;
$$;

revoke all on function public.complete_record(uuid, text, jsonb) from public;
grant execute on function public.complete_record(uuid, text, jsonb)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4. Verify and close
--
-- Closing is the only action that removes the hazard from the health score.
-- A close note is optional but useful when the fix needs a caveat.
-- ---------------------------------------------------------------------------
create or replace function public.verify_close(
  p_record_id uuid,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.records;
begin
  if not public.is_reviewer() then
    raise exception 'Only a supervisor can close a job.';
  end if;

  select * into v_record
  from public.records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Record not found.';
  end if;

  if v_record.type <> 'hazard' then
    raise exception 'Only hazard reports have a job to close.';
  end if;

  if v_record.closed_at is not null then
    raise exception 'This job is already closed.';
  end if;

  if v_record.completed_at is null then
    raise exception 'The worker has not finished this job yet.';
  end if;

  update public.records
     set closed_at  = now(),
         closed_by  = auth.uid(),
         close_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_record_id;

  insert into public.notifications (user_id, record_id, message, kind)
  values (
    coalesce(v_record.completed_by, v_record.assigned_to, v_record.submitted_by),
    p_record_id,
    'Your fix for "' || v_record.title || '" was verified. The job is closed.',
    'review'
  );
end;
$$;

revoke all on function public.verify_close(uuid, text) from public;
grant execute on function public.verify_close(uuid, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 5. Send the work back
--
-- The attempt is archived first, then cleared, so the job returns to the same
-- worker with the reason attached. Photos stay in storage and are still shown
-- under "Previous attempt".
-- ---------------------------------------------------------------------------
create or replace function public.reopen_remediation(
  p_record_id uuid,
  p_reason    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.records;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_reviewer() then
    raise exception 'Only a supervisor can send work back.';
  end if;

  if v_reason is null then
    raise exception 'Say what still needs fixing.';
  end if;

  select * into v_record
  from public.records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Record not found.';
  end if;

  if v_record.type <> 'hazard' then
    raise exception 'Only hazard reports have a job to send back.';
  end if;

  if v_record.completed_at is null and v_record.closed_at is null then
    raise exception 'This job has not been finished yet.';
  end if;

  update public.records
     set previous_attempts = coalesce(previous_attempts, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'note',         v_record.completion_note,
             'photos',       coalesce(v_record.completion_photos, '[]'::jsonb),
             'completed_at', v_record.completed_at,
             'completed_by', v_record.completed_by,
             'close_note',   v_record.close_note,
             'closed_at',    v_record.closed_at,
             'reason',       v_reason
           )
         ),
         completed_at       = null,
         completed_by       = null,
         completion_note    = null,
         completion_photos  = '[]'::jsonb,
         closed_at          = null,
         closed_by          = null,
         close_note         = null,
         reopened_at        = now(),
         reopen_reason      = v_reason
   where id = p_record_id;

  insert into public.notifications (user_id, record_id, message, kind)
  values (
    coalesce(v_record.assigned_to, v_record.submitted_by),
    p_record_id,
    'Your fix for "' || v_record.title || '" was sent back: ' || v_reason,
    'review'
  );
end;
$$;

revoke all on function public.reopen_remediation(uuid, text) from public;
grant execute on function public.reopen_remediation(uuid, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 6. Audit log
--
-- Same function as 12_job_completion.sql, with three new branches. The order
-- matters: one repair action changes several columns at once, so the most
-- specific branch must win.
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
  v_worker text;
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
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
      select full_name into v_worker from public.profiles where id = new.assigned_to;
      perform public.write_audit(
        v_actor, 'record.assigned', 'record', new.id,
        v_name || ' assigned "' || new.title || '" to ' || coalesce(v_worker, 'a field worker'),
        jsonb_build_object('assignee', new.assigned_to, 'priority', new.priority, 'due_on', new.due_on)
      );
    elsif new.closed_at is not null and old.closed_at is null then
      perform public.write_audit(
        v_actor, 'record.verified', 'record', new.id,
        v_name || ' verified and closed "' || new.title || '"',
        jsonb_build_object('note', new.close_note, 'worker', new.completed_by)
      );
    elsif new.completed_at is not null and old.completed_at is null then
      perform public.write_audit(
        v_actor, 'record.completed', 'record', new.id,
        v_name || ' completed the job "' || new.title || '"',
        jsonb_build_object(
          'note', new.completion_note,
          'photos', jsonb_array_length(coalesce(new.completion_photos, '[]'::jsonb))
        )
      );
    elsif old.completed_at is not null and new.completed_at is null then
      perform public.write_audit(
        v_actor, 'record.reopened', 'record', new.id,
        v_name || ' sent "' || new.title || '" back for more work',
        jsonb_build_object('reason', new.reopen_reason)
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


-- Ask PostgREST to pick up the new columns and foreign keys immediately.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- 7. Quick check after running
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'records'
--    and column_name in ('assigned_to', 'assigned_by', 'assigned_at', 'priority',
--                        'due_on', 'closed_at', 'closed_by', 'close_note',
--                        'reopened_at', 'reopen_reason', 'previous_attempts');
-- -- expect 11 rows
--
-- select proname from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('assign_remediation', 'complete_record',
--                    'verify_close', 'reopen_remediation');
-- -- expect 4 rows
-- ---------------------------------------------------------------------------
