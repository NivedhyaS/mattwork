#!/usr/bin/env node
/**
 * Mattwork — Role-based field serialization audit
 *
 * Tests both GET /api/v1/projects (list) and GET /api/v1/projects/:id (detail)
 * for EDITOR and CLIENT roles, asserting that forbidden fields are completely
 * absent from the JSON payload (not null, not undefined — just not there).
 *
 * Usage:
 *   node scripts/audit-project-serialization.mjs
 *
 * Requires:
 *   - Backend running on http://localhost:5000
 *   - At least one project in the database with an assigned editor
 *   - TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   - TEST_EDITOR_EMAIL / TEST_EDITOR_PASSWORD
 *   - TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD
 *
 * Override via env:
 *   BASE_URL=http://localhost:5000/api/v1 \
 *   TEST_ADMIN_EMAIL=admin@example.com \
 *   TEST_ADMIN_PASSWORD=password123 \
 *   ...
 *   node scripts/audit-project-serialization.mjs
 */

const BASE_URL   = process.env.BASE_URL          || 'http://localhost:5000/api/v1';
const ADMIN_EMAIL  = process.env.TEST_ADMIN_EMAIL  || 'admin@mattwork.com';
const ADMIN_PASS   = process.env.TEST_ADMIN_PASSWORD || 'Admin@123456';
const EDITOR_EMAIL = process.env.TEST_EDITOR_EMAIL || 'editor@mattwork.com';
const EDITOR_PASS  = process.env.TEST_EDITOR_PASSWORD || 'Editor@123456';
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || 'client@mattwork.com';
const CLIENT_PASS  = process.env.TEST_CLIENT_PASSWORD || 'Client@123456';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} — ${body}`);
  }
  const json = await res.json();
  // Response shape: { success: true, data: { user: {...}, tokens: { accessToken, refreshToken } } }
  const token = json.data?.tokens?.accessToken;
  if (!token) throw new Error(`No accessToken in login response for ${email}: ${JSON.stringify(json).slice(0, 200)}`);
  return token;
}

async function get(token, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} — ${body}`);
  }
  return res.json();
}

// ─── Field audit helpers ───────────────────────────────────────────────────────

/** Recursively collect all keys present in an object (including nested). */
function allKeys(obj, prefix = '') {
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.keys(obj).flatMap((k) => {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    return [fullKey, ...allKeys(obj[k], fullKey)];
  });
}

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

let failures = 0;

function assert(condition, label, details = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.error(`  ${FAIL} ${label}${details ? `\n      → ${details}` : ''}`);
    failures++;
  }
}

function assertAbsent(keys, field, label) {
  const found = keys.filter((k) => k === field || k.endsWith(`.${field}`));
  assert(found.length === 0, label, found.length ? `Found at: ${found.join(', ')}` : '');
}

