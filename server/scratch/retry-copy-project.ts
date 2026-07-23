import { googleDriveService } from '../src/services/googleDrive';

async function retryCopy() {
  console.log('--- EXECUTING COPY FOLDER RECURSIVELY MANUALLY ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client is not enabled or credentials are missing.');
    return;
  }

  const sourceFolderId = '1VqVlU_P6U4IoQQ96-lkSQ-5bdhrc4I-W';
  const destFolderId = '1dhlkJMPaDu07hUwVvtxzFdTR2_7RW3W8';

  console.log(`Source Folder: ${sourceFolderId}`);
  console.log(`Destination Folder: ${destFolderId}`);

  try {
    console.log('Starting synchronous copy operation...');
    await googleDriveService.copyFolderRecursively(driveClient, sourceFolderId, destFolderId);
    console.log('✅ SUCCESS: Copy completed successfully!');
  } catch (err: any) {
    console.error('❌ FAILED: Copy threw an error:', err);
  }
}

retryCopy().catch(console.error);
