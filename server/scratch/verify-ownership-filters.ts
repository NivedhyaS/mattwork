import prisma from '../src/config/database';
import { ProjectService } from '../src/modules/projects/project.service';
import { Role } from '@prisma/client';

async function test() {
  console.log('--- STARTING VERIFICATION OF OWNERSHIP AND FILTERING RULES ---');
  const projectService = new ProjectService();

  // 1. Find an Admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN }
  });
  if (!adminUser) {
    console.error('No Admin user found in database!');
    return;
  }
  console.log(`Found Admin User: ${adminUser.email}`);

  // 2. Find two Editor users
  const editors = await prisma.editor.findMany({
    take: 2,
    include: { user: true }
  });
  if (editors.length < 2) {
    console.warn('Need at least 2 editors in the database to verify Editor boundaries. Please seed/register more.');
  }

  // 3. Find two Client users
  const clients = await prisma.client.findMany({
    take: 2,
    include: { user: true }
  });
  if (clients.length < 2) {
    console.warn('Need at least 2 clients in the database to verify Client boundaries. Please seed/register more.');
  }

  // 4. Find all projects
  const projects = await prisma.project.findMany({
    include: {
      client: { include: { user: true } },
      editor: { include: { user: true } }
    }
  });
  console.log(`Total projects in DB: ${projects.length}`);

  // Test 1: Query-level filtering on GET /api/v1/projects for Editors
  if (editors.length > 0) {
    const editor = editors[0];
    const editorRequester = {
      id: editor.user.id,
      email: editor.user.email,
      name: editor.user.name,
      role: Role.EDITOR
    };

    console.log(`\nTesting listProjects for Editor: ${editor.user.email} (DB editor ID: ${editor.id})`);
    const listResult = await projectService.listProjects({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }, editorRequester);
    const hasUnassignedOrOthers = listResult.data.some((p: any) => p.editorId !== editor.id);
    console.log(`- Filtered project count: ${listResult.data.length}`);
    console.log(`- Contained other editor's or unassigned projects? ${hasUnassignedOrOthers ? '❌ YES (Scoping failed)' : '✅ NO (Scoping succeeded)'}`);

    // Confirm field exclusions for Editors
    if (listResult.data.length > 0) {
      const p = listResult.data[0];
      const hasRestrictedFields = ('rawMaterialsFolder' in p) || ('clientPrice' in p) || ('budget' in p) || ('editorPrice' in p) || (p.client?.user && 'email' in p.client.user);
      console.log(`- Field exclusions in response: ${hasRestrictedFields ? '❌ FAILED (Fields leaked)' : '✅ PASSED (Excluded: rawMaterialsFolder, clientPrice, budget, editorPrice, client email)'}`);
    }
  }

  // Test 2: Query-level filtering on GET /api/v1/projects for Clients
  if (clients.length > 0) {
    const client = clients[0];
    const clientRequester = {
      id: client.user.id,
      email: client.user.email,
      name: client.user.name,
      role: Role.CLIENT
    };

    console.log(`\nTesting listProjects for Client: ${client.user.email} (DB client ID: ${client.id})`);
    const listResult = await projectService.listProjects({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }, clientRequester);
    const hasOthers = listResult.data.some((p: any) => p.clientId !== client.id);
    console.log(`- Filtered project count: ${listResult.data.length}`);
    console.log(`- Contained other client's projects? ${hasOthers ? '❌ YES (Scoping failed)' : '✅ NO (Scoping succeeded)'}`);

    // Confirm field exclusions for Clients
    if (listResult.data.length > 0) {
      const p = listResult.data[0];
      const hasRestrictedFields = ('rawMaterialsFolder' in p) || ('driveFolder' in p) || ('editorId' in p) || ('editor' in p) || ('editorPrice' in p) || ('comments' in p);
      console.log(`- Field exclusions in response: ${hasRestrictedFields ? '❌ FAILED (Fields leaked)' : '✅ PASSED (Excluded: rawMaterialsFolder, driveFolder, editor, editorPrice, comments)'}`);
      
      // Check files type filtering
      if (p.files && p.files.length > 0) {
        const leakedFiles = p.files.some((f: any) => !['VIDEO', 'IMAGE', 'DOCUMENT', 'ARCHIVE'].includes(f.fileType));
        console.log(`- Final deliverable files-only check: ${leakedFiles ? '❌ FAILED (Draft files leaked)' : '✅ PASSED'}`);
      }
    }
  }

  // Test 3: Detail Endpoint 403 Access Control Checks
  console.log('\nTesting direct ID access controls (403/404 ownership checks)...');
  // Find a project that has an editor assigned
  const projectWithEditor = projects.find(p => p.editorId !== null);
  if (projectWithEditor && editors.length >= 2) {
    // Find the editor that is NOT assigned to this project
    const assignedEditor = editors.find(e => e.id === projectWithEditor.editorId);
    const otherEditor = editors.find(e => e.id !== projectWithEditor.editorId);

    if (otherEditor && assignedEditor) {
      const assignedRequester = {
        id: assignedEditor.user.id,
        email: assignedEditor.user.email,
        name: assignedEditor.user.name,
        role: Role.EDITOR
      };
      const otherRequester = {
        id: otherEditor.user.id,
        email: otherEditor.user.email,
        name: otherEditor.user.name,
        role: Role.EDITOR
      };

      // Assigned Editor check
      try {
        await projectService.getProjectById(projectWithEditor.id, assignedRequester);
        console.log(`- Assigned Editor access: ✅ PASSED (Allowed access to own project ID ${projectWithEditor.id})`);
      } catch (err: any) {
        console.log(`- Assigned Editor access: ❌ FAILED (${err?.message})`);
      }

      // Other Editor check (Should fail with 403 Forbidden)
      try {
        await projectService.getProjectById(projectWithEditor.id, otherRequester);
        console.log(`- Unassigned Editor access to ID ${projectWithEditor.id}: ❌ FAILED (Leaked other editor's project)`);
      } catch (err: any) {
        const isForbidden = err?.statusCode === 403 || err?.statusCode === 404 || err?.message?.includes('Access denied') || err?.message?.includes('forbidden');
        console.log(`- Unassigned Editor access to ID ${projectWithEditor.id}: ${isForbidden ? '✅ PASSED (Access denied with 403/404)' : `❌ FAILED (Status: ${err?.statusCode || err?.message})`}`);
      }
    }
  } else {
    console.log('Skipping Editor 403 direct access check: need at least 2 editors and 1 assigned project.');
  }

  // Find a project that has a client
  const projectWithClient = projects.find(p => p.clientId !== null);
  if (projectWithClient && clients.length >= 2) {
    const assignedClient = clients.find(c => c.id === projectWithClient.clientId);
    const otherClient = clients.find(c => c.id !== projectWithClient.clientId);

    if (otherClient && assignedClient) {
      const assignedRequester = {
        id: assignedClient.user.id,
        email: assignedClient.user.email,
        name: assignedClient.user.name,
        role: Role.CLIENT
      };
      const otherRequester = {
        id: otherClient.user.id,
        email: otherClient.user.email,
        name: otherClient.user.name,
        role: Role.CLIENT
      };

      // Assigned Client check
      try {
        await projectService.getProjectById(projectWithClient.id, assignedRequester);
        console.log(`- Assigned Client access: ✅ PASSED (Allowed access to own project ID ${projectWithClient.id})`);
      } catch (err: any) {
        console.log(`- Assigned Client access: ❌ FAILED (${err?.message})`);
      }

      // Other Client check (Should fail with 403 Forbidden)
      try {
        await projectService.getProjectById(projectWithClient.id, otherRequester);
        console.log(`- Other Client access to ID ${projectWithClient.id}: ❌ FAILED (Leaked other client's project)`);
      } catch (err: any) {
        const isForbidden = err?.statusCode === 403 || err?.statusCode === 404 || err?.message?.includes('Access denied') || err?.message?.includes('forbidden');
        console.log(`- Other Client access to ID ${projectWithClient.id}: ${isForbidden ? '✅ PASSED (Access denied with 403/404)' : `❌ FAILED (Status: ${err?.statusCode || err?.message})`}`);
      }
    }
  } else {
    console.log('Skipping Client 403 direct access check: need at least 2 clients and 1 project.');
  }

  console.log('--- VERIFICATION COMPLETE ---');
}

test().catch(console.error).finally(() => prisma.$disconnect());
