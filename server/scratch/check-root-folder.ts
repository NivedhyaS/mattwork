import { googleDriveService } from '../src/services/googleDrive';
import { env } from '../src/config/env';

async function checkRoot() {
  console.log('--- CHECKING ROOT FOLDER METADATA ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client not enabled.');
    return;
  }

  const rootId = env.GOOGLE_DRIVE_FOLDER_ID!;

  try {
    const res = await driveClient.files.get({
      fileId: rootId,
      fields: 'id, name, mimeType, owners, shared, driveId, capabilities',
      supportsAllDrives: true,
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Failed to get root folder:', err.message);
  }
}

checkRoot().catch(console.error);
