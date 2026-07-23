import { googleDriveService } from '../src/services/googleDrive';
import { env } from '../src/config/env';

async function verifyHierarchy() {
  console.log('--- STARTING GOOGLE DRIVE HIERARCHY PATH CHECK ---');

  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive is not enabled or credentials are missing!');
    return;
  }

  // The day folder ID from our previous successful run
  const dayFolderId = '1O7DPhC-NjJbw7Af3Pn-0lOA2l5UGl9_F';
  const rootId = env.GOOGLE_DRIVE_FOLDER_ID!;

  console.log(`Checking hierarchy from Day Folder ID: ${dayFolderId}`);
  console.log(`Configured Root Folder ID: ${rootId}`);

  let currentId = dayFolderId;
  const pathParts: string[] = [];

  while (currentId && currentId !== rootId) {
    const res = await driveClient.files.get({
      fileId: currentId,
      fields: 'id, name, parents',
    });

    const { name, parents } = res.data;
    pathParts.unshift(`${name} (id: ${currentId})`);
    
    currentId = parents?.[0] || '';
  }

  // Also append Root folder name
  if (currentId === rootId) {
    const res = await driveClient.files.get({
      fileId: rootId,
      fields: 'id, name',
    });
    pathParts.unshift(`${res.data.name} (id: ${rootId})`);
  }

  console.log('\nFull Ancestor Path Chain:');
  console.log(pathParts.join(' → '));
  console.log('\n--- HIERARCHY CHECK COMPLETE ---');
}

verifyHierarchy().catch(console.error);
