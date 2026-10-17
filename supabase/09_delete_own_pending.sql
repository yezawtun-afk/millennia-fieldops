-- ============================================================================
-- Millennia FieldOps - 09_delete_own_pending.sql
-- Let the person who submitted a record delete it while it is still pending.
--
-- WHEN YOU NEED THIS
-- ------------------
-- 02_policies.sql only allows administrators to delete records. That is correct
-- for records that are published to the site history, but a field worker should
-- be able to take back their own record while a supervisor has not reviewed it
-- yet: wrong zone, test entry, duplicate sent by mistake.
--
-- Rule added here:
--   * a field worker may delete a record they submitted, but only while its
--     status is 'pending'. As soon as it is approved or rejected it is part of
--     the site record and only an admin can remove it.
--   * administrators keep their unrestricted delete (policy
--     records_delete_admin in 02_policies.sql).
--
-- Both policies are permissive, so Postgres ORs them together.
--
-- Deleting a record also deletes its review notifications (the notifications
-- table has "on delete cascade") and the app deletes the record's photos from
-- the storage bucket (storage policy record_photos_delete allows the owner).
--
-- Safe to run more than once.
-- ============================================================================

drop policy if exists records_delete_own_pending on public.records;
create policy records_delete_own_pending on public.records
  for delete to authenticated
  using (submitted_by = auth.uid() and status = 'pending');
