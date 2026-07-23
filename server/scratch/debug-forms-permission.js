const dotenv = require('dotenv');
const https = require('https');

dotenv.config();

function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = new URLSearchParams(params).toString();
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, statusText: res.statusMessage, data: JSON.parse(body), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, statusText: res.statusMessage, data: body, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('     GOOGLE FORMS PERMISSION INVESTIGATION (RUNTIME)            ');
  console.log('================================================================\n');

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';

  console.log('--- STEP 1: CREDENTIALS ---');
  console.log(`GOOGLE_CLIENT_ID:        ${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET:    ${clientSecret ? clientSecret.slice(0, 10) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_REFRESH_TOKEN:    ${refreshToken ? refreshToken.slice(0, 20) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_CLIENT_EMAIL:     ${clientEmail}`);

  const clientIdMatch = clientId.match(/^(\d+)-/);
  const oauthProjectNumber = clientIdMatch ? clientIdMatch[1] : 'Unknown';
  const saMatch = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
  const serviceAccountProjectId = saMatch ? saMatch[1] : 'Unknown';
  console.log(`\nOAuth Client ID Project Number: ${oauthProjectNumber}`);
  console.log(`Service Account Project ID:     ${serviceAccountProjectId}`);

  console.log('\n--- STEP 2: EXCHANGE REFRESH TOKEN FOR ACCESS TOKEN ---');
  const tokenRes = await postForm('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  console.log(`Token endpoint HTTP status: ${tokenRes.status}`);
  if (tokenRes.status !== 200) {
    console.log('Token exchange FAILED:');
    console.log(JSON.stringify(tokenRes.data, null, 2));
    return;
  }
  const accessToken = tokenRes.data.access_token;
  const grantedScopes = tokenRes.data.scope;
  console.log(`Access Token (prefix): ${accessToken.slice(0, 20)}...`);
  console.log(`Scopes granted by token response: ${grantedScopes}`);

  // Check required scopes
  const requiredScopes = [
    'https://www.googleapis.com/auth/forms.body.readonly',
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/drive'
  ];
  const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));
  if (missingScopes.length > 0) {
    console.log('\n⚠️  MISSING REQUIRED SCOPES:');
    missingScopes.forEach(s => console.log(`   - ${s}`));
  } else {
    console.log('\n✅ All required scopes are present.');
  }

  console.log('\n--- STEP 3: TOKENINFO (scopes, audience, project) ---');
  const tokenInfo = await getJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
  console.log(`TokenInfo HTTP Status: ${tokenInfo.status}`);
  console.log(JSON.stringify(tokenInfo.data, null, 2));

  console.log('\n--- STEP 4: AUTHENTICATED USER EMAIL (userinfo) ---');
  const userInfo = await getJson('https://www.googleapis.com/oauth2/v3/userinfo', {
    Authorization: `Bearer ${accessToken}`
  });
  console.log(`UserInfo HTTP Status: ${userInfo.status}`);
  console.log(JSON.stringify(userInfo.data, null, 2));

  const authenticatedEmail = userInfo.data?.email || 'UNKNOWN — token may lack openid/email scope';
  console.log(`\n>>> AUTHENTICATED AS: ${authenticatedEmail}`);

  console.log('\n--- STEP 5: CHECK GOOGLE DRIVE ACCESS TO FORM ---');
  // The form ID from previous session
  const testFormId = '1hKbSPn6bzQD2ZzZj6PD3lShZRBBAShPReSb08S9fm70';
  console.log(`Target Form ID: ${testFormId}`);

  // Try Drive files.get to see form metadata (title, owners, permissions)
  const driveFileUrl = `https://www.googleapis.com/drive/v3/files/${testFormId}?fields=id,name,owners,permissions,sharingUser,driveId,teamDriveId,capabilities,permissionIds`;
  console.log(`Calling Drive files.get: ${driveFileUrl}`);
  const driveFileRes = await getJson(driveFileUrl, {
    Authorization: `Bearer ${accessToken}`
  });
  console.log(`Drive files.get HTTP Status: ${driveFileRes.status} ${driveFileRes.statusText}`);
  console.log('Drive files.get response:');
  console.log(JSON.stringify(driveFileRes.data, null, 2));

  console.log('\n--- STEP 6: GOOGLE FORMS API CALL ---');
  const formsUrl = `https://forms.googleapis.com/v1/forms/${testFormId}`;
  console.log(`Calling GET ${formsUrl}`);
  const formsRes = await getJson(formsUrl, {
    Authorization: `Bearer ${accessToken}`
  });
  console.log(`Forms API HTTP Status: ${formsRes.status} ${formsRes.statusText}`);
  console.log(`Forms API response headers: ${JSON.stringify({
    'www-authenticate': formsRes.headers['www-authenticate'],
    'content-type': formsRes.headers['content-type']
  })}`);
  console.log('Forms API response body:');
  console.log(JSON.stringify(formsRes.data, null, 2));

  console.log('\n--- SUMMARY ---');
  if (formsRes.status === 200) {
    console.log('✅ SUCCESS: Forms API returned form data.');
    console.log('Form Title:', formsRes.data?.info?.title);
  } else if (formsRes.status === 403) {
    const errData = formsRes.data?.error;
    const reason = errData?.details?.find(d => d.reason)?.reason || errData?.status;
    console.log(`❌ FORMS API 403: ${errData?.message}`);
    console.log(`Reason: ${reason}`);
    console.log('\nDIAGNOSIS:');
    if (missingScopes.length > 0) {
      console.log('  ROOT CAUSE A: Refresh token is missing required Forms scopes.');
      console.log('  FIX: Regenerate refresh token using generate-refresh-token.ts with the new scopes.');
    } else if (driveFileRes.status !== 200) {
      console.log('  ROOT CAUSE B: Authenticated user has NO Drive access to the form.');
      console.log(`  The form owner must share the form with: ${authenticatedEmail}`);
    } else {
      console.log('  ROOT CAUSE C: User has Drive access but Forms API still rejects.');
      console.log('  This usually means the authenticated Google account is not the form owner/editor.');
      console.log(`  Authenticated as: ${authenticatedEmail}`);
      console.log('  FIX: Share the Google Form with the authenticated account as Editor/Owner, or use the form owner\'s refresh token.');
    }
  } else if (formsRes.status === 401) {
    console.log('❌ FORMS API 401: Authentication failed. The access token is invalid.');
    console.log('FIX: Regenerate the refresh token using generate-refresh-token.ts.');
  }

  console.log('\n================================================================');
}

run().catch(console.error);
