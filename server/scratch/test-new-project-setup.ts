import { googleDriveService } from '../src/services/googleDrive';

async function testNewSetup() {
  console.log('--- TESTING NEW FOLDER SETUP & COPY WITH OAUTH2 ---');

  const clientName = 'OAuthTestClient';
  const videoTitle = 'OAuth Cinematic Scene';
  const driveFolderLink = 'https://drive.google.com/drive/folders/1VqVlU_P6U4IoQQ96-lkSQ-5bdhrc4I-W?usp=sharing'; // source Work folder
  const submissionDate = new Date();

  try {
    const res = await googleDriveService.setupProjectFolder({
      clientName,
      videoTitle,
      driveFolderLink,
      submissionDate
    });

    console.log('\nFolder Setup Results:');
    console.log(`- Project Folder ID: ${res.projectFolderId}`);
    console.log(`- Project Folder URL: ${res.projectFolderUrl}`);
    console.log(`- Simulated? ${res.isSimulated}`);

    console.log('\nWaiting for background copy task to complete (12s)...');
    await new Promise(r => setTimeout(r, 12000));

    console.log('\nChecking if files were successfully copied...');
    const driveClient = (googleDriveService as any).initDriveClient();
    if (!driveClient) {
      console.error('Google Drive client is not active.');
      return;
    }

    const listRes = await driveClient.files.list({
      q: `'${res.projectFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = listRes.data.files || [];
    console.log(`Found ${files.length} items inside the new folder:`);
    for (const f of files) {
      console.log(`- Name: "${f.name}" (ID: ${f.id})`);
    }

    if (files.length > 0) {
      console.log('\n✅ SUCCESS: Files were successfully copied and stored in the authenticated user\'s Google Drive!');
    } else {
      console.log('\n❌ FAILURE: Destination folder is still empty.');
    }
  } catch (err: any) {
    console.error('❌ Error during setup and copy:', err.message || err);
  }
}

testNewSetup().catch(console.error);
