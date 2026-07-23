import { googleDriveService } from '../src/services/googleDrive';

async function testDrives() {
  console.log('--- TESTING COPY WITH supportsAllDrives: true ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client not enabled.');
    return;
  }

  const sourceFileId = '17XVpaFIs4sUwEKz1TsHAmz_SqWW1mGo1'; // the PDF in the client folder
  const destFolderId = '1dhlkJMPaDu07hUwVvtxzFdTR2_7RW3W8'; // our dest folder

  try {
    console.log(`Attempting copy with supportsAllDrives...`);
    const res = await driveClient.files.copy({
      fileId: sourceFileId,
      supportsAllDrives: true,
      requestBody: {
        name: 'Cinematic Scene Copy.pdf',
        parents: [destFolderId],
      },
    });
    console.log('✅ SUCCESS! Copied file ID:', res.data.id);
  } catch (err: any) {
    console.error('❌ FAILED:', err.message);
  }
}

testDrives().catch(console.error);
