# AssetFlow Future Operations Module

Added in this pack:
- IT Stock / Inventory
- Asset Transfer Workflow
- Device Specifications
- Network / Infrastructure Assets
- Management Dashboard
- Asset Lifecycle Automation

The module is local-first and uses the existing App-level asset/user/location/history state. Infrastructure, stock catalog, transfers and device specifications are currently in-memory/local UI state, ready for a later Supabase persistence pass.

## Run
npm install
npm run build
npm run dev

If PowerShell blocks npm.ps1:
npm.cmd install
npm.cmd run build
npm.cmd run dev

## Git
Test locally first. Then:
git add .
git commit -m "Add IT operations modules"
git push
