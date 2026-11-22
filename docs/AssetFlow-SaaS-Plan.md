# AssetFlow as a hosted service (SaaS): information, plan and business case

Prepared 22 Nov 2026 from a planning conversation. This is **information only**; nothing in here is implemented yet.

> **Read this first.** Every price, cost, income figure and time estimate below is a **rough estimate or assumption**, not a quote or forecast. Verify prices with the providers and test demand with real customers before spending money.

---

## 1. The idea

Companies buy AssetFlow as a service. They do not buy hosting or a domain.

- You own the domain (for example `assetflow.com`, to be checked, see section 9).
- Each customer gets its own address and its own logins, created automatically:
  - Nirmal Polyplast Pvt Ltd → `nppl.assetflow.com`
  - Ratan Polyplast Ltd → `ratan.assetflow.com`
- Inside, each customer sets up its own companies, sites, departments, employees and assets.
- Customers never see each other's data.

This is the same model as products like Spine HR.

## 2. Where the product is today

Already built (self-hosted, one database per installation):

- Companies → sites → departments → employees, with roles (super admin, admin, manager, user)
- Assets with site-based tag numbering, assignments, transfers with approvals, invoices and payments, vendors, licenses, IT call logbook with SLA
- Expiry & Alerts page and Warranty tracker, QR/barcode label printing (34×22 and 25×14 mm), Excel/CSV export on lists, workbook import
- System setup: master data lists, regional formats, alert and depreciation settings
- Local Supabase backend with real sign-in and database row-level security

Remaining product roadmap before selling: automated tests, Docker deployment, e-mail expiry alerts, defence-in-depth security rules on all tables, cleanup of the old `records` store and the leftover `organizations` table.

## 3. How the idea maps to technology

| Concept | Meaning for AssetFlow |
|---|---|
| **Tenant** | One paying customer, such as Nirmal Polyplast. Gets a sub-domain. This layer does **not exist yet**. |
| **Company** | A legal entity inside a tenant. Exists today. |
| **Site** | An office, plant or warehouse inside a company. Exists today. |
| **Sub-domain** | One wildcard DNS record `*.assetflow.com` plus one wildcard certificate. One web server reads the sub-domain and loads the right tenant. Nothing is set up per customer by hand. |
| **Login** | One login can belong to several tenants (for example an IT consultant). Design for memberships, not one fixed company per user. |

### Two ways to keep customers' data apart

| | Shared database (every row tagged with a tenant) | Separate database per customer |
|---|---|---|
| Cost per customer | Very low | High (one database or Supabase project each) |
| Isolation | Depends on security rules being perfect | Strong, physically separate |
| Upgrades | Once, for everyone | Repeated for every customer |
| Best for | Many small and medium customers | A few large customers who demand isolation |

**Recommendation:** start with the shared database. Sell "separate database" or "self-hosted" to large customers as a premium option. The big risk is a rule mistake leaking one customer's data to another, so automated isolation tests are required before the first paying customer.

## 4. What is missing for a hosted service

