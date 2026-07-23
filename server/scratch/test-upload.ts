import { googleDriveService } from '../src/services/googleDrive';
import { Readable } from 'stream';

async function testUpload() {
  console.log('--- TESTING UPLOAD WITH SERVICE ACCOUNT ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client not enabled.');
    return;
  }

  const destFolderId = '1dhlkJMPaDu07hUwVvtxzFdTR2_7RW3W8';

  try {
    console.log('Creating a 5-byte file...');
    const stream = Readable.from('Hello');
    const res = await driveClient.files.create({
      requestBody: {
        name: 'test_5bytes.txt',
        parents: [destFolderId],
      },
      media: {
        mimeType: 'text/plain',
        body: stream,
      },
    });
    console.log('✅ SUCCESS! Uploaded file ID:', res.data.id);
  } catch (err: any) {
    console.error('❌ FAILED:', err.message);
  }
}

testUpload().catch(console.error);
