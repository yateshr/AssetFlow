/**
 * Database tests: company isolation, permissions and asset-tag creation, run against the LOCAL
 * Supabase database. Every test runs inside a transaction that is rolled back, so nothing is kept.
 *
 *   pnpm db:start        (once)
 *   pnpm test:db
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!/@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)) {
  console.error('Refusing to run: these tests must only run against a local database.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const ids = () => ({
  ws: randomUUID(), A: randomUUID(), B: randomUUID(),
  admin: randomUUID(), userA: randomUUID(), userB: randomUUID(), site: randomUUID(),
  // Unique per test run so they never collide with real accounts in the local database.
  emailAdmin: `admin-${randomUUID()}@test.invalid`, emailA: `a-${randomUUID()}@test.invalid`, emailB: `b-${randomUUID()}@test.invalid`, emailSite: `site-${randomUUID()}@test.invalid`,
});

/** Two companies, an administrator, and one manager in each company. */
async function fixtures(q) {
  const f = ids();
  await q('begin');
  await q(`set local session_replication_role = replica`); // skip signup triggers while inserting fixtures
  await q(`insert into workspaces(id,name) values($1,'Test workspace')`, [f.ws]);
  await q(`insert into companies(id,workspace_id,name,code) values($1,$3,'Company A','TA'),($2,$3,'Company B','TB')`, [f.A, f.B, f.ws]);
  for (const [uid, email] of [[f.admin, f.emailAdmin], [f.userA, f.emailA], [f.userB, f.emailB], [f.site, f.emailSite]]) {
    await q(`insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')`, [uid, email]);
  }
  await q(`insert into company_members(company_id,auth_user_id,role) values($1,$3,'manager'),($2,$4,'manager')`, [f.A, f.B, f.userA, f.userB]);
  await q(`insert into app_users(company_id,id,data) values($1,'fx-admin',$2::jsonb)`, [f.A, JSON.stringify({ id: 'fx-admin', name: 'Admin', email: f.emailAdmin, role: 'admin', status: 'active' })]);
  await q(`insert into locations(company_id,id,data) values($1,'SITE-A1','{"id":"SITE-A1","name":"Site A1"}'),($1,'SITE-A2','{"id":"SITE-A2","name":"Site A2"}'),($2,'SITE-B1','{"id":"SITE-B1","name":"Site B1"}')`, [f.A, f.B]);
  // A site IT admin: manager for company A, limited to SITE-A1.
  await q(`insert into company_access_grants(company_id,email,role,site_id,active) values($1,$2,'manager','SITE-A1',true)`, [f.A, f.emailSite]);
  await q(`insert into assets(company_id,id,data) values($1,'AST-A1','{"id":"AST-A1","assetTag":"TA-A1","serialNumber":"SA1","name":"A1","siteId":"SITE-A1","location":"SITE-A1"}'),($1,'AST-A2','{"id":"AST-A2","assetTag":"TA-A2","serialNumber":"SA2","name":"A2","siteId":"SITE-A2","location":"SITE-A2"}'),($2,'AST-B1','{"id":"AST-B1","assetTag":"TB-B1","serialNumber":"SB1","name":"B1"}')`, [f.A, f.B]);
  await q(`insert into invoices(company_id,id,data) values($1,'INV-A1','{"id":"INV-A1","siteId":"SITE-A1","locationId":"SITE-A1","lineItems":[]}'),($1,'INV-A2','{"id":"INV-A2","siteId":"SITE-A2","locationId":"SITE-A2","lineItems":[]}')`, [f.A]);
  await q(`set local session_replication_role = origin`);
  return f;
}

async function as(q, uid, email) {
  await q(`set local role authenticated`);
  await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, email, role: 'authenticated' })]);
  await q(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
}
const asSuper = q => q(`reset role`);

