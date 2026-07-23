import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

async function share() {
  console.log('--- SHARING ROOT FOLDER WITH OAUTH ACCOUNT ---');
  
  const clientEmail = 'mattwork-service@mattwork-501419.iam.gserviceaccount.com';
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const folderId = '1c6MDMamIePD8FWtyc7yEN9mpeQ-vqdE2';
  const targetEmail = 'mattwork.drive@gmail.com';

  if (!privateKey) {
    console.error('GOOGLE_PRIVATE_KEY is missing from environment!');
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log(`Sharing folder ${folderId} with ${targetEmail} as writer...`);
    const res = await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: targetEmail,
      },
    });
    console.log('✅ SUCCESS! Shared folder. Permission ID:', res.data.id);
  } catch (err: any) {
    console.error('❌ FAILED:', err.message || err);
  }
}

share().catch(console.error);
