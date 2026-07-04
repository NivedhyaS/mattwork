#!/usr/bin/env node
/**
 * Mattwork — Editor Earnings endpoint audit
 *
 * Verifies GET /api/v1/editors/:id/earnings:
 *   ADMIN  — any editorId → 200, prints response body for eye-check
 *   EDITOR — own editorId → 200, prints response body
 *   EDITOR — another editorId → 403
 *   CLIENT — any editorId → 403
 *
 * Checks divide-by-zero fallback case:
 *   Creates a new editor (zero completed projects), verifies response:
 *     ratePerProject: null, completedCount: 0, totalEarnings: 0
 *   Deletes the test editor afterward to clean up database.
 *
 * Usage:
 *   node scripts/audit-earnings.mjs
 */

const BASE_URL    = process.env.BASE_URL            || 'http://localhost:5000/api/v1';
const ADMIN_EMAIL  = process.env.TEST_ADMIN_EMAIL   || 'admin@mattwork.com';
const ADMIN_PASS   = process.env.TEST_ADMIN_PASSWORD || 'Admin@123456';
const EDITOR_EMAIL = process.env.TEST_EDITOR_EMAIL  || 'editor@mattwork.com';
const EDITOR_PASS  = process.env.TEST_EDITOR_PASSWORD || 'Editor@123456';
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL  || 'client@mattwork.com';
const CLIENT_PASS  = process.env.TEST_CLIENT_PASSWORD || 'Client@123456';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PASS_ICON = '\x1b[32m✓\x1b[0m';
const FAIL_ICON = '\x1b[31m✗\x1b[0m';
let failures = 0;

function assert(condition, label, details = '') {
  if (condition) {
    console.log(`  ${PASS_ICON} ${label}`);
  } else {
    console.error(`  ${FAIL_ICON} ${label}${details ? `\n      → ${details}` : ''}`);
    failures++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} — ${JSON.stringify(json).slice(0, 200)}`);
  const token = json.data?.tokens?.accessToken;
  if (!token) throw new Error(`No token for ${email}`);
  return token;
}

async function getEarnings(token, editorId) {
  const res = await fetch(`${BASE_URL}/editors/${editorId}/earnings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => res.text());
  return { status: res.status, body };
}

async function getMyEditorId(token) {
  const res = await fetch(`${BASE_URL}/editors/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Could not fetch /editors/me: ${res.status}`);
  return json.data?.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nMattwork — Editor Earnings Endpoint Audit');
  console.log(`API: ${BASE_URL}\n`);

  // ── Login ──────────────────────────────────────────────────────────────────
  const adminToken  = await login(ADMIN_EMAIL,  ADMIN_PASS);
  const editorToken = await login(EDITOR_EMAIL, EDITOR_PASS);
  const clientToken = await login(CLIENT_EMAIL, CLIENT_PASS);
  console.log('Logged in as Admin, Editor, Client');

  // Resolve the editor's own profile id
  const editorId = await getMyEditorId(editorToken);
  if (!editorId) throw new Error('Could not resolve editorId for test editor');
  console.log(`Editor profile id: ${editorId}\n`);

  // ── EDITOR — own earnings (full visibility) ─────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`EDITOR — GET /editors/${editorId}/earnings (own id)`);
  const editorOwnResult = await getEarnings(editorToken, editorId);
  assert(editorOwnResult.status === 200, `Editor gets 200 for own editorId`, `Got: ${editorOwnResult.status}`);

  if (editorOwnResult.status === 200) {
    const d = editorOwnResult.body?.data ?? editorOwnResult.body;
    console.log('\n  Response body (verify math by eye):');
    console.log('  ' + JSON.stringify(d, null, 4).replace(/\n/g, '\n  '));

    // Field presence checks
    assert('ratePerProject' in d, 'ratePerProject field present');
    assert('completedCount' in d, 'completedCount field present');
    assert('totalEarnings'  in d, 'totalEarnings field present');

    // Math validation (5 projects completed with 600 editorPrice each)
    assert(d.completedCount === 5, `completedCount should be 5, got ${d.completedCount}`);
    assert(d.totalEarnings === 3000, `totalEarnings should be 3000, got ${d.totalEarnings}`);
    assert(d.ratePerProject === 600, `ratePerProject should be 600, got ${d.ratePerProject}`);
  }

  // ── ADMIN — get any editor earnings ─────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ADMIN — GET /editors/${editorId}/earnings`);
  const adminResult = await getEarnings(adminToken, editorId);
  assert(adminResult.status === 200, `Admin gets 200 for any editorId`, `Got: ${adminResult.status}`);

  if (adminResult.status === 200) {
    const d = adminResult.body?.data ?? adminResult.body;
    assert(d.completedCount === 5, 'Admin sees same completedCount');
    assert(d.totalEarnings === 3000, 'Admin sees same totalEarnings');
  }

  // ── EDITOR — cross-editor 403 ───────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const fakeEditorId = 'exxxxxxxxxxxxxxxxxxxxxxxxxx';
  console.log(`EDITOR — GET /editors/${fakeEditorId}/earnings (another editor's id)`);
  const editorCrossResult = await getEarnings(editorToken, fakeEditorId);
  assert(
    editorCrossResult.status === 403,
    `Editor gets 403 when requesting another editor's earnings`,
    `Got: ${editorCrossResult.status}`
  );

  // ── CLIENT — always 403 ─────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`CLIENT — GET /editors/${editorId}/earnings`);
  const clientResult = await getEarnings(clientToken, editorId);
  assert(
    clientResult.status === 403,
    `Client gets 403 for editor earnings`,
    `Got: ${clientResult.status}`
  );

  // ── Zero Completed Projects Case ────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Testing Editor with ZERO completed projects (divide-by-zero check)...');
  
  // Create temporary editor via ADMIN
  const createRes = await fetch(`${BASE_URL}/editors`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Temp Editor',
      email: 'temp.editor@mattwork.com',
      password: 'Password@123',
      skills: ['animation']
    })
  });

  const createJson = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Failed to create temp editor: ${JSON.stringify(createJson)}`);
  }

  const tempEditorId = createJson.data?.editor?.id;
  assert(!!tempEditorId, `Temp editor created successfully (ID: ${tempEditorId})`);

  if (tempEditorId) {
    const zeroResult = await getEarnings(adminToken, tempEditorId);
    assert(zeroResult.status === 200, `Admin gets 200 for new temp editor`, `Got: ${zeroResult.status}`);
    
    if (zeroResult.status === 200) {
      const d = zeroResult.body?.data ?? zeroResult.body;
      console.log('\n  Zero projects response body:');
      console.log('  ' + JSON.stringify(d, null, 4).replace(/\n/g, '\n  '));

      assert(d.completedCount === 0, `completedCount is 0`);
      assert(d.totalEarnings === 0, `totalEarnings is 0`);
      assert(d.ratePerProject === null, `ratePerProject is null`);
    }

    // Clean up: delete temp editor via ADMIN
    const deleteRes = await fetch(`${BASE_URL}/editors/${tempEditorId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 204, `Temp editor cleaned up successfully (Deleted)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log('\x1b[32m\nAll editor earnings checks passed.\x1b[0m\n');
    process.exit(0);
  } else {
    console.error(`\x1b[31m\n${failures} check(s) FAILED.\x1b[0m\n`);
    process.exit(1);
  }
})().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(2);
});
