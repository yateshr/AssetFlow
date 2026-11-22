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
  admin: randomUUID(), userA: randomUUID(), userB: randomUUID(),
  // Unique per test run so they never collide with real accounts in the local database.
  emailAdmin: `admin-${randomUUID()}@test.invalid`, emailA: `a-${randomUUID()}@test.invalid`, emailB: `b-${randomUUID()}@test.invalid`,
});

/** Two companies, an administrator, and one manager in each company. */
async function fixtures(q) {
  const f = ids();
  await q('begin');
  await q(`set local session_replication_role = replica`); // skip signup triggers while inserting fixtures
  await q(`insert into workspaces(id,name) values($1,'Test workspace')`, [f.ws]);
  await q(`insert into companies(id,workspace_id,name,code) values($1,$3,'Company A','TA'),($2,$3,'Company B','TB')`, [f.A, f.B, f.ws]);
  for (const [uid, email] of [[f.admin, f.emailAdmin], [f.userA, f.emailA], [f.userB, f.emailB]]) {
    await q(`insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')`, [uid, email]);
  }
  await q(`insert into company_members(company_id,auth_user_id,role) values($1,$3,'manager'),($2,$4,'manager')`, [f.A, f.B, f.userA, f.userB]);
  await q(`insert into app_users(company_id,id,data) values($1,'fx-admin',$2::jsonb)`, [f.A, JSON.stringify({ id: 'fx-admin', name: 'Admin', email: f.emailAdmin, role: 'admin', status: 'active' })]);
  await q(`insert into locations(company_id,id,data) values($1,'SITE-A1','{"id":"SITE-A1","name":"Site A1"}'),($2,'SITE-B1','{"id":"SITE-B1","name":"Site B1"}')`, [f.A, f.B]);
  await q(`insert into assets(company_id,id,data) values($1,'AST-A1','{"id":"AST-A1","assetTag":"TA-A1","serialNumber":"SA1","name":"A1"}'),($2,'AST-B1','{"id":"AST-B1","assetTag":"TB-B1","serialNumber":"SB1","name":"B1"}')`, [f.A, f.B]);
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
