-- Remove the pre-multi-company RPC surface. Keeping these functions would
-- permit unscoped reads and their old ON CONFLICT(id) contract is no longer
-- valid after IDs became company-scoped.
drop function if exists public.assetflow_read_records();
drop function if exists public.assetflow_upsert_records(text,jsonb);
drop function if exists public.assetflow_delete_records(text,text[]);
