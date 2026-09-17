# AssetFlow Future Feature Pack

This version is based on the current AssetFlow project supplied for this update.

## Added

- Global search across assets, users, vendors, locations and invoices.
- IT Operations Hub in the sidebar.
- Warranty overview and 30/60/90-day warranty filtering on Assets.
- Warranty/assignment/request notification center.
- Repair and maintenance workflow with asset status changes and history events.
- Employee asset request workflow with approval/rejection.
- My Assets employee view.
- Straight-line depreciation calculator and book-value view.
- Asset label printing from the browser.
- CSV asset export.
- CSV validation/import with duplicate asset-tag protection.
- Role permission reference matrix.
- Future Supabase schema preparation for maintenance, requests, notifications and depreciation.

## Local-first behavior

The UI remains local-first. Asset data continues to live in the existing React state. Operations requests and maintenance records are also saved in browser localStorage so a refresh does not immediately erase them.

The future schema is supplied separately in `database/future_features_schema.sql` and is not automatically applied to Supabase.

## Start

```powershell
npm install
npm run dev
```

If PowerShell blocks `npm.ps1` on a managed Windows PC:

```powershell
npm.cmd install
npm.cmd run dev
```

## Git

After testing:

```powershell
git add .
git commit -m "Add AssetFlow future feature pack"
git push
```

On another computer:

```powershell
git pull
npm install
npm run dev
```
