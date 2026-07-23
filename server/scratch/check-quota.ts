import { googleDriveService } from '../src/services/googleDrive';

async function checkQuota() {
  console.log('--- CHECKING SERVICE ACCOUNT QUOTA ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client not enabled.');
    return;
  }

  try {
    const res = await driveClient.about.get({
      fields: 'storageQuota, user',
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Failed to get quota:', err.message);
  }
}

checkQuota().catch(console.error);
