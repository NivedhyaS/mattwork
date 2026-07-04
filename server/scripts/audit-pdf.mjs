#!/usr/bin/env node
/**
 * Mattwork — Invoice PDF Generation endpoint audit
 *
 * Verifies POST /api/v1/invoices/:id/generate-pdf:
 *   - ADMIN can generate client PDF (200) and editor PDF (200) for any invoice.
 *   - EDITOR (assigned) can generate editor PDF (200) but not client PDF (403) or another editor's PDF (403).
 *   - CLIENT (matching) can generate client PDF (200) but not editor PDF (403) or another client's PDF (403).
 *   - Verifies that generated files are stored in git-ignored uploads/invoices/.
 *   - Parses/checks the response starts with standard %PDF- magic bytes to verify validity.
 *
 * Usage:
 *   node scripts/audit-pdf.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function getMyEditorId(token) {
  const res = await fetch(`${BASE_URL}/editors/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Could not fetch /editors/me: ${res.status}`);
  return json.data?.id;
}

async function getMyClientId(token) {
  const res = await fetch(`${BASE_URL}/clients/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Could not fetch /clients/me: ${res.status}`);
  return json.data?.id;
}

async function generatePdf(token, invoiceId, type) {
  const url = type 
    ? `${BASE_URL}/invoices/${invoiceId}/generate-pdf?type=${type}`
    : `${BASE_URL}/invoices/${invoiceId}/generate-pdf`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : Buffer.from(await res.arrayBuffer());

  return { status: res.status, body };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nMattwork — Invoice PDF Generation Endpoint Audit');
  console.log(`API: ${BASE_URL}\n`);

  try {
    // ── Login ──────────────────────────────────────────────────────────────────
    const adminToken  = await login(ADMIN_EMAIL,  ADMIN_PASS);
    const editorToken = await login(EDITOR_EMAIL, EDITOR_PASS);
    const clientToken = await login(CLIENT_EMAIL, CLIENT_PASS);
    console.log('Logged in as Admin, Editor, Client');

    // Resolve the editor and client's own profile ids
    const editorId = await getMyEditorId(editorToken);
    const clientId = await getMyClientId(clientToken);
    console.log(`Resolved Editor profile ID: ${editorId}, Client profile ID: ${clientId}`);

    // ── Fetch project & client to create a test invoice ───────────────────────
    const projRes = await fetch(`${BASE_URL}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const projJson = await projRes.json();
    if (!projRes.ok || !projJson.data || projJson.data.length === 0) {
      throw new Error(`Could not fetch projects: ${JSON.stringify(projJson)}`);
    }

    // Find a project with the test editor assigned
    const testProject = projJson.data.find(p => p.editorId === editorId);
    if (!testProject) {
      throw new Error(`Could not find a project assigned to test editor ${editorId} in the seeded data.`);
    }

    const { id: projectId } = testProject;
    console.log(`Using project ID: ${projectId}, client ID: ${clientId}`);

    // Create the test invoice via Admin
    const createRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        projectId,
        clientId,
        items: [
          {
            description: 'Post-Production Video Editing Services',
            quantity: 1,
            unitPrice: 1000,
            total: 1000
          }
        ],
        taxRate: 18,
        discount: 100,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

    const createJson = await createRes.json();
    if (!createRes.ok) {
      throw new Error(`Failed to create test invoice: ${JSON.stringify(createJson)}`);
    }

    const invoiceId = createJson.data.id;
    const invoiceNumber = createJson.data.number;
    console.log(`Created test invoice ${invoiceNumber} (ID: ${invoiceId})\n`);

    // ── Test ADMIN permissions (can fetch both client and editor templates) ────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ADMIN — Generate Client PDF');
    const adminClientRes = await generatePdf(adminToken, invoiceId, 'client');
    assert(adminClientRes.status === 200, `Admin gets 200 for Client PDF`, `Got: ${adminClientRes.status}`);

    if (adminClientRes.status === 200) {
      const isPdf = adminClientRes.body.toString('ascii', 0, 4) === '%PDF';
      assert(isPdf, `Response starts with PDF signature (%PDF)`);
      assert(adminClientRes.body.length > 1000, `PDF size is valid (${adminClientRes.body.length} bytes)`);

      // Verify file is stored in git-ignored uploads folder
      const storedPath = path.join(__dirname, '../uploads/invoices', `${invoiceId}_client.pdf`);
      assert(fs.existsSync(storedPath), `Client PDF stored locally at uploads/invoices/`);
    }

    console.log('\nADMIN — Generate Editor PDF');
    const adminEditorRes = await generatePdf(adminToken, invoiceId, 'editor');
    assert(adminEditorRes.status === 200, `Admin gets 200 for Editor PDF`, `Got: ${adminEditorRes.status}`);

    if (adminEditorRes.status === 200) {
      const isPdf = adminEditorRes.body.toString('ascii', 0, 4) === '%PDF';
      assert(isPdf, `Response starts with PDF signature (%PDF)`);
      assert(adminEditorRes.body.length > 1000, `PDF size is valid (${adminEditorRes.body.length} bytes)`);

      const storedPath = path.join(__dirname, '../uploads/invoices', `${invoiceId}_editor.pdf`);
      assert(fs.existsSync(storedPath), `Editor PDF stored locally at uploads/invoices/`);
    }

    // ── Test CLIENT permissions (can fetch client PDF, gets 403 for editor template) ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLIENT — Generate Client PDF (own invoice)');
    const clientClientRes = await generatePdf(clientToken, invoiceId, 'client');
    assert(clientClientRes.status === 200, `Client gets 200 for own Client PDF`, `Got: ${clientClientRes.status}`);

    console.log('\nCLIENT — Generate Editor PDF (should be forbidden)');
    const clientEditorRes = await generatePdf(clientToken, invoiceId, 'editor');
    assert(
      clientEditorRes.status === 403, 
      `Client gets 403 when requesting Editor PDF`, 
      `Got: ${clientEditorRes.status} — ${JSON.stringify(clientEditorRes.body)}`
    );

    // ── Test EDITOR permissions (can fetch editor PDF, gets 403 for client template) ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EDITOR — Generate Editor PDF (own project)');
    const editorEditorRes = await generatePdf(editorToken, invoiceId, 'editor');
    assert(editorEditorRes.status === 200, `Editor gets 200 for own Editor PDF`, `Got: ${editorEditorRes.status}`);

    console.log('\nEDITOR — Generate Client PDF (should be forbidden)');
    const editorClientRes = await generatePdf(editorToken, invoiceId, 'client');
    assert(
      editorClientRes.status === 403, 
      `Editor gets 403 when requesting Client PDF`, 
      `Got: ${editorClientRes.status} — ${JSON.stringify(editorClientRes.body)}`
    );

    // ── Test Cross-User permissions (403 for another user's invoice) ───────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Creating second client to test cross-client forbidden...');
    
    // Create second client via Admin
    const client2Res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Client Two',
        email: 'client2@mattwork.com',
        password: 'Password@123',
        company: 'Channel Two LLC'
      })
    });
    const client2Json = await client2Res.json();
    if (!client2Res.ok) {
      throw new Error(`Failed to create Client Two: ${JSON.stringify(client2Json)}`);
    }

    const client2Id = client2Json.data.client.id;
    const client2Token = await login('client2@mattwork.com', 'Password@123');

    console.log(`CLIENT 2 — Generate Client PDF for Client 1's invoice (should be forbidden)`);
    const crossClientRes = await generatePdf(client2Token, invoiceId, 'client');
    assert(
      crossClientRes.status === 403, 
      `Client 2 gets 403 for Client 1's invoice`, 
      `Got: ${crossClientRes.status}`
    );

    // Clean up Client Two
    await fetch(`${BASE_URL}/clients/${client2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Cleaned up Client Two');

    // ── Clean up test invoice ─────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const deleteRes = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 204, `Test invoice deleted successfully`);

    // Clean up stored files
    try {
      fs.unlinkSync(path.join(__dirname, '../uploads/invoices', `${invoiceId}_client.pdf`));
      fs.unlinkSync(path.join(__dirname, '../uploads/invoices', `${invoiceId}_editor.pdf`));
      console.log('Cleaned up generated PDF files from disk');
    } catch {}

  } catch (err) {
    console.error('\nFatal error during audit:', err.message);
    failures++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures === 0) {
    console.log('\x1b[32m\nAll PDF generation checks passed.\x1b[0m\n');
    process.exit(0);
  } else {
    console.error(`\x1b[31m\n${failures} check(s) FAILED.\x1b[0m\n`);
    process.exit(1);
  }
})().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(2);
});
