-- Deleting a site is a company-wide decision: a site IT admin can edit their own site but not remove it.
do $$
declare def text;
begin
  def:=pg_get_functiondef('public.assetflow_delete_company_records(uuid,text,text[])'::regprocedure);
  if position('Only company-wide administrators can delete sites' in def)=0 then
    def:=replace(def,
      'if p_collection in (''history'',''audit-logs'') and not public.assetflow_is_workspace_admin() then raise exception ''The audit trail cannot be deleted''; end if;',
      'if p_collection in (''history'',''audit-logs'') and not public.assetflow_is_workspace_admin() then raise exception ''The audit trail cannot be deleted''; end if;'||chr(10)||
      '  if p_collection=''locations'' and not public.assetflow_has_all_sites(p_company_id) then raise exception ''Only company-wide administrators can delete sites''; end if;');
    if position('Only company-wide administrators can delete sites' in def)=0 then raise exception 'Could not patch the delete function'; end if;
    execute def;
  end if;
end $$;
