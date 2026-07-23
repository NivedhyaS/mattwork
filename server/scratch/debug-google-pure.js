const dotenv = require('dotenv');
const https = require('https');
const http = require('http');

dotenv.config();

function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = new URLSearchParams(params).toString();
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
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
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
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
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: headers
    };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, statusText: res.statusMessage, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, statusText: res.statusMessage, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runDiagnostics() {
  console.log('================================================================');
  console.log('           GOOGLE FORMS INTEGRATION DIAGNOSTICS                 ');
  console.log('================================================================\n');

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';

  console.log('--- 1. CREDENTIALS IN .ENV ---');
  console.log(`GOOGLE_CLIENT_ID: ${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET: ${clientSecret ? clientSecret.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_REFRESH_TOKEN: ${refreshToken ? refreshToken.slice(0, 15) + '...' : 'MISSING'}`);
  console.log(`GOOGLE_CLIENT_EMAIL (Service Account): ${clientEmail}`);

  // Project Number from Client ID
  const clientIdMatch = clientId.match(/^(\d+)-/);
  const clientIdProjectNumber = clientIdMatch ? clientIdMatch[1] : 'Unknown';
  console.log(`Project Number derived from GOOGLE_CLIENT_ID: ${clientIdProjectNumber}`);

  // Service Account Project ID
  const saMatch = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
  const serviceAccountProjectId = saMatch ? saMatch[1] : 'Unknown';
  console.log(`Project ID derived from GOOGLE_CLIENT_EMAIL: ${serviceAccountProjectId}`);

  console.log('\n--- 2. EXCHANGING REFRESH TOKEN FOR ACCESS TOKEN ---');
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const tokenRes = await postForm(tokenEndpoint, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  console.log(`Token Endpoint Response Status: ${tokenRes.status}`);
  if (tokenRes.status !== 200) {
    console.log('Token exchange FAILED:', JSON.stringify(tokenRes.data, null, 2));
    return;
  }

  const accessToken = tokenRes.data.access_token;
  console.log(`Access Token acquired! Token prefix: ${accessToken.slice(0, 15)}...`);
  console.log(`Granted Scopes from Token Response: ${tokenRes.data.scope}`);

  console.log('\n--- 3. TOKENINFO API INSPECTION ---');
  const tokenInfo = await getJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
  console.log(`TokenInfo Status: ${tokenInfo.status}`);
  console.log('TokenInfo Output:', JSON.stringify(tokenInfo.data, null, 2));

  console.log('\n--- 4. USERINFO API INSPECTION ---');
  const userInfo = await getJson('https://www.googleapis.com/oauth2/v2/userinfo', {
    Authorization: `Bearer ${accessToken}`
  });
  console.log(`UserInfo Status: ${userInfo.status}`);
  console.log('UserInfo Output:', JSON.stringify(userInfo.data, null, 2));

  console.log('\n--- 5. DIRECT GOOGLE FORMS API CALL TEST ---');
  const testFormId = '1hKbSPn6bzQD2ZzZj6PD3lShZRBBAShPReSb08S9fm70';
  const formsUrl = `https://forms.googleapis.com/v1/forms/${testFormId}`;
  console.log(`Calling GET ${formsUrl}...`);

  const formsRes = await getJson(formsUrl, {
    Authorization: `Bearer ${accessToken}`
  });

  console.log(`Google Forms API Response Status: ${formsRes.status} ${formsRes.statusText}`);
  console.log('Google Forms API Response Headers:', JSON.stringify({
    'www-authenticate': formsRes.headers['www-authenticate'],
    'content-type': formsRes.headers['content-type']
  }, null, 2));
  console.log('Google Forms API Response Data:');
  console.log(JSON.stringify(formsRes.data, null, 2));

  console.log('\n================================================================');
}

runDiagnostics().catch(console.error);