async function rejects(promise, pattern) {
  try { await promise; } catch (e) { if (pattern.test(e.message)) return; throw new Error(`Expected an error matching ${pattern}, got: ${e.message}`); }
  throw new Error(`Expected an error matching ${pattern}, but it succeeded`);
}
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ----------------------------------------------------------------- isolation
test('a member reads only their own company', async (q, f) => {
  await as(q, f.userA, f.emailA);
  const { rows } = await q(`select collection,id from assetflow_read_company_records($1)`, [f.A]);
  assert(rows.some(r => r.id === 'AST-A1'), 'own asset should be visible');
  assert(!rows.some(r => r.id === 'AST-B1'), 'the other company\'s asset must not be visible');
});

test('a member cannot read another company', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await rejects(q(`select * from assetflow_read_company_records($1)`, [f.B]), /do not have access/i);
});

test('a member cannot write into another company', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await rejects(q(`select assetflow_upsert_company_records($1,'vendors',$2::jsonb)`, [f.B, JSON.stringify([{ id: 'V1', name: 'Evil' }])]), /not allowed/i);
});

test('a member cannot delete in another company', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await rejects(q(`select assetflow_delete_company_records($1,'assets',$2)`, [f.B, ['AST-B1']]), /not allowed/i);
  await asSuper(q);
  const { rows } = await q(`select 1 from assets where company_id=$1 and id='AST-B1'`, [f.B]);
  assert(rows.length === 1, 'the asset must still exist');
});

test('a manager can write ordinary records in their company but not user accounts', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await q(`select assetflow_upsert_company_records($1,'maintenance',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'M1', assetId: 'AST-A1', status: 'scheduled' }])]);
  const { rows } = await q(`select id from assetflow_read_company_records($1) where collection='maintenance'`, [f.A]);
  assert(rows.some(r => r.id === 'M1'), 'maintenance record should be saved as its own row');
  await rejects(q(`select assetflow_upsert_company_records($1,'users',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'U1', email: 'x@y.z', role: 'admin' }])]), /not allowed/i);
});

test('per-record rows do not overwrite each other', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await q(`select assetflow_upsert_company_records($1,'maintenance',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'M1', note: 'first' }])]);
  await q(`select assetflow_upsert_company_records($1,'maintenance',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'M2', note: 'second' }])]);
  const { rows } = await q(`select id from assetflow_read_company_records($1) where collection='maintenance' order by id`, [f.A]);
  assert(rows.map(r => r.id).join() === 'M1,M2', 'saving one record must not remove the other');
});

// ----------------------------------------------------------------- asset tags
async function setUpSeries(q, f, extra = {}) {
  await as(q, f.admin, f.emailAdmin);
  await q(`select assetflow_save_asset_tag_site_series($1,$2::jsonb)`, [f.A, JSON.stringify({ siteId: 'SITE-A1', companyPrefix: 'np', functionPrefix: 'it', series: 'a', nextNumber: 1, digits: 4, active: true, ...extra })]);
}
const newAsset = (id, serial) => ({ id, name: id, type: 'laptop', serialNumber: serial });

test('only an administrator can configure tag numbering', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await rejects(q(`select assetflow_save_asset_tag_site_series($1,$2::jsonb)`, [f.A, JSON.stringify({ siteId: 'SITE-A1', companyPrefix: 'NP', functionPrefix: 'IT', series: 'A' })]), /Super Admin/i);
  await rejects(q(`select assetflow_set_asset_tag_format($1,'/',true)`, [f.A]), /Super Admin/i);
});

test('tags are issued in sequence and never repeat', async (q, f) => {
  await setUpSeries(q, f);
  const first = await q(`select asset_tag from assetflow_reserve_asset_tags($1,'SITE-A1','LAP',2)`, [f.A]);
  const second = await q(`select asset_tag from assetflow_reserve_asset_tags($1,'SITE-A1','MON',1)`, [f.A]);
  const all = [...first.rows, ...second.rows].map(r => r.asset_tag);
  assert(all.join() === 'NP-IT-LAP-A0001,NP-IT-LAP-A0002,NP-IT-MON-A0003', `unexpected tags: ${all}`);
});

