import { google } from 'googleapis';
import { env } from '../src/config/env';
import https from 'https';

function httpGetJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve) => {
    const req = https.get(url, { headers, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 408, error: 'timeout' }); });
  });
}

async function debugGoogleIntegration() {
  console.log('====================================================');
  console.log('      GOOGLE INTEGRATION DIAGNOSTIC RUNTIME         ');
  console.log('====================================================\n');

  // 1. Environment & Credentials Check
  console.log('1. ENVIRONMENT & CREDENTIALS CHECK:');
  console.log(`GOOGLE_CLIENT_ID: ${env.GOOGLE_CLIENT_ID}`);
  console.log(`GOOGLE_CLIENT_SECRET: ${env.GOOGLE_CLIENT_SECRET ? env.GOOGLE_CLIENT_SECRET.slice(0, 10) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_REFRESH_TOKEN: ${env.GOOGLE_REFRESH_TOKEN ? env.GOOGLE_REFRESH_TOKEN.slice(0, 15) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_CLIENT_EMAIL (Service Account): ${env.GOOGLE_CLIENT_EMAIL}`);

  // Extract client ID project number prefix
  const clientIdMatch = env.GOOGLE_CLIENT_ID?.match(/^(\d+)-/);
  const clientIdProjectNumber = clientIdMatch ? clientIdMatch[1] : 'Unknown';
  console.log(`OAuth Client ID Project Number Prefix: ${clientIdProjectNumber}`);

  // Extract Service Account Project ID
  const saMatch = env.GOOGLE_CLIENT_EMAIL?.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
  const serviceAccountProjectId = saMatch ? saMatch[1] : 'Unknown';
  console.log(`Service Account Project ID: ${serviceAccountProjectId}`);

  // 2. OAuth2 Client Setup
  console.log('\n2. OAUTH2 CLIENT INITIALIZATION:');
  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

  // Access Token Exchange & TokenInfo inspection
  let accessToken: string | null = null;
  try {
    const tokenRes = await oauth2Client.getAccessToken();
    accessToken = tokenRes.token || null;
    console.log(`Access Token acquired successfully! Token prefix: ${accessToken ? accessToken.slice(0, 15) + '...' : 'none'}`);

    if (accessToken) {
      // Query Google TokenInfo endpoint to get exact scopes, user_id, audience (client_id), email, etc.
      console.log('\n3. TOKENINFO INSPECTION (via https://oauth2.googleapis.com/tokeninfo):');
      const tokenInfoRes = await httpGetJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
      console.log('TokenInfo HTTP Status:', tokenInfoRes.status);
      console.log('TokenInfo response data:');
      console.log(JSON.stringify(tokenInfoRes.data, null, 2));

      // Query UserInfo endpoint to get authenticated user email
      console.log('\n4. USERINFO INSPECTION (via https://www.googleapis.com/oauth2/v2/userinfo):');
      const userInfoRes = await httpGetJson('https://www.googleapis.com/oauth2/v2/userinfo', {
        Authorization: `Bearer ${accessToken}`
      });
      console.log('UserInfo HTTP Status:', userInfoRes.status);
      console.log('UserInfo response data:');
      console.log(JSON.stringify(userInfoRes.data, null, 2));
    }
  } catch (err: any) {
    console.error('Error getting access token:', err.message);
  }

  // 5. Test Google Forms API Call
  console.log('\n5. GOOGLE FORMS API CALL TEST:');
  const testFormId = '1hKbSPn6bzQD2ZzZj6PD3lShZRBBAShPReSb08S9fm70';
  console.log(`Attempting forms.get for formId: ${testFormId}`);
  const formsClient = google.forms({ version: 'v1', auth: oauth2Client });

  try {
    const formRes = await formsClient.forms.get({ formId: testFormId });
    console.log('Form get SUCCESS!');
    console.log('Form Document Title:', formRes.data.info?.documentTitle);
  } catch (gaxiosErr: any) {
    console.log('\n❌ GaxiosError caught during forms.forms.get():');
    console.log('Status Code:', gaxiosErr.status || gaxiosErr.response?.status);
    console.log('Status Text:', gaxiosErr.statusText || gaxiosErr.response?.statusText);
    console.log('Request URL:', gaxiosErr.config?.url);
    console.log('Request Headers:', JSON.stringify(gaxiosErr.config?.headers, null, 2));
    console.log('Error Message:', gaxiosErr.message);
    console.log('Response Data:', JSON.stringify(gaxiosErr.response?.data, null, 2));
    console.log('Error Details Array:', JSON.stringify(gaxiosErr.errors || gaxiosErr.response?.data?.error?.errors, null, 2));
  }

  console.log('\n====================================================');
  process.exit(0);
}

setTimeout(() => {
  console.log('Forced exit timeout reached');
  process.exit(1);
}, 10000);

debugGoogleIntegration().catch((e) => {
  console.error(e);
  process.exit(1);
});
