-- ============================================================================
-- Millennia FieldOps - 04_triggers.sql
-- Auto-create a profile on sign-up, protect protected columns, and send a
-- notification when a record is reviewed. Run this FOURTH.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create a profile row whenever someone signs up through Supabase Auth.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    -- Only accept a number that already looks like E.164; anything else is
    -- stored as null instead of breaking the sign-up.
    case
      when new.raw_user_meta_data ->> 'phone' ~ '^\+[1-9][0-9]{7,14}$'
        then new.raw_user_meta_data ->> 'phone'
      else null
    end,
    'field_worker',
    -- Everyone who signs up themselves waits for an administrator. Accounts
    -- created from the web dashboard are approved right after creation by the
    -- createUser action, which runs with the service role.
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Protect columns that must not be changed by the wrong role.
--    - A non-admin may not change their own role or active flag.
--    - Only a reviewer may set status / feedback / reviewed_by / reviewed_at.
--    - submitted_by can never change.
-- ---------------------------------------------------------------------------
create or replace function public.protect_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted contexts (SQL editor, service role, the dashboard) have no
  -- end-user identity, so column protection only applies to signed-in users.
  -- Without this, even an administrator could not fix roles from the SQL
  -- editor, because auth.uid() is null there and is_admin() is therefore false.
  if auth.uid() is null then
    return new;
  end if;

  -- profiles: block self-promotion
  if tg_table_name = 'profiles' then
    if not public.is_admin() then
      new.role := old.role;
      new.is_active := old.is_active;
      -- Approval and login identities are decided by an administrator, never
      -- by the account holder.
      new.status := old.status;
      new.phone := old.phone;
      new.email := old.email;
      new.requested_at := old.requested_at;
      new.decided_by := old.decided_by;
      new.decided_at := old.decided_at;
      new.decision_note := old.decision_note;
    end if;
    return new;
  end if;

  -- records
  if tg_table_name = 'records' then
    new.submitted_by := old.submitted_by;
    new.created_at := old.created_at;

    if not public.is_reviewer() then
      -- A field worker editing their own pending record keeps review fields fixed.
      new.status := old.status;
      new.supervisor_feedback := old.supervisor_feedback;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profiles_columns on public.profiles;
create trigger protect_profiles_columns
  before update on public.profiles
  for each row execute function public.protect_columns();

drop trigger if exists protect_records_columns on public.records;
create trigger protect_records_columns
  before update on public.records
  for each row execute function public.protect_columns();

-- ---------------------------------------------------------------------------
-- 3. Notify the submitter when their record is approved or rejected.
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
      'Your record "' || new.title || '" was ' || new.status || '.',
      'review'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_record_review on public.records;
create trigger notify_record_review
  after update on public.records
  for each row execute function public.notify_on_review();

-- ---------------------------------------------------------------------------
-- 4. Keep reviewed_at / reviewed_by sensible when a status decision is made.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  elsif new.status = 'pending' then
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_record_review on public.records;
create trigger stamp_record_review
  before update on public.records
  for each row execute function public.stamp_review();