1. **Tenant layer and sign-up:** "buy now → tenant, sub-domain and first admin created automatically", e-mail verification (needs an outgoing mail service).
2. **Billing:** plans, trials, invoices with GST, failed-payment handling, cancellation. In India: Razorpay or Stripe. Plan limits (assets, users, sites) must be enforced in the app.
3. **Operator console (for you):** list customers, suspend, see usage, log in as a customer for support.
4. **Operations:** automatic backups, restore tests, monitoring, error alerts, uptime promise, per-customer data export and deletion.
5. **Security and legal:** an external security test, rate limiting, terms of service, privacy policy, data-processing agreement (India's data-protection law applies).
6. **Licence decision:** if the code stays public on GitHub for self-hosting, someone could host it and compete. Options: a licence that forbids competing hosted services (AGPL or BSL), or **open-core** (keep billing and tenant code private).

## 5. Build plan: order and effort

Effort is in **working weeks for one developer working full-time with AI assistance**. Halve it for two developers on parallel parts; add 30-50% if part-time or if surprises appear.

| # | Phase | What | Effort | Output |
|---|---|---|---|---|
| 0 | **Validate** | Name, domain and trademark check. Talk to 10 target companies. Test pricing. Finish the current product roadmap (tests, Docker). | 2-3 wks | Go / no-go decision |
| 1 | **Harden** | Automated tests including tenant-isolation tests, security rules on every table, remove old `records` and `organizations`, alert-rule settings, automatic backups. | 3-4 wks | Safe base |
| 2 | **Tenant layer** | Tenants table above companies, memberships, sub-domain routing, wildcard DNS and certificate, one build serving every tenant, tenant-aware login. | 4-6 wks | Manual-tenant pilot possible |
| 3 | **Provisioning** | Public sign-up, e-mail verification, automatic seeding, import wizard (Excel), invite teammates. | 3-4 wks | Self-service sign-up |
| 4 | **Billing** | Plans and limits, trial, Razorpay/Stripe, GST invoices, failed-payment handling, upgrade and cancel. | 3-5 wks | Taking money |
| 5 | **Operator console** | Customer list, usage, suspend, impersonate with audit, support notes. | 2-3 wks | You can run it |
| 6 | **Operations and compliance** | Monitoring, status page, restore drills, security test, legal documents, data export and deletion. | 3-4 wks (then ongoing) | Safe to promise uptime |
| 7 | **Growth features** | E-mail warranty reminders, custom fields, module on/off, custom domain, API, single sign-on, mobile stock-take. | ongoing | Reasons to upgrade |

**Totals (estimates):**
- **Pilot-ready** (3-5 hand-created customers, no billing automation): phases 0, 1, and 2 = about **9-13 weeks (~2.5-3 months)**.
- **Public launch** (self-service sign-up and billing): phases 0-6 = about **20-29 weeks (~5-7 months)**.
- **Mature product** with growth features: 12 months or more.

**Gate rule:** do not start phases 3-5 until at least 3 pilot customers have agreed to pay. Pilot first, automate later.

## 6. Possible investment (India, ₹, estimates)

### One-time

| Item | Estimate |
|---|---|
| Domain (a normal `.com` is cheap; a premium name can be very expensive) | ₹1,000 - ₹10,000 per year, premium far more |
| Trademark search and filing | ₹10,000 - ₹25,000 |
| Legal documents (terms, privacy, data-processing agreement) | ₹15,000 - ₹50,000 |
| External security test | ₹50,000 - ₹2,00,000 |
| Logo, brand and landing page design | ₹0 - ₹50,000 |
| Test label printer and sticker rolls | ₹15,000 - ₹30,000 |
| **One-time total** | **about ₹1 - 4 lakh** |

### Monthly running cost (first year)

| Item | Estimate |
|---|---|
| Hosting (managed Supabase or a VPS) | ₹3,000 - ₹15,000 |
| E-mail sending service | ₹1,000 - ₹5,000 |
| Monitoring, error tracking, backups storage | ₹0 - ₹5,000 |
| Accounting / GST filing | ₹2,000 - ₹5,000 |
| Support tools | ₹0 - ₹3,000 |
| Payment fees | about 2-3% of revenue |
| Marketing and sales | ₹20,000 - ₹50,000 (or founder-led) |
| **Monthly total** | **about ₹10,000 - ₹30,000 before marketing, ₹30,000 - ₹80,000 with it** |

### People

- If you build it yourself with AI help, the cost is your time.
- A freelance developer typically costs ₹50,000 - ₹1,50,000 per month.

**First-year lean budget (excluding your own salary): about ₹5 - 10 lakh.**

## 7. Possible income

### Suggested plans (to test, not final)

| Plan | Monthly price | Includes |
|---|---|---|
| Free / trial | ₹0 | Up to 25 assets, 1 site, 14-30 day or permanent small tier for acquisition |
| Starter | ₹999 | Up to 100 assets, 1 company, 2 sites |
| Business | ₹2,999 | Up to 1,000 assets, 3 companies, 5 sites, e-mail alerts |
| Enterprise | ₹8,000+ (custom) | Unlimited assets, single sign-on, longer audit history, priority support, separate database option |

Charge by **assets and sites**, not per user, because customers' IT teams are small. Offer about 2 months free for annual payment.

### Scenarios (illustrative, average revenue per customer ₹2,000 per month)

| Scenario | End of year 1 | End of year 2 | End of year 3 |
|---|---|---|---|
| Cautious | 8 customers → ₹16,000/mo | 20 → ₹40,000/mo | 40 → ₹80,000/mo |
| Realistic | 20 → ₹40,000/mo | 60 → ₹1.2 lakh/mo | 150 → ₹3 lakh/mo |
| Optimistic | 50 → ₹1 lakh/mo | 150 → ₹3 lakh/mo | 400 → ₹8 lakh/mo |

Assumptions: SMB monthly churn of about 3%, no large enterprise deals, and revenue grows only if you keep selling. These are not forecasts.

### Break-even

At ₹30,000 monthly running cost and ₹2,000 per customer, break-even on infrastructure is roughly **15 customers**. Covering your own time, support and sales needs more, typically **40-60 customers**.

### Extra income per customer

- Onboarding and data import (one-time): ₹5,000 - ₹25,000 per customer
- QR/barcode sticker rolls or printer bundles (resale margin)
- Add-ons: custom domain, white-label branding, API access, e-mail and WhatsApp alerts
- Paid training sessions

### Timeline to money

- First paying pilot customers: about month 3-4 (manual setup, invoiced by you).
- First automated payments: about month 6-7 (after phase 4).
- Meaningful recurring income (₹1 lakh/mo): usually 18-30 months in the realistic scenario.

## 8. Sales possibilities

### Who buys

- Manufacturing and plant companies with several sites (your own contacts: Nirmal Polyplast, Ratan Polyplast are real references)
- Schools, colleges and universities
- Hospitals and clinics
- Retail chains and franchises with many outlets
- Co-working spaces, offices with 50-500 employees
- IT vendors and managed-service providers (as resellers)
- Government and public-sector bodies (large but very slow to sell to)

### How to reach them

- **Founder-led sales** to people you already know, using the first customers as case studies.
- **Resellers and partners:** local IT hardware vendors, system integrators and AMC providers, who already talk to IT heads. Give them 20-30% of the first year.
- **Content and SEO:** pages like "IT asset register Excel template India" and "how to label IT assets"; a free Excel template as a lead magnet.
- **Free tier** for up to 25 assets as acquisition, with an upgrade prompt.
- **Directories and listings:** G2, Capterra, GetApp, IndiaMART, local SaaS lists.
- **LinkedIn and WhatsApp groups** of IT heads and admin managers.
- **YouTube demos** showing the sticker, warranty alert and Excel import features.

### Sales reality

- Typical small-company sales cycle: 2-8 weeks.
- Competitors: Zoho Assets, ManageEngine, Freshservice, Snipe-IT (free if self-hosted). Many small companies simply use Excel.
- Your angle: **simple, India-first, cheap**. INR and GST, Excel import, your own sticker formats, warranty alerts, multi-site and multi-company from day one.

## 9. Before you spend money

- **Name and domain:** `assetflow.com` may be taken or priced as premium. "AssetFlow" is a common product name, so check trademarks and consider `.in`, `.io` or a different name.
- **Pilot first:** hand-create 3-5 tenants for friendly companies and charge a small price. This proves demand before building automation.
- **Reliability becomes your job:** once customers rely on it, downtime and data loss are your responsibility.
- **Data protection:** know where the data is stored, who can see it, and how a customer can export or delete it.

## 10. Other possibilities beyond a basic subscription

- **Self-hosted paid support:** customers run it on their own server and pay for installation, updates and support. Works well for security-conscious manufacturers.
- **White-label for resellers:** an IT vendor sells it under their own name and domain.
- **Open-core:** keep the self-hosted core open, sell the cloud and premium features.
- **Fixed-asset register with Indian depreciation:** extend assets to machinery, vehicles and furniture with Companies Act and Income Tax depreciation rates, a strong fit for manufacturers.
- **Maintenance management for machines (CMMS):** preventive-maintenance schedules for plant equipment.
- **Integrations:** Tally and Zoho Books for invoices; Microsoft Entra / Google Workspace for employee sync; Slack, Teams and WhatsApp for alerts.
- **Mobile stock-take app:** scan QR labels to audit assets on site. Strong upgrade reason.
- **Warranty and AMC renewals:** commissions from vendors when a customer renews through you.
- **Hardware bundle:** label printer, sticker rolls and onboarding as one package.
- **Consulting and implementation services** for larger customers.
- **Sale or acquisition:** a product with paying customers can later be sold to a larger IT-management company.

## 11. Suggested next steps (in order)

1. Finish the product roadmap: automated tests, Docker deployment, e-mail expiry alerts.
2. Check the name, domain and trademark. Decide the licence (open-core or protected).
3. Talk to 10 target companies; get 3-5 pilot customers.
4. Build phases 1 and 2 (harden, tenant layer) and run the pilot with hand-created tenants.
5. Only if pilots agree to pay: build sign-up, billing and the operator console, then launch.

---

## Appendix A: What is fixed in the code and what could be configurable

### Fixed on purpose (keep fixed)

| What | Why |
|---|---|
| User roles (super admin, admin, manager, user) | Database rules and permissions test for these exact names. |
| Asset statuses (available, assigned, maintenance, retired, disposed, lost) | Assignment, alerts and the warranty tracker depend on them. |
| Invoice statuses (draft, open, received, partially-paid, paid, overdue, cancelled) | Payments and receiving move invoices between these states. |
| Assignment and employee statuses | Check-in and check-out rules depend on them. |
| Asset history action names | The audit trail and filters match on them. |
| Special condition names ("new", "damaged", "missing") | "Damaged" sends an asset to repair. |

Making these editable would need a "behaviour" setting for every custom value, and the security rules would need a roles table, which could expose data across companies. Allow custom *display names* only.

### Hardcoded numbers and rules to move into settings (cheap and safe)

- Alert severity: 7 days critical, 30 days warning
- Vendor contract warning: 60 days
- Invoice "due soon": 7 days
- Warranty tracker bands: 30, 90, 365 days
- SLA "due soon" warning: last 25% of the time
- Invoice attachment limit: 2 MB, PDF/JPG/PNG/WebP
- Stock categories "General" and "IT Spare"
- Starting defaults (INR, `en-IN`, `Asia/Kolkata`, 9 currencies, 4 priorities): copied into each company on first load, so already editable

### Already configurable

Currencies, units, payment methods and terms, call categories and priorities, support teams, site and infrastructure types, license types, asset categories and tag numbering.

### Limited today

- Sidebar pages cannot be switched on and off per company (a future "enabled modules" setting).
- No custom fields on assets, employees or vendors. This is the biggest gap against Snipe-IT and Zoho Assets, and it matters for selling to many different companies.
- All screen text is English.
