import { googleDriveService } from '../src/services/googleDrive';
import { Readable } from 'stream';

async function testTransfer() {
  console.log('--- TESTING OWNERSHIP TRANSFER WORKAROUND ---');
  const driveClient = (googleDriveService as any).initDriveClient();
  if (!driveClient) {
    console.error('Google Drive client not enabled.');
    return;
  }

  const destFolderId = '1dhlkJMPaDu07hUwVvtxzFdTR2_7RW3W8';
  const targetEmail = 'nivedhyas2006@gmail.com';

  try {
    // Step 1: Create a 0-byte file
    console.log('Step 1: Creating 0-byte empty file...');
    const createRes = await driveClient.files.create({
      requestBody: {
        name: 'test_transfer_empty.txt',
        parents: [destFolderId],
        mimeType: 'text/plain',
      },
      fields: 'id',
    });
    const fileId = createRes.data.id!;
    console.log('File created successfully! ID:', fileId);

    // Step 2: Adding permission as writer first
    console.log(`Step 2: Adding ${targetEmail} as a writer...`);
    const permRes1 = await driveClient.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: targetEmail,
      },
      fields: 'id',
    });
    console.log('Permission added ID:', permRes1.data.id);

    // Step 3: Transfer ownership to targetEmail
    console.log(`Step 3: Transferring ownership to ${targetEmail}...`);
    await driveClient.permissions.create({
      fileId,
      transferOwnership: true,
      requestBody: {
        type: 'user',
        role: 'owner',
        emailAddress: targetEmail,
      },
    });
    console.log('Ownership transfer completed/initiated!');

    // Step 4: Try to write 5 bytes to the file
    console.log('Step 4: Writing 5 bytes of data to the file...');
    const stream = Readable.from('Hello');
    const updateRes = await driveClient.files.update({
      fileId,
      media: {
        mimeType: 'text/plain',
        body: stream,
      },
    });
    console.log('✅ SUCCESS! Wrote data to file ID:', updateRes.data.id);
  } catch (err: any) {
    console.error('❌ FAILED:', err.message);
  }
}

testTransfer().catch(console.error);
