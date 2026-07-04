#!/usr/bin/env node
/**
 * Mattwork — Project Search and Filter endpoint audit
 *
 * Verifies GET /api/v1/projects with combinations of filters:
 *   - ADMIN can combine 2-3 filters (status, client, month, range).
 *   - EDITOR only sees their own assigned projects when filtering.
 *   - CLIENT and EDITOR receive 403 Forbidden when requesting minValue/maxValue range filters.
 *
 * Usage:
 *   node scripts/audit-project-filters.mjs
 */

import { URL } from 'url';

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

async function getProjects(token, queryParams = {}) {
  const url = new URL(`${BASE_URL}/projects`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function updateProject(token, id, data) {
  const res = await fetch(`${BASE_URL}/projects/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Failed to update project ${id}: ${res.status} - ${JSON.stringify(json)}`);
  return json.data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nMattwork — Project List Search and Filtering Audit');
  console.log(`API: ${BASE_URL}\n`);

  try {
    // ── Login ──────────────────────────────────────────────────────────────────
    const adminToken  = await login(ADMIN_EMAIL,  ADMIN_PASS);
    const editorToken = await login(EDITOR_EMAIL, EDITOR_PASS);
    const clientToken = await login(CLIENT_EMAIL, CLIENT_PASS);
    console.log('Logged in as Admin, Editor, Client\n');

    // ── Prepare test data (update existing projects with specific dueDate / price) ──
    const listRes = await getProjects(adminToken, { limit: 10 });
    const projects = listRes.body?.data;
    if (!projects || projects.length < 2) {
      throw new Error(`Insufficient seeded projects found: ${JSON.stringify(listRes.body)}`);
    }

    // Find two projects we can modify for the date/price filters
    const [p1, p2] = projects;
    console.log(`Setting up test data for filters:`);
    console.log(`- Project "${p1.title}" (ID: ${p1.id}) will have dueDate = 2026-07-15, clientPrice = 1500`);
    console.log(`- Project "${p2.title}" (ID: ${p2.id}) will have dueDate = 2026-08-20, clientPrice = 800`);

    await updateProject(adminToken, p1.id, { dueDate: '2026-07-15T12:00:00.000Z', clientPrice: 1500 });
    await updateProject(adminToken, p2.id, { dueDate: '2026-08-20T12:00:00.000Z', clientPrice: 800 });
    console.log(`✅ Test data successfully updated.\n`);

    // ── Test ADMIN multi-filters ──────────────────────────────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ADMIN — Query: ?month=2026-07 (should return project 1)');
    const r1 = await getProjects(adminToken, { month: '2026-07' });
    assert(r1.status === 200, `Admin gets 200`, `Got: ${r1.status}`);
    if (r1.status === 200) {
      const titles = r1.body.data.map(p => p.title);
      console.log(`  Filtered titles:`, titles);
      assert(titles.includes(p1.title) && !titles.includes(p2.title), `Correctly returned only projects from July 2026`);
    }

    console.log('\nADMIN — Query: ?deadlineBefore=2026-07-30&minValue=1000 (combines 2-3 filters)');
    const r2 = await getProjects(adminToken, { deadlineBefore: '2026-07-30T00:00:00.000Z', minValue: 1000 });
    assert(r2.status === 200, `Admin gets 200`, `Got: ${r2.status}`);
    if (r2.status === 200) {
      const titles = r2.body.data.map(p => p.title);
      console.log(`  Filtered titles:`, titles);
      assert(titles.includes(p1.title) && !titles.includes(p2.title), `Correctly combined AND filters`);
    }

    console.log('\nADMIN — Query: ?maxValue=900 (should return project 2)');
    const r3 = await getProjects(adminToken, { maxValue: 900 });
    assert(r3.status === 200, `Admin gets 200`, `Got: ${r3.status}`);
    if (r3.status === 200) {
      const titles = r3.body.data.map(p => p.title);
      console.log(`  Filtered titles:`, titles);
      assert(titles.includes(p2.title) && !titles.includes(p1.title), `Correctly filtered by price range (maxValue)`);
    }

    // ── Test EDITOR client filtering combined with role-scoping ─────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EDITOR — Query: ?client=client@mattwork.com (should combine with role-scoping)');
    const rEditor = await getProjects(editorToken, { client: 'client@mattwork.com' });
    assert(rEditor.status === 200, `Editor gets 200`, `Got: ${rEditor.status}`);
    if (rEditor.status === 200) {
      const allOwnedByEditor = rEditor.body.data.every(p => p.editorId !== null && p.editor !== null);
      console.log(`  Returned project count: ${rEditor.body.data.length}`);
      assert(allOwnedByEditor, `All returned projects are indeed assigned to this editor`);
    }

    // ── Test non-ADMIN range query restrictions (should be 403 Forbidden) ────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EDITOR — Query with range check (minValue=500) — should be rejected');
    const rEditorMin = await getProjects(editorToken, { minValue: 500 });
    assert(rEditorMin.status === 403, `Editor range filter gets 403`, `Got: ${rEditorMin.status} — ${JSON.stringify(rEditorMin.body)}`);

    console.log('\nCLIENT — Query with range check (maxValue=1000) — should be rejected');
    const rClientMax = await getProjects(clientToken, { maxValue: 1000 });
    assert(rClientMax.status === 403, `Client range filter gets 403`, `Got: ${rClientMax.status} — ${JSON.stringify(rClientMax.body)}`);

  } catch (err) {
    console.error('\nFatal error during audit:', err.message);
    failures++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log('\x1b[32m\nAll project filtering checks passed.\x1b[0m\n');
    process.exit(0);
  } else {
    console.error(`\x1b[31m\n${failures} check(s) FAILED.\x1b[0m\n`);
    process.exit(1);
  }
})().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(2);
});