function assertPresent(keys, field, label) {
  const found = keys.filter((k) => k === field || k.endsWith(`.${field}`));
  assert(found.length > 0, label);
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function auditProject(label, project) {
  const keys = allKeys(project);
  console.log(`\n  Keys in payload: ${keys.slice(0, 40).join(', ')}${keys.length > 40 ? ', …' : ''}`);
  return keys;
}

async function runEditorAudit(token, projectId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EDITOR — list endpoint  GET /projects');
  const listBody = await get(token, '/projects');
  const listItems = listBody.data || [];
  let targetProjectId = projectId;
  if (listItems.length === 0) {
    console.warn('  ⚠  No projects in list response — skipping list checks for EDITOR');
  } else {
    const item = listItems[0];
    targetProjectId = item.id;
    const listKeys = await auditProject('EDITOR list[0]', item);
    assertAbsent(listKeys, 'clientPrice', 'clientPrice absent from list item');
    assertAbsent(listKeys, 'editorPrice', 'editorPrice absent from list item');
    assertAbsent(listKeys, 'profit',      'profit absent from list item');
    // Check specifically that client.user.email is gone (editor's own email is fine)
    const hasClientEmail = listKeys.includes('client.user.email');
    assert(!hasClientEmail, 'client.user.email absent from list item');
  }

  if (!targetProjectId) {
    console.warn('  ⚠  No targetProjectId available — skipping detail checks for EDITOR');
    return;
  }

  console.log(`\nEDITOR — detail endpoint  GET /projects/${targetProjectId}`);
  const detail = await get(token, `/projects/${targetProjectId}`);
  const detailKeys = await auditProject('EDITOR detail', detail.data || detail);
  assertAbsent(detailKeys, 'clientPrice', 'clientPrice absent from detail');
  assertAbsent(detailKeys, 'editorPrice', 'editorPrice absent from detail');
  assertAbsent(detailKeys, 'profit',      'profit absent from detail');
  const hasClientEmailDetail = detailKeys.includes('client.user.email');
  assert(!hasClientEmailDetail, 'client.user.email absent from detail');
}

async function runClientAudit(token, projectId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CLIENT — list endpoint  GET /projects');
  const listBody = await get(token, '/projects');
  const listItems = listBody.data || [];
  let targetProjectId = projectId;
  if (listItems.length === 0) {
    console.warn('  ⚠  No projects in list response — skipping list checks for CLIENT');
  } else {
    const item = listItems[0];
    targetProjectId = item.id;
    const listKeys = await auditProject('CLIENT list[0]', item);
    assertAbsent(listKeys, 'editorPrice', 'editorPrice absent from list item');
    assertAbsent(listKeys, 'profit',      'profit absent from list item');
    assertAbsent(listKeys, 'editorId',    'editorId absent from list item');
    // editor object itself should be absent
    const hasEditorObj = Object.prototype.hasOwnProperty.call(item, 'editor');
    assert(!hasEditorObj, 'editor sub-object absent from list item');
    // clientPrice SHOULD be present for clients
    assertPresent(listKeys, 'clientPrice', 'clientPrice present in list item');
  }

  if (!targetProjectId) {
    console.warn('  ⚠  No targetProjectId available — skipping detail checks for CLIENT');
    return;
  }

  console.log(`\nCLIENT — detail endpoint  GET /projects/${targetProjectId}`);
  const detail = await get(token, `/projects/${targetProjectId}`);
  const proj = detail.data || detail;
  const detailKeys = await auditProject('CLIENT detail', proj);
  assertAbsent(detailKeys, 'editorPrice', 'editorPrice absent from detail');
  assertAbsent(detailKeys, 'profit',      'profit absent from detail');
  assertAbsent(detailKeys, 'editorId',    'editorId absent from detail');
  const hasEditorObj = Object.prototype.hasOwnProperty.call(proj, 'editor');
  assert(!hasEditorObj, 'editor sub-object absent from detail');
  assertPresent(detailKeys, 'clientPrice', 'clientPrice present in detail');
}

async function runAdminAudit(token) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN — list endpoint  GET /projects');
  const listBody = await get(token, '/projects');
  const listItems = listBody.data || [];
  if (listItems.length === 0) {
    console.warn('  ⚠  No projects in list — nothing to audit for ADMIN');
    return null;
  }
  const item = listItems[0];
  const listKeys = await auditProject('ADMIN list[0]', item);
  assertPresent(listKeys, 'clientPrice', 'clientPrice present in list item');
  assertPresent(listKeys, 'editorPrice', 'editorPrice present in list item');
  assertPresent(listKeys, 'profit',      'profit present in list item');
  console.log(`\n  First project id: ${item.id}`);
  return item.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`\nMattwork Role Serialization Audit`);
    console.log(`API: ${BASE_URL}`);

    // Admin login — used to discover a valid projectId
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASS);
    console.log('\nLogged in as ADMIN');

    const firstProjectId = await runAdminAudit(adminToken);

    // Editor audit
    const editorToken = await login(EDITOR_EMAIL, EDITOR_PASS);
    console.log('\nLogged in as EDITOR');
    await runEditorAudit(editorToken, firstProjectId);

    // Client audit
    const clientToken = await login(CLIENT_EMAIL, CLIENT_PASS);
    console.log('\nLogged in as CLIENT');
    await runClientAudit(clientToken, firstProjectId);

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (failures === 0) {
      console.log(`\x1b[32m\nAll checks passed — no field leaks detected.\x1b[0m\n`);
      process.exit(0);
    } else {
      console.error(`\x1b[31m\n${failures} check(s) FAILED — field leaks detected.\x1b[0m\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('\nFatal error:', err.message);
    process.exit(2);
  }
})();
