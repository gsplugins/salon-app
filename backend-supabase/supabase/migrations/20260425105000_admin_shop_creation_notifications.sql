-- Add metadata payload support to audit logs for rich admin notifications.
alter table audit_logs add column if not exists metadata jsonb;
-- Speed up admin dashboard notification feed queries.
create index if not exists idx_audit_logs_action_created on audit_logs(action, created_at desc);
