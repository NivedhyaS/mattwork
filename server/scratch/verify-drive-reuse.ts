import prisma from '../src/config/database';
import { googleDriveService } from '../src/services/googleDrive';

async function verifyDriveReuse() {
  console.log('--- STARTING GOOGLE DRIVE FOLDER REUSE VERIFICATION ---');

  const clientName = 'AutoTestClient';
  const videoTitle1 = 'Promo Video 1';
  const videoTitle2 = 'Promo Video 2';
  const driveFolderLink = 'https://drive.google.com/drive/folders/1J7k6MalKOtY-xGie---k6EivjBBCNVL_';
  const submissionDate = new Date(); // same day, today

  console.log('Submission Date:', submissionDate);

  console.log('\nSending first submission...');
  const res1 = await googleDriveService.setupProjectFolder({
    clientName,
    videoTitle: videoTitle1,
    driveFolderLink,
    submissionDate
  });

  console.log('First Submission Results:');
  console.log(`- Project Folder ID: ${res1.projectFolderId}`);
  console.log(`- Project Folder URL: ${res1.projectFolderUrl}`);

  console.log('\nSending second submission (same client, same day)...');
  const res2 = await googleDriveService.setupProjectFolder({
    clientName,
    videoTitle: videoTitle2,
    driveFolderLink,
    submissionDate
  });

  console.log('Second Submission Results:');
  console.log(`- Project Folder ID: ${res2.projectFolderId}`);
  console.log(`- Project Folder URL: ${res2.projectFolderUrl}`);

  console.log('\nLet us verify parent paths...');
  // We can fetch details of the folders to see if they share the same parents!
  const driveClient = (googleDriveService as any).initDriveClient();
  if (driveClient) {
    const file1 = await driveClient.files.get({
      fileId: res1.projectFolderId,
      fields: 'parents',
    });
    const file2 = await driveClient.files.get({
      fileId: res2.projectFolderId,
      fields: 'parents',
    });

    const parentId1 = file1.data.parents?.[0];
    const parentId2 = file2.data.parents?.[0];

    console.log(`- Day Folder ID for Submission 1: ${parentId1}`);
    console.log(`- Day Folder ID for Submission 2: ${parentId2}`);
    if (parentId1 === parentId2) {
      console.log('✅ SUCCESS: Both project folders share the exact same Day folder ID! Folders were correctly reused.');
    } else {
      console.log('❌ FAILURE: Different Day folder IDs found!');
    }
  } else {
    console.log('Drive client simulation fallback.');
  }

  console.log('--- DRIVE VERIFICATION COMPLETE ---');
}

verifyDriveReuse().catch(console.error);
