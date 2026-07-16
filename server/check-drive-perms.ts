import { google } from 'googleapis';
import prisma from './src/config/database';

async function main() {
  // 1. Load credentials from env
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const driveEnabled = process.env.GOOGLE_DRIVE_ENABLED;

  console.log('=== Google Drive Credential Check ===');
  console.log(`GOOGLE_DRIVE_ENABLED : ${driveEnabled}`);
  console.log(`GOOGLE_CLIENT_EMAIL  : ${clientEmail}`);
  console.log(`GOOGLE_PRIVATE_KEY   : ${privateKey ? 'PRESENT (' + privateKey.split('\n').length + ' lines)' : 'MISSING'}`);

  if (!clientEmail || !privateKey) {
    console.log('RESULT: Credentials MISSING — Drive verification impossible.');
    return;
  }

  // 2. Authenticate
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // 3. Fetch the project's driveFolder URL from DB
  const project = await prisma.project.findUnique({
    where: { id: 'cmrmeth3j0000owhw8cyjfepb' },
    select: { title: true, driveFolder: true, editor: { select: { user: { select: { name: true, email: true } } } } },
  });

  console.log(`\nProject: ${project?.title}`);
  console.log(`driveFolder: ${project?.driveFolder}`);
  console.log(`Current editor: ${project?.editor?.user?.name} <${project?.editor?.user?.email}>`);

  if (!project?.driveFolder) {
    console.log('RESULT: No driveFolder set on project — Drive access control not applicable.');
    return;
  }

  // 4. Extract folder ID from URL
  const folderIdMatch = project.driveFolder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const folderId = folderIdMatch ? folderIdMatch[1] : project.driveFolder;
  console.log(`Extracted folder ID: ${folderId}`);

  // 5. List permissions on the folder
  try {
    const permR = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id,emailAddress,role,type,displayName)',
    });

    const perms = permR.data.permissions || [];
    console.log(`\n=== Permissions on folder (${perms.length} entries) ===`);
    perms.forEach(p => {
      console.log(`  [${p.type}] ${p.emailAddress || p.displayName || 'unknown'} — role: ${p.role}`);
    });

    // 6. Check specifically for editor email presence
    const editorEmail = project.editor?.user?.email;
    if (editorEmail) {
      const editorPerm = perms.find(p => p.emailAddress === editorEmail);
      if (editorPerm) {
        console.log(`\nCurrent editor (${editorEmail}) HAS access — role: ${editorPerm.role}`);
        console.log('DRIVE_ACCESS_CONTROL: VERIFIED — editor has permission on folder');
      } else {
        console.log(`\nCurrent editor (${editorEmail}) NOT found in permissions list.`);
        console.log('This may indicate drive sharing was not triggered (no driveFolder was set, or API call failed silently).');
      }
    }
  } catch (err: any) {
    console.log(`\nDrive API ERROR: ${err.message}`);
    console.log(`Code: ${err.code}`);
    if (err.code === 404) {
      console.log('Folder not found — the driveFolder URL may point to a non-existent or inaccessible folder.');
    } else if (err.code === 403) {
      console.log('Permission denied — service account may not have access to this folder.');
    }
    console.log('RESULT: Drive verification could not complete due to API error.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
