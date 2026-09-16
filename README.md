# Welcome to your new project!

Technology Stack
- **Astro** - Modern web framework for building fast, content-focused websites
- **Tailwind CSS v4** - Utility-first CSS framework for rapid UI development
- **shadcn/ui** - Re-usable component library built on Radix UI primitives (54 components pre-installed)
- **React 19** - JavaScript library for building interactive user interfaces
- **Lucide** - Beautiful, consistent icon library with tree-shakeable ES modules

## Local development

Run the live local version with:

```bash
npm run dev -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4321/
```

If the server fails before showing the local URL, check that `src/b12Context.json` exists and that components are under `src/components`.

## Asset management system direction

This system is being shaped as an internal IT asset management and operations platform. Core modules should include:

- Asset inventory, assignment history, warranty, vendors, locations, users, and software licenses.
- Daily IT call logbook with caller details, issue category, priority, assigned technician, status, asset tag, and resolution.
- Automatic dashboards and reports generated from asset, license, warranty, maintenance, assignment, and call-log data.
- Excel report exports using a controlled report layout instead of raw data dumps.

For production hosting, use static frontend hosting plus a real database/backend:

- Frontend: Azure Static Web Apps, Cloudflare Pages, Vercel, or Netlify.
- Access control: company SSO such as Microsoft Entra ID or Cloudflare Access.
- Database/backend: Supabase with Row Level Security enabled, or a company-hosted PostgreSQL/API backend.
- Reports: keep client-side Excel export for simple reports; add a backend report generator later if the team needs locked Excel templates, scheduled reports, approvals, or very large exports.

## Demo admin and user roles

The current local version uses demo users from `src/data/sampleData.ts`.

- The seeded admin user is Sarah Johnson with the role `admin`.
- The demo password is `password` for any listed user email.
- Admin, manager, and user roles can be changed from the Users page by editing a user and selecting a different role.
- These changes are held in browser/app state only. They reset when the app reloads.

For production, create admins through the real authentication backend instead:

- Store users in Supabase Auth or your company identity provider.
- Store application roles in a database table such as `profiles` or `user_roles`.
- Seed the first admin directly in the database during setup.
- Allow only existing admins to promote or demote other users.
- Protect database rows and admin-only actions with backend policies, not frontend checks alone.

## Production database structure

Departments, assets, users, office locations, IT call logs, vendors, and assignments should not be maintained as hardcoded software lists in production.

Use one secured application database with separate linked tables, for example:

- `departments`
- `locations`
- `users`
- `vendors`
- `assets`
- `assignments`
- `it_call_logs`

The starting SQL blueprint is in `database/schema.sql`. This structure lets each user belong to a department and an office location, such as Mumbai, Delhi, or Daman, while keeping reports and asset assignments connected.
- **Vite** - Fast build tool and dev server (powers Astro under the hood)
