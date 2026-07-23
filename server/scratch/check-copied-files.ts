import { googleDriveService } from '../src/services/googleDrive';

async function checkCopiedFiles() {
  console.log('--- INSPECTING CREATED PROJECT FOLDER CONTENTS ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client is not enabled or credentials are missing.');
    return;
  }

  const projectFolderId = '1dhlkJMPaDu07hUwVvtxzFdTR2_7RW3W8';
  console.log(`Checking destination folder ID: ${projectFolderId}`);

  try {
    // 1. Get destination folder info
    const folderRes = await driveClient.files.get({
      fileId: projectFolderId,
      fields: 'id, name, mimeType',
    });
    console.log(`- Project Folder name: "${folderRes.data.name}"`);

    // 2. List all files and subfolders in this destination folder
    const listRes = await driveClient.files.list({
      q: `'${projectFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, parents)',
      spaces: 'drive',
    });
    
    const items = listRes.data.files || [];
    console.log(`\nFound ${items.length} items inside "${folderRes.data.name}":`);
    for (const item of items) {
      console.log(`- Item Name: "${item.name}"`);
      console.log(`  Mime Type: ${item.mimeType}`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Parent IDs: ${JSON.stringify(item.parents)}`);
    }
  } catch (err: any) {
    console.error('API Error checking files:', err?.message || err);
  }
}

checkCopiedFiles().catch(console.error);
