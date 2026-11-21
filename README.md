# AssetFlow

Self-hosted IT asset management for a company with one or many locations: assets, assignments, licenses, vendors, invoices, IT call logbook, maintenance, stock, infrastructure, audit trail and executive reports.

**Every company runs its own copy.** You clone this repository, create your own free [Supabase](https://supabase.com) project, and all of your data and logins live there. Nothing is shared with anyone else and no company data ships with the code.

Stack: Astro, React 19, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth).

## Setup (about 10 minutes)

### 1. Get the code

```bash
git clone <this-repo-url> assetflow
cd assetflow
pnpm install
```

### 2a. Local database (no cloud account needed, good for trying it out)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
pnpm db:start          # first run downloads images and creates the local database
pnpm db:migrate        # applies any new AssetFlow database upgrades
```

When it finishes it prints a **Publishable key**. Create `.env.local`:

```text
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_KEY=<the Publishable key printed by supabase start>
```

Then skip to **4. Run it**. Handy extras: Studio (table browser) at <http://127.0.0.1:54323>, test e-mails at <http://127.0.0.1:54324>, `pnpm db:stop` to shut down, `pnpm db:reset` to wipe the local database and re-apply the schema. Data persists between restarts until you reset.

### 2b. Hosted database (for real, multi-user use)

1. Create a project at <https://supabase.com> (free tier is fine).
2. Link the project and install every database migration automatically:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   This creates and upgrades all required tables, relationships, indexes, permissions and database functions. You do not manually create tables or IDs in the Supabase dashboard.
3. **Authentication → Providers → Email**: leave email sign-in on. If you do not want to set up SMTP, turn **Confirm email** off, otherwise users must click a confirmation link first.

### 3. Connect the app (hosted only)

```bash
cp .env.example .env     # on Windows: copy .env.example .env
```

(`.env.local`, if present, takes priority over `.env`, so delete it when you move to a hosted database.) Fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY` from **Project Settings → API** (use the *anon / publishable* key, never the `service_role` key).

### 4. Run it

```bash
pnpm dev
```

Open <http://localhost:4321>. On a fresh database you will see **Set up your workspace**: enter your name, company name, e-mail and a password. You become the **administrator**.

## Adding your team

1. As admin, open **Users** and add a person with their work e-mail and a role.
2. They open the sign-in page, choose **Create your account**, and register with that same e-mail.
   Accounts can only be created for e-mails an administrator added first.

| Role | Can do |
|---|---|
| **admin** | Everything, including users, settings, and the Demo & Data tools |
| **manager** | Create and edit assets, vendors, invoices, assignments, licenses, locations |
| **user** | View everything; log IT calls |

These rules are enforced by database functions, not just hidden in the UI.

## Configure your company

Start empty and set up your own structure under **Settings**: company name, currency (INR by default, other currencies selectable), locations, departments, asset types and asset-tag numbering.

Want to look around first? An admin can import example data from **Demo & Data → Load sample data** and erase it again with **Erase all data**.

## Deploying

It is a static site: build with `pnpm build` and host the `dist/` folder anywhere (Cloudflare Pages, Netlify, Vercel, Azure Static Web Apps, your own server). Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY` as build-time environment variables on your host. In Supabase, add your site URL under **Authentication → URL Configuration**.

## How data is stored

AssetFlow uses dedicated PostgreSQL tables for users, departments, locations, vendors, asset categories, assets, invoices, invoice line items, assignments, asset history, IT call logs, software licences, audit logs and master data. Important searchable fields are indexed and relationships use foreign keys.

The application reads and writes these tables through validated database functions. When an end user creates a vendor, location, user, asset or invoice in AssetFlow, the corresponding database table is updated automatically. Database migrations create and upgrade the schema; normal users never need the Supabase dashboard.

For compatibility during the relational migration, each business row also retains its complete application payload in a JSON column. The legacy `records` table is retained temporarily as rollback evidence but is no longer used by the application after the new migration is installed.

## Backups

Use Supabase's built-in backups (paid plans) or run `pg_dump` against your project's connection string on a schedule. You own the data.

## Security notes

- Only the *publishable* key is used in the browser. Keep your `service_role` key out of this repo.
- Do not commit `.env` (it is git-ignored).
- Consider enabling MFA and a strong password policy in Supabase Auth.