test('the company-wide format changes new tags (separator and department code)', async (q, f) => {
  await setUpSeries(q, f);
  const cases = [['/', true, 'NP/IT/LAP/A0001'], ['.', false, 'NP.LAP.A0002'], ['', false, 'NPLAPA0003'], ['_', true, 'NP_IT_LAP_A0004']];
  for (const [sep, useFn, expected] of cases) {
    await q(`select assetflow_set_asset_tag_format($1,$2,$3)`, [f.A, sep, useFn]);
    const { rows } = await q(`select asset_tag from assetflow_reserve_asset_tags($1,'SITE-A1','LAP',1)`, [f.A]);
    assert(rows[0].asset_tag === expected, `expected ${expected}, got ${rows[0].asset_tag}`);
  }
});

test('an unsupported separator is refused', async (q, f) => {
  await setUpSeries(q, f);
  await rejects(q(`select assetflow_set_asset_tag_format($1,'#',true)`, [f.A]), /Unsupported separator/i);
});

test('assets are created with their tags in one step and use the chosen format', async (q, f) => {
  await setUpSeries(q, f, { separator: '.', useFunctionPrefix: false });
  const { rows } = await q(`select assetflow_create_tagged_assets(p_company_id => $1, p_site_id => 'SITE-A1', p_type_code => 'LAP', p_assets => $2::jsonb, p_invoice_id => null, p_invoice_item_id => null) as r`, [f.A, JSON.stringify([newAsset('N1', 'S-1'), newAsset('N2', 'S-2')])]);
  assert(rows[0].r.map(a => a.assetTag).join() === 'NP.LAP.A0001,NP.LAP.A0002', `unexpected: ${JSON.stringify(rows[0].r.map(a => a.assetTag))}`);
  await asSuper(q);
  const next = await q(`select next_number from asset_tag_site_series where company_id=$1`, [f.A]);
  assert(next.rows[0].next_number === 3, 'the counter must move past the created assets');
});

test('a duplicate serial number is rejected and consumes no tag', async (q, f) => {
  await setUpSeries(q, f);
  await q(`select assetflow_create_tagged_assets(p_company_id => $1, p_site_id => 'SITE-A1', p_type_code => 'LAP', p_assets => $2::jsonb, p_invoice_id => null, p_invoice_item_id => null)`, [f.A, JSON.stringify([newAsset('N1', 'SAME')])]);
  await rejects(q(`select assetflow_create_tagged_assets(p_company_id => $1, p_site_id => 'SITE-A1', p_type_code => 'LAP', p_assets => $2::jsonb, p_invoice_id => null, p_invoice_item_id => null)`, [f.A, JSON.stringify([newAsset('N2', 'same')])]), /already exists/i);
  await asSuper(q);
  const next = await q(`select next_number from asset_tag_site_series where company_id=$1`, [f.A]);
  assert(next.rows[0].next_number === 2, 'a failed save must not use up a tag number');
});

test('a site without numbering cannot receive assets', async (q, f) => {
  await as(q, f.admin, f.emailAdmin);
  await rejects(q(`select assetflow_create_tagged_assets(p_company_id => $1, p_site_id => 'SITE-A1', p_type_code => 'LAP', p_assets => $2::jsonb, p_invoice_id => null, p_invoice_item_id => null)`, [f.A, JSON.stringify([newAsset('N1', 'S-9')])]), /No active Site Series/i);
});

test('a manager cannot create tagged assets in another company', async (q, f) => {
  await setUpSeries(q, f);
  await as(q, f.userB, f.emailB);
  await rejects(q(`select assetflow_create_tagged_assets(p_company_id => $1, p_site_id => 'SITE-A1', p_type_code => 'LAP', p_assets => $2::jsonb, p_invoice_id => null, p_invoice_item_id => null)`, [f.A, JSON.stringify([newAsset('X1', 'S-X')])]), /only create assets|not allowed/i);
});

// ----------------------------------------------------------------- site IT admin (limited to one plant)
const asSite = (q, f) => as(q, f.site, f.emailSite);
const assetJson = (id, site, extra = {}) => JSON.stringify([{ id, assetTag: 'T-' + id, serialNumber: 'sn-' + id, siteId: site, location: site, name: id, status: 'available', ...extra }]);
const existsRow = async (q, table, f, id) => { await asSuper(q); const r = await q(`select 1 from ${table} where company_id=$1 and id=$2`, [f.A, id]); await asSite(q, f); return r.rowCount === 1; };

