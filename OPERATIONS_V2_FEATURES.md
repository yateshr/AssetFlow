# AssetFlow Operations Modules v2

Included in this release:
- Optional detailed device management profiles for laptops, desktops and servers.
- Advanced management reports with asset value, age, status/type distribution, assigned/repair rates and warranty alerts.
- IT stock movement history for received, issued, returned and adjusted stock.
- Smart notification center for warranty, low stock, offline infrastructure, requests and maintenance.
- Working header notification icon with unread count and direct navigation to the notification center.
- Audit & Compliance page with lifecycle events, compliance checks, filtering and CSV export.

All new operational state remains local-first through browser storage. Supabase schema preparation is provided separately in `database/operations_v2_schema.sql`.

Before committing:
1. `npm install` (or `npm.cmd install` on PowerShell when script execution is restricted)
2. `npm run build` (or `npm.cmd run build`)
3. Test the Operations Hub and Audit Logs.
4. Only after testing, commit and push to GitHub.
