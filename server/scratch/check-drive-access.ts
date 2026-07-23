import { googleDriveService } from '../src/services/googleDrive';

async function checkDriveAccess() {
  console.log('--- TESTING ACCESS TO SOURCE DRIVE FOLDER ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client is not enabled or credentials are missing.');
    return;
  }

  const sourceFolderId = '1VqVlU_P6U4IoQQ96-lkSQ-5bdhrc4I-W';
  console.log(`Querying source folder ID: ${sourceFolderId}`);

  try {
    const res = await driveClient.files.get({
      fileId: sourceFolderId,
      fields: 'id, name, mimeType',
    });
    console.log('✅ SUCCESS: Successfully accessed source folder details!');
    console.log('Folder details:', res.data);

    // Let's also check if we can list files inside it
    const listRes = await driveClient.files.list({
      q: `'${sourceFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    });
    console.log(`✅ SUCCESS: Successfully listed parent contents! Found ${listRes.data.files?.length || 0} items.`);
  } catch (err: any) {
    console.log('❌ FAILED: Received error while trying to read source folder:');
    console.log(`Message: ${err?.message}`);
    console.log(`Status code: ${err?.status || err?.statusCode || err?.code}`);
    console.log(`Full Error:`, JSON.stringify(err, null, 2));
  }
}

checkDriveAccess().catch(console.error);