test('a site admin sees only their own plant', async (q, f) => {
  await asSite(q, f);
  const { rows } = await q(`select collection,id from assetflow_read_company_records($1) where collection in ('assets','invoices','locations')`, [f.A]);
  const ids = rows.map(r => r.id).sort().join();
  assert(ids === 'AST-A1,INV-A1,SITE-A1', `expected only plant A1 data, saw: ${ids}`);
});

test('a site admin can change assets at their own plant', async (q, f) => {
  await asSite(q, f);
  await q(`select assetflow_upsert_company_records($1,'assets',$2::jsonb)`, [f.A, assetJson('AST-A1', 'SITE-A1', { name: 'renamed' })]);
  await asSuper(q);
  const { rows } = await q(`select data->>'name' as n from assets where company_id=$1 and id='AST-A1'`, [f.A]);
  assert(rows[0].n === 'renamed', 'the change should be saved');
});

test("a site admin cannot change or take over another plant's asset", async (q, f) => {
  await asSite(q, f);
  await rejects(q(`select assetflow_upsert_company_records($1,'assets',$2::jsonb)`, [f.A, assetJson('AST-A2', 'SITE-A2', { name: 'hacked' })]), /assigned site|another site/i);
  // Saving the other plant's asset again with MY site must not move it over.
  await rejects(q(`select assetflow_upsert_company_records($1,'assets',$2::jsonb)`, [f.A, assetJson('AST-A2', 'SITE-A1')]), /assigned site|another site/i);
  assert(await existsRow(q, 'assets', f, 'AST-A2'), "the other plant's asset must be untouched");
});

test("a site admin cannot delete other plants' assets, invoices or sites", async (q, f) => {
  await asSite(q, f);
  await rejects(q(`select assetflow_delete_company_records($1,'assets',$2)`, [f.A, ['AST-A2']]), /assigned site/i);
  await rejects(q(`select assetflow_delete_company_records($1,'invoices',$2)`, [f.A, ['INV-A2']]), /assigned site/i);
  await rejects(q(`select assetflow_delete_company_records($1,'locations',$2)`, [f.A, ['SITE-A2']]), /assigned site|company-wide/i);
  for (const [table, id] of [['assets', 'AST-A2'], ['invoices', 'INV-A2'], ['locations', 'SITE-A2']]) assert(await existsRow(q, table, f, id), `${table} ${id} must still exist`);
});

test('a site admin can delete records of their own plant', async (q, f) => {
  await asSite(q, f);
  await q(`select assetflow_delete_company_records($1,'invoices',$2)`, [f.A, ['INV-A1']]);
  assert(!(await existsRow(q, 'invoices', f, 'INV-A1')), 'own-plant invoice should be deleted');
});

