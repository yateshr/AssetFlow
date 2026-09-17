# AssetFlow Selected Improvements - Implemented

This build implements only the six requested improvements:

1. Undo / confirmation for important actions
2. Advanced search & filtering
3. Dashboard drill-down
4. Stronger audit trail
5. Soft delete / restore
6. Demo / Test Data Management

## Behavior

- Asset deletion is now a confirmed soft-delete/archive. Archived assets are excluded from active lists, stored locally, can be restored, and offer an 8-second Undo action.
- Asset creation keeps Asset Tag and Serial Number uniqueness checks, including against archived assets. Asset IDs no longer reuse numbers after archiving.
- Asset filters support multi-term search, status, type, warranty window, location, department, and purchase-price range.
- Dashboard asset metrics/status/type chart elements can drill into the Assets page with filters.
- Audit events can include actor, source, reason, before/after values, and date-range filtering.
- Demo & Data Management is available from the sidebar. Reset Demo Data restores bundled sample state and clears local AssetFlow feature data. Clear Local Feature Data clears browser-stored feature records.
- Existing top-right notification popup and Detailed Profile functionality are preserved.
