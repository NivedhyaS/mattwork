#!/usr/bin/env node
/**
 * Mattwork — Client Balance endpoint audit
 *
 * Verifies GET /api/v1/clients/:id/balance:
 *   ADMIN  — any clientId → 200, prints response body for eye-check
 *   CLIENT — own clientId → 200, prints response body
 *   CLIENT — another clientId → 403
 *   EDITOR — any clientId → 403
 *
 * Usage:
 *   node scripts/audit-balance.mjs
 *
 * Env overrides (same credentials as audit-project-serialization.mjs):
 *   TEST_ADMIN_PASSWORD=... TEST_EDITOR_PASSWORD=... TEST_CLIENT_PASSWORD=...
 *   node scripts/audit-balance.mjs
 *
 * PRD reference numbers to verify by eye:
 *   Advance Paid       $50,000
 *   Completed Work     $ 5,000
 *   Remaining Credit   $45,000
 *   Equivalent Videos      45   (@ $1,000 avg, or as seeded)
 */

const BASE_URL    = process.env.BASE_URL            || 'http://localhost:5000/api/v1';
const ADMIN_EMAIL  = process.env.TEST_ADMIN_EMAIL   || 'admin@mattwork.com';
const ADMIN_PASS   = process.env.TEST_ADMIN_PASSWORD || 'Admin@123456';
const EDITOR_EMAIL = process.env.TEST_EDITOR_EMAIL  || 'editor@mattwork.com';
const EDITOR_PASS  = process.env.TEST_EDITOR_PASSWORD || 'Editor@123456';
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL  || 'client@mattwork.com';
const CLIENT_PASS  = process.env.TEST_CLIENT_PASSWORD || 'Client@123456';

// Second client for cross-client 403 test (created by seed-balance.mjs if run)
const CLIENT2_EMAIL = process.env.TEST_CLIENT2_EMAIL  || 'client2@mattwork.com';
const CLIENT2_PASS  = process.env.TEST_CLIENT2_PASSWORD || 'Client2@123456';

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

async function getBalance(token, clientId) {
  const res = await fetch(`${BASE_URL}/clients/${clientId}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => res.text());
  return { status: res.status, body };
}

async function getMyClientId(token) {
  const res = await fetch(`${BASE_URL}/clients/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Could not fetch /clients/me: ${res.status}`);
  return json.data?.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nMattwork — Client Balance Endpoint Audit');
  console.log(`API: ${BASE_URL}\n`);

  // ── Login ──────────────────────────────────────────────────────────────────
  const adminToken  = await login(ADMIN_EMAIL,  ADMIN_PASS);
  const editorToken = await login(EDITOR_EMAIL, EDITOR_PASS);
  const clientToken = await login(CLIENT_EMAIL, CLIENT_PASS);
  console.log('Logged in as Admin, Editor, Client');

  // Resolve the client's own profile id
  const clientId = await getMyClientId(clientToken);
  if (!clientId) throw new Error('Could not resolve clientId for test client');
  console.log(`Client profile id: ${clientId}\n`);

  // ── ADMIN — own client balance (full visibility) ────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`ADMIN — GET /clients/${clientId}/balance`);
  const adminResult = await getBalance(adminToken, clientId);
  assert(adminResult.status === 200, `Admin gets 200 for any clientId`, `Got: ${adminResult.status}`);

  if (adminResult.status === 200) {
    const d = adminResult.body?.data ?? adminResult.body;
    console.log('\n  Response body (verify math by eye):');
    console.log('  ' + JSON.stringify(d, null, 4).replace(/\n/g, '\n  '));

    // Field presence checks
    assert('advancePaid'             in d, 'advancePaid field present');
    assert('completedWorkValue'       in d, 'completedWorkValue field present');
    assert('remainingCredit'          in d, 'remainingCredit field present');
    assert('equivalentRemainingVideos' in d, 'equivalentRemainingVideos field present');

    // Math sanity check
    const mathOk = Math.abs(
      (d.advancePaid - d.completedWorkValue) - d.remainingCredit
    ) < 0.01;
    assert(mathOk, `remainingCredit = advancePaid(${d.advancePaid}) - completedWorkValue(${d.completedWorkValue}) = ${d.remainingCredit}`);
  }

  // ── CLIENT — own balance ────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`CLIENT — GET /clients/${clientId}/balance (own id)`);
  const clientOwnResult = await getBalance(clientToken, clientId);
  assert(clientOwnResult.status === 200, `Client gets 200 for own clientId`, `Got: ${clientOwnResult.status}`);

  if (clientOwnResult.status === 200) {
    const d = clientOwnResult.body?.data ?? clientOwnResult.body;
    console.log('\n  Response body (verify math by eye):');
    console.log('  ' + JSON.stringify(d, null, 4).replace(/\n/g, '\n  '));
    const mathOk = Math.abs(
      (d.advancePaid - d.completedWorkValue) - d.remainingCredit
    ) < 0.01;
    assert(mathOk, `Math check: ${d.advancePaid} - ${d.completedWorkValue} = ${d.remainingCredit}`);
  }

  // ── CLIENT — cross-client 403 ─────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // Try to fetch balance using a fake/other clientId
  const fakeClientId = 'cxxxxxxxxxxxxxxxxxxxxxxxxxx'; // guaranteed not to be our client's id
  console.log(`CLIENT — GET /clients/${fakeClientId}/balance (another client's id)`);
  const clientCrossResult = await getBalance(clientToken, fakeClientId);
  assert(
    clientCrossResult.status === 403,
    `Client gets 403 when requesting another client's balance`,
    `Got: ${clientCrossResult.status} — ${JSON.stringify(clientCrossResult.body).slice(0, 150)}`
  );

  // Also try with second client account if available
  let client2Token = null;
  try {
    client2Token = await login(CLIENT2_EMAIL, CLIENT2_PASS);
    const client2Id = await getMyClientId(client2Token);
    if (client2Id && client2Id !== clientId) {
      console.log(`\nCLIENT — GET /clients/${client2Id}/balance (real second client id, cross-client)`);
      const cross2 = await getBalance(clientToken, client2Id);
      assert(
        cross2.status === 403,
        `Client 1 gets 403 requesting Client 2's balance`,
        `Got: ${cross2.status}`
      );
    }
  } catch {
    console.log('  (Second client account not found — skipping cross-client test with real id)');
  }

  // ── EDITOR — always 403 ───────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`EDITOR — GET /clients/${clientId}/balance`);
  const editorResult = await getBalance(editorToken, clientId);
  assert(
    editorResult.status === 403,
    `Editor gets 403 for any clientId`,
    `Got: ${editorResult.status} — ${JSON.stringify(editorResult.body).slice(0, 150)}`
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log('\x1b[32m\nAll balance checks passed.\x1b[0m\n');
    process.exit(0);
  } else {
    console.error(`\x1b[31m\n${failures} check(s) FAILED.\x1b[0m\n`);
    process.exit(1);
  }
})().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(2);
});