test('a site admin cannot create a site or change company-wide settings', async (q, f) => {
  await asSite(q, f);
  await rejects(q(`select assetflow_upsert_company_records($1,'locations',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'SITE-NEW', name: 'New' }])]), /another site|assigned site/i);
  await rejects(q(`select assetflow_upsert_company_records($1,'asset-categories',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'x', name: 'X', active: true }])]), /not allowed/i);
  await rejects(q(`select assetflow_upsert_company_records($1,'currencies',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'ZZZ', name: 'ZZZ', active: true }])]), /not allowed/i);
});

test('nobody except an administrator can delete the audit trail', async (q, f) => {
  await asSuper(q);
  await q(`insert into asset_history(company_id,id,data) values($1,'H1','{"id":"H1","assetId":"AST-A1","action":"Assigned","timestamp":"2026-01-01T00:00:00Z"}')`, [f.A]);
  await asSite(q, f);
  await rejects(q(`select assetflow_delete_company_records($1,'history',$2)`, [f.A, ['H1']]), /audit trail/i);
  await as(q, f.userA, f.emailA); // company-wide manager
  await rejects(q(`select assetflow_delete_company_records($1,'audit-logs',$2)`, [f.A, ['x']]), /audit trail/i);
});

test('a company-wide manager still works across all plants', async (q, f) => {
  await as(q, f.userA, f.emailA);
  await q(`select assetflow_upsert_company_records($1,'assets',$2::jsonb)`, [f.A, assetJson('AST-A2', 'SITE-A2', { name: 'by company manager' })]);
  await q(`select assetflow_upsert_company_records($1,'asset-categories',$2::jsonb)`, [f.A, JSON.stringify([{ id: 'ok', name: 'OK', active: true }])]);
});

// ----------------------------------------------------------------- asset requests (no invoice)
async function requestSetup(q, f) {
  await asSuper(q);
  await q(`insert into asset_categories(company_id,id,data) values($1,'laptop','{"id":"laptop","name":"Laptop","code":"LAP","active":true}')`, [f.A]);
  await asAdmin(q, f);
  for (const [site, series] of [['SITE-A1', 'A'], ['SITE-A2', 'B']]) {
    await q(`select assetflow_save_asset_tag_site_series($1,$2::jsonb)`, [f.A, JSON.stringify({ siteId: site, companyPrefix: 'NP', functionPrefix: 'IT', series, nextNumber: 1, digits: 4, active: true })]);
  }
  await asSite(q, f);
}
const asAdmin = (q, f) => as(q, f.admin, f.emailAdmin);
const request = (site, over = {}) => JSON.stringify({ siteId: site, assetType: 'laptop', reason: 'Gifted by a vendor, no invoice', items: [{ name: 'Dell Latitude', serialNumber: 'REQ-1' }, { name: 'Dell Latitude', serialNumber: 'REQ-2' }], ...over });

test('a site admin can ask for assets without an invoice, only for their own site', async (q, f) => {
  await requestSetup(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  assert(rows[0].id, 'a request id should come back');
  await rejects(q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A2')]), /assigned site/i);
});

test('a request needs a reason, a valid type and unique serial numbers', async (q, f) => {
  await requestSetup(q, f);
  await rejects(q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A1', { reason: 'no' })]), /explain/i);
  await rejects(q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A1', { assetType: 'nope' })]), /valid asset type/i);
  await rejects(q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A1', { items: [{ name: 'A', serialNumber: 'X' }, { name: 'B', serialNumber: 'x' }] })]), /unique/i);
  await rejects(q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A1', { items: [{ name: 'A', serialNumber: '' }] })]), /name and a serial/i);
});

test('a site admin cannot approve their own request', async (q, f) => {
  await requestSetup(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  await rejects(q(`select assetflow_decide_asset_creation($1,true,'')`, [rows[0].id]), /Only the Super Admin/i);
});

test('approving a request creates the assets with tags and history', async (q, f) => {
  await requestSetup(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  await asAdmin(q, f);
  const made = await q(`select assetflow_decide_asset_creation($1,true,'ok') as r`, [rows[0].id]);
  assert(made.rows[0].r.map(a => a.assetTag).join() === 'NP-IT-LAP-A0001,NP-IT-LAP-A0002', `unexpected tags: ${JSON.stringify(made.rows[0].r.map(a => a.assetTag))}`);
  assert(made.rows[0].r.every(a => a.siteId === 'SITE-A1' && a.status === 'available'), 'assets should be available at the requested site');
  await asSuper(q);
  const hist = await q(`select count(*)::int as n from asset_history where company_id=$1 and data->>'source'='asset-request'`, [f.A]);
  assert(hist.rows[0].n === 2, 'each asset should get a Purchased history entry');
  const req = await q(`select status, jsonb_array_length(created_asset_ids) as n from asset_creation_requests where id=$1`, [rows[0].id]);
  assert(req.rows[0].status === 'approved' && req.rows[0].n === 2, 'the request should be marked approved with the created ids');
});

test('a request cannot be decided twice, and rejecting creates nothing', async (q, f) => {
  await requestSetup(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  await asAdmin(q, f);
  await q(`select assetflow_decide_asset_creation($1,false,'not needed')`, [rows[0].id]);
  await rejects(q(`select assetflow_decide_asset_creation($1,true,'')`, [rows[0].id]), /already rejected/i);
  await asSuper(q);
  const n = await q(`select count(*)::int as n from assets where company_id=$1 and data->>'serialNumber' like 'REQ-%'`, [f.A]);
  assert(n.rows[0].n === 0, 'no assets should exist after a rejection');
});

test('an approval that fails (duplicate serial) creates nothing and stays pending', async (q, f) => {
  await requestSetup(q, f);
  await asSuper(q);
  await q(`insert into assets(company_id,id,data) values($1,'DUP','{"id":"DUP","serialNumber":"REQ-1","siteId":"SITE-A1","location":"SITE-A1"}')`, [f.A]);
  await asSite(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  await asAdmin(q, f);
  await rejects(q(`select assetflow_decide_asset_creation($1,true,'')`, [rows[0].id]), /already exists/i);
  await asSuper(q);
  const st = await q(`select status from asset_creation_requests where id=$1`, [rows[0].id]);
  assert(st.rows[0].status === 'pending', 'the request should still be pending');
});

test('a site admin sees only their own site\'s requests; the Super Admin sees all', async (q, f) => {
  await requestSetup(q, f);
  await q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A1')]);
  await asAdmin(q, f);
  await q(`select assetflow_request_asset_creation($1,$2::jsonb)`, [f.A, request('SITE-A2', { items: [{ name: 'X', serialNumber: 'OTHER-1' }] })]);
  await asSite(q, f);
  const mine = await q(`select site_id from assetflow_list_asset_creation_requests($1)`, [f.A]);
  assert(mine.rows.map(r => r.site_id).join() === 'SITE-A1', 'the site admin must only see requests for their site');
  await asAdmin(q, f);
  const all = await q(`select site_id from assetflow_list_asset_creation_requests($1)`, [f.A]);
  assert(all.rows.length === 2, 'the Super Admin should see both requests');
});

// ----------------------------------------------------------------- asset holders
const holder = (id, site, kind = 'stock', active = true) => JSON.stringify({ id, siteId: site, kind, name: 'Holder ' + id, active });
async function addHolders(q, f) {
  await asSuper(q);
  await q(`insert into master_data(company_id,collection,id,data) values($1,'holders','H-A1',$2::jsonb),($1,'holders','H-A1-OLD',$3::jsonb),($1,'holders','H-A2',$4::jsonb)`,
    [f.A, holder('H-A1', 'SITE-A1'), holder('H-A1-OLD', 'SITE-A1', 'stock', false), holder('H-A2', 'SITE-A2')]);
}

test("a new asset starts with its site's active stock holder", async (q, f) => {
  await requestSetup(q, f);
  await addHolders(q, f);
  await asSite(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  await asAdmin(q, f);
  const made = await q(`select assetflow_decide_asset_creation($1,true,'') as r`, [rows[0].id]);
  assert(made.rows[0].r.every(a => a.heldBy === 'H-A1' && !a.assignedTo), `expected heldBy H-A1, got ${JSON.stringify(made.rows[0].r.map(a => a.heldBy))}`);
});

test('assets of another site use that site\'s holder', async (q, f) => {
  await requestSetup(q, f);
  await addHolders(q, f);
  await asAdmin(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A2', { items: [{ name: 'M', serialNumber: 'H2-1' }] })]);
  const made = await q(`select assetflow_decide_asset_creation($1,true,'') as r`, [rows[0].id]);
  assert(made.rows[0].r[0].heldBy === 'H-A2', 'the asset should be held by the stock holder of SITE-A2');
});

test('a site without a stock holder still creates assets (no holder yet)', async (q, f) => {
  await requestSetup(q, f);
  await asAdmin(q, f);
  const { rows } = await q(`select assetflow_request_asset_creation($1,$2::jsonb) as id`, [f.A, request('SITE-A1')]);
  const made = await q(`select assetflow_decide_asset_creation($1,true,'') as r`, [rows[0].id]);
  assert(made.rows[0].r.length === 2 && made.rows[0].r.every(a => a.heldBy == null), 'assets are created without a holder');
});

test('only company-wide users can manage holders', async (q, f) => {
  await asSite(q, f);
  await rejects(q(`select assetflow_upsert_company_records($1,'holders',$2::jsonb)`, [f.A, JSON.stringify([JSON.parse(holder('H-NEW', 'SITE-A1'))])]), /not allowed/i);
  await as(q, f.userA, f.emailA); // company-wide manager
  await q(`select assetflow_upsert_company_records($1,'holders',$2::jsonb)`, [f.A, JSON.stringify([JSON.parse(holder('H-NEW', 'SITE-A1'))])]);
});

// ----------------------------------------------------------------- employee ids
test('an employee ID can belong to only one employee in a company', async (q, f) => {
  await as(q, f.admin, f.emailAdmin);
  const emp = (id, code, name) => JSON.stringify([{ id, employeeId: code, name, email: id + '@x.invalid', department: 'HR', siteId: 'SITE-A1', role: 'user', status: 'active' }]);
  await q(`select assetflow_upsert_company_records($1,'users',$2::jsonb)`, [f.A, emp('E1', '1001', 'Asha Rao')]);
  await rejects(q(`select assetflow_upsert_company_records($1,'users',$2::jsonb)`, [f.A, emp('E2', '1001', 'Someone Else')]), /duplicate|unique/i);
  await rejects(q(`select assetflow_upsert_company_records($1,'users',$2::jsonb)`, [f.A, emp('E3', '1001', 'Asha Rao')]), /duplicate|unique/i); // same name, same ID
  await q(`select assetflow_upsert_company_records($1,'users',$2::jsonb)`, [f.A, emp('E4', '1002', 'Asha Rao')]); // same name, different ID is fine
});

test('a site admin cannot delete even their own site', async (q, f) => {
  await asSite(q, f);
  await rejects(q(`select assetflow_delete_company_records($1,'locations',$2)`, [f.A, ['SITE-A1']]), /Only company-wide administrators/i);
  assert(await existsRow(q, 'locations', f, 'SITE-A1'), 'the site must still exist');
  await as(q, f.userA, f.emailA); // company-wide manager may
  await q(`select assetflow_delete_company_records($1,'locations',$2)`, [f.A, ['SITE-A2']]);
});

test('a site has only one active IT Assets Manager (stock holder)', async (q, f) => {
  await as(q, f.userA, f.emailA); // company-wide manager
  const save = (id, kind, active = true) => q(`select assetflow_upsert_company_records($1,'holders',$2::jsonb)`, [f.A, JSON.stringify([{ id, siteId: 'SITE-A1', kind, name: id, active }])]);
  await save('S-1', 'stock');
  await rejects(save('S-2', 'stock'), /duplicate|unique/i);
  await save('SHARED-1', 'shared');
  await save('SHARED-2', 'shared'); // other kinds are unlimited
  await save('S-1', 'stock', false); // archive the manager...
  await save('S-2', 'stock'); // ...then another can take over
  await rejects(save('S-1', 'stock', true), /duplicate|unique/i); // but the old one cannot come back while the new one is active
});

// ----------------------------------------------------------------- runner
let failed = 0;
for (const { name, fn } of tests) {
  const q = async (text, params) => {
    if (/^s*(begin|rollback)/i.test(text)) return client.query(text, params);
    await client.query('savepoint stmt');
    try {
      const result = await client.query(text, params);
      await client.query('release savepoint stmt');
      return result;
    } catch (e) {
      await client.query('rollback to savepoint stmt');
      throw e;
    }
  };
  try {
    const f = await fixtures(q);
    await fn(q, f);
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  } finally {
    await client.query('rollback').catch(() => {});
  }
}
await client.end();
console.log(`\n${tests.length - failed}/${tests.length} database tests passed`);
process.exit(failed ? 1 : 0);
