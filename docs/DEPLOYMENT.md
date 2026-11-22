# Deploying AssetFlow on your own server or NAS

AssetFlow has two parts:

| Part | What it is | How you run it |
|---|---|---|
| **The app** | A web page (static files). Built once into a small Docker image. | This repository's `Dockerfile` |
| **The database** | Your company's own Supabase (Postgres, login, API). All data lives here. | Supabase's official self-hosting setup |

Nothing is shared with anyone else: your database holds your data only. One app image works for any company; the database address is given when it starts.

> **Status.** The app image and the settings below were built and checked on a development PC. They have **not** yet been tested on a Synology, QNAP or other NAS, nor behind a company reverse proxy. Test with a copy of your data first.

---

## 1. What you need

- A machine that stays on: a NAS with Docker (Synology "Container Manager", QNAP "Container Station"), a Linux server, or a Windows PC with Docker Desktop.
- About **4 GB of RAM** free and **10 GB of disk** to start (Supabase is the larger part).
- A name your staff can type, for example `assets.yourcompany.com`, pointing at that machine. The app and the database need to be reachable from your staff's browsers. Use **HTTPS** if anyone connects from outside the office.
- Optional but recommended: an e-mail (SMTP) account so invitations and password resets can be sent.

## 2. Set up the database (Supabase)

Follow Supabase's own guide, which is kept up to date:
<https://supabase.com/docs/guides/self-hosting/docker>

In short: download their `docker` folder, copy `.env.example` to `.env`, **replace every secret** (database password, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`; they explain how to generate matching keys), then `docker compose up -d`.

Settings that matter for AssetFlow:

| Setting (Supabase `.env`) | Value |
|---|---|
| `SITE_URL` | The address people use for AssetFlow, e.g. `https://assets.yourcompany.com` |
| `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` | The public address of the Supabase API, e.g. `https://db.yourcompany.com` |
| `ENABLE_EMAIL_SIGNUP` | `true` (AssetFlow itself only lets invited e-mail addresses create accounts) |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` if you set up SMTP, `true` only for a closed test |
| `SMTP_*` | Your mail server, so invitations and "forgot password" work |

Write down the **API address** and the **anon (public) key**. You need them in step 4. Never give the `service_role` key to the app.

## 3. Create AssetFlow's tables

From a copy of this repository, apply the migrations in `supabase/migrations/` to your new database, in file-name order. The easiest way, from the repository folder:

```powershell
npx supabase db push --db-url "postgresql://postgres:YOUR_DB_PASSWORD@YOUR_SERVER:5432/postgres"
```

If you cannot reach the database port from your PC, copy the `supabase/migrations` folder to the server and run each `.sql` file with `psql`, oldest first.

Run this again after every AssetFlow update that adds a migration file.

## 4. Start the app

On the server, in the repository folder:

```powershell
Copy-Item .env.docker.example .env
# edit .env: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY (the public/anon key)
docker compose up -d --build
```

Open `http://SERVER:8080`. The first build downloads packages and can take **10 minutes or more** the first time.

To use another port, set `ASSETFLOW_PORT` in `.env`.

### Without Compose

```powershell
docker build -t assetflow .
docker run -d --name assetflow --restart unless-stopped -p 8080:80 `
  -e PUBLIC_SUPABASE_URL=https://db.yourcompany.com `
  -e PUBLIC_SUPABASE_KEY=YOUR_PUBLIC_KEY assetflow
```

## 5. First sign-in

1. Open the app. If it says **"not configured"**, the two settings in step 4 are missing or wrong.
2. Choose **Create your account** on the first run. **The first account becomes the administrator.**
3. Follow the **Getting started** checklist on the dashboard: site → numbering → departments → employees → first asset → labels.
4. Invite your IT staff from **Settings → Company Setup**; they sign in with the e-mail address you invited.

## 6. HTTPS and a friendly address

Put a reverse proxy in front so people use `https://assets.yourcompany.com`. Two common choices:

- **Synology / QNAP:** the built-in reverse proxy (Control Panel → Login Portal → Advanced → Reverse Proxy) with a Let's Encrypt certificate.
- **Caddy** (automatic certificates), for a Linux server:

```
assets.yourcompany.com {
    reverse_proxy localhost:8080
}
db.yourcompany.com {
    reverse_proxy localhost:8000
}
```

The browser talks to the database directly, so the **database address must also be HTTPS** when the app is. A mix of `https` app and `http` database is blocked by browsers.

## 7. Backups (do this before real data goes in)

AssetFlow's Data Management page can download a JSON snapshot, but your main backup should be the **database itself**:

```powershell
docker exec supabase-db pg_dump -U postgres -Fc postgres > assetflow-$(Get-Date -Format yyyy-MM-dd).dump
```

(`supabase-db` is the name of the Postgres container in Supabase's compose file; check with `docker ps`.)

- Schedule it nightly (Synology Task Scheduler, cron, or Windows Task Scheduler) and copy the file **off the machine**.
- **Test a restore** on another machine at least once. A backup you have never restored is a guess.
- Also keep the Supabase `.env` file in a safe place: without the same `JWT_SECRET` and keys, restored data cannot be used.

## 8. Updating AssetFlow

```powershell
git pull
npx supabase db push --db-url "postgresql://postgres:YOUR_DB_PASSWORD@YOUR_SERVER:5432/postgres"
docker compose up -d --build
```

Take a database backup first.

## 9. Checking that it works

```powershell
curl http://SERVER:8080/healthz        # prints: ok
curl http://SERVER:8080/config.js       # shows the database address the app will use
```

| Problem | Likely cause |
|---|---|
| "Not configured" screen | `PUBLIC_SUPABASE_URL` or `PUBLIC_SUPABASE_KEY` empty. Check `/config.js`, then `docker compose up -d` again. |
| Sign-in works but lists are empty or errors appear | Migrations were not applied (step 3), or applied to a different database. |
| "Failed to fetch" / blocked request | The database address is not reachable from the browser, or the app is HTTPS and the database is not. |
| Invitation or reset e-mails never arrive | SMTP settings in the Supabase `.env`. |
| Cannot create the first account | The database already has users. Sign in with an existing account instead. |

## 10. What to keep private

- Never commit or share: Supabase `.env`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, the database password, backups.
- The **public (anon) key** in the app's settings is meant to be public. Row-level security in the database is what protects the data.
