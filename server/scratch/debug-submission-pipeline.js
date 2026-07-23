const dotenv = require('dotenv');
const https = require('https');

dotenv.config();

const TARGET_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd_BE2moxKjVXtBtFydzdNPMqxLDiR11FQoyUATDzLEf-WWiQ/viewform';

function extractFormId(url) {
  const match = url.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/);
  if (match && match[1]) return match[1];
  const dMatch = url.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/);
  if (dMatch && dMatch[1]) return dMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) return url.trim();
  return null;
}

function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
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
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'GET', headers
    }, (res) => {
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
  console.log('=======================================================================');
  console.log('  FORM SUBMISSION PIPELINE INVESTIGATION                               ');
  console.log('=======================================================================\n');

  // ── STEP 1: Form ID extraction ────────────────────────────────────────────────
  console.log('STEP 1: FORM ID EXTRACTION');
  const extractedId = extractFormId(TARGET_FORM_URL);
  console.log(`URL: ${TARGET_FORM_URL}`);
  console.log(`Extracted Form ID: ${extractedId}`);
  if (!extractedId) {
    console.log('❌ FAILED: Could not extract form ID from URL.');
    return;
  }
  console.log(`✅ Form ID: ${extractedId}\n`);

  // ── STEP 2: OAuth2 Token Exchange ─────────────────────────────────────────────
  console.log('STEP 2: OAUTH TOKEN EXCHANGE');
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  console.log(`Client ID Project Number: ${(clientId.match(/^(\d+)-/) || ['', 'UNKNOWN'])[1]}`);
  console.log(`Refresh Token prefix: ${refreshToken ? refreshToken.slice(0, 20) + '...' : 'MISSING'}`);

  const tokenRes = await postForm('https://oauth2.googleapis.com/token', {
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token'
  });
  if (tokenRes.status !== 200) {
    console.log('❌ Token exchange FAILED:');
    console.log(JSON.stringify(tokenRes.data, null, 2));
    return;
  }
  const accessToken = tokenRes.data.access_token;
  const grantedScopes = tokenRes.data.scope || '';
  console.log(`✅ Access Token acquired (prefix): ${accessToken.slice(0, 15)}...`);
  console.log(`Granted scopes: ${grantedScopes}`);

  const hasFormsBodyScope = grantedScopes.includes('forms.body.readonly') || grantedScopes.includes('forms.body');
  const hasFormsResponsesScope = grantedScopes.includes('forms.responses.readonly') || grantedScopes.includes('forms.responses');
  const hasDriveScope = grantedScopes.includes('drive');
  console.log(`  forms.body.readonly:      ${hasFormsBodyScope ? '✅ YES' : '❌ MISSING'}`);
  console.log(`  forms.responses.readonly: ${hasFormsResponsesScope ? '✅ YES' : '❌ MISSING'}`);
  console.log(`  drive:                    ${hasDriveScope ? '✅ YES' : '❌ MISSING'}`);
  if (!hasFormsBodyScope || !hasFormsResponsesScope) {
    console.log('\n⛔ CRITICAL: Refresh token does not have Forms API scopes!');
    console.log('   Run: npx ts-node generate-refresh-token.ts  and regenerate the token.');
  }
  console.log();

  // ── STEP 3: Authenticated user identity ───────────────────────────────────────
  console.log('STEP 3: AUTHENTICATED USER IDENTITY');
  const tokenInfo = await getJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
  const aud = tokenInfo.data?.aud || '';
  console.log(`Audience (client_id): ${aud}`);
  console.log(`Scopes from tokeninfo: ${tokenInfo.data?.scope || 'N/A'}`);
  
  const userInfo = await getJson('https://www.googleapis.com/oauth2/v3/userinfo', {
    Authorization: `Bearer ${accessToken}`
  });
  const authenticatedEmail = userInfo.data?.email || 'UNKNOWN (token missing openid/email scope)';
  console.log(`Authenticated user email: ${authenticatedEmail}`);
  if (userInfo.status !== 200) {
    console.log(`  ⚠️ Could not retrieve user email. UserInfo status: ${userInfo.status}`);
    console.log(`  (This means the token was NOT issued with openid or email scope.)`);
  }
  console.log();

  // ── STEP 4: Forms API – fetch form metadata ───────────────────────────────────
  console.log('STEP 4: FORMS API - FETCH FORM METADATA (forms.get)');
  const formsGetUrl = `https://forms.googleapis.com/v1/forms/${extractedId}`;
  console.log(`Calling GET ${formsGetUrl}`);
  const formGetRes = await getJson(formsGetUrl, { Authorization: `Bearer ${accessToken}` });
  console.log(`Forms.get status: ${formGetRes.status} ${formGetRes.statusText}`);

  if (formGetRes.status === 200) {
    console.log(`✅ Form accessible! Title: "${formGetRes.data?.info?.documentTitle || formGetRes.data?.info?.title}"`);
    console.log(`   Form ID from response: ${formGetRes.data?.formId}`);
    console.log(`   Number of items: ${formGetRes.data?.items?.length ?? 0}`);
    if (formGetRes.data?.items) {
      formGetRes.data.items.forEach((item, i) => {
        const q = item.questionItem?.question;
        const type = q?.choiceQuestion?.type || (q?.textQuestion ? (q.textQuestion.paragraph ? 'PARAGRAPH' : 'TEXT') : (q?.dateQuestion ? 'DATE' : 'UNKNOWN'));
        console.log(`   Q${i+1}: "${item.title}" | questionId: ${q?.questionId || 'N/A'} | type: ${type}`);
      });
    }
  } else {
    console.log(`❌ Form not accessible:`);
    console.log(JSON.stringify(formGetRes.data, null, 2));
  }
  console.log();

  // ── STEP 5: Forms API – fetch responses ───────────────────────────────────────
  console.log('STEP 5: FORMS API - FETCH RESPONSES (forms.responses.list)');
  const formsRespUrl = `https://forms.googleapis.com/v1/forms/${extractedId}/responses`;
  console.log(`Calling GET ${formsRespUrl}`);
  const respRes = await getJson(formsRespUrl, { Authorization: `Bearer ${accessToken}` });
  console.log(`responses.list status: ${respRes.status} ${respRes.statusText}`);

  if (respRes.status === 200) {
    const responses = respRes.data?.responses || [];
    console.log(`✅ Fetched ${responses.length} response(s) from Google Forms.`);
    if (responses.length === 0) {
      console.log('   (No responses yet — submit the form at least once to test the pipeline.)');
    } else {
      responses.forEach((r, i) => {
        console.log(`\n   Response ${i+1}:`);
        console.log(`     responseId: ${r.responseId}`);
        console.log(`     createTime: ${r.createTime}`);
        console.log(`     lastSubmittedTime: ${r.lastSubmittedTime}`);
        if (r.answers) {
          console.log(`     answers:`);
          Object.entries(r.answers).forEach(([qId, ans]) => {
            const vals = ans.textAnswers?.answers?.map(a => a.value).join(', ') || 'N/A';
            console.log(`       questionId=${qId}: "${vals}"`);
          });
        }
      });
    }
  } else {
    console.log(`❌ Could not fetch responses:`);
    console.log(JSON.stringify(respRes.data, null, 2));
  }
  console.log();

  // ── STEP 6: Check DB for connected form ───────────────────────────────────────
  console.log('STEP 6: CHECK DATABASE – connected form & watch via backend API');
  const backendUrl = `http://localhost:5000/api/v1/forms`;
  const localFormsRes = await new Promise((resolve) => {
    const req = require('http').request({
      hostname: 'localhost', port: 5000, path: '/api/v1/forms', method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message }}));
    req.end();
  });
  
  if (localFormsRes.status === 401 || localFormsRes.status === 403) {
    console.log('  (Admin endpoint requires auth — querying DB state via pg directly...)');
  } else {
    console.log(`Backend GET /api/v1/forms status: ${localFormsRes.status}`);
    const forms = localFormsRes.data?.data;
    if (Array.isArray(forms)) {
      const targetForm = forms.find(f => f.googleFormId === extractedId);
      if (targetForm) {
        console.log(`✅ Form IS in database!`);
        console.log(`   connectedFormId: ${targetForm.id}`);
        console.log(`   formTitle: "${targetForm.formTitle}"`);
        console.log(`   syncStatus: ${targetForm.syncStatus}`);
        console.log(`   lastSyncedAt: ${targetForm.lastSyncedAt}`);
        console.log(`   lastProcessedResponseTimestamp: ${targetForm.lastProcessedResponseTimestamp}`);
        console.log(`   mappings (${targetForm.mappings?.length || 0}):`);
        (targetForm.mappings || []).forEach(m => {
          console.log(`     ${m.mattworkField} → questionId=${m.googleQuestionId} (${m.googleQuestionType})`);
        });
        const watch = targetForm.watches?.[0];
        if (watch) {
          console.log(`   Latest Watch:`);
          console.log(`     watchId: ${watch.watchId}`);
          console.log(`     expireTime: ${watch.expireTime}`);
          console.log(`     pubsubTopic: ${watch.pubsubTopic}`);
          const now = new Date();
          const expiry = new Date(watch.expireTime);
          if (expiry < now) {
            console.log(`     ⚠️ WATCH IS EXPIRED! Expired: ${expiry.toISOString()}`);
          } else {
            const hoursRemaining = Math.round((expiry - now) / 3600000);
            console.log(`     ✅ Watch is ACTIVE. Expires in ~${hoursRemaining}h.`);
          }
        } else {
          console.log(`   ⚠️ NO FormWatch found — Pub/Sub notifications are NOT being sent!`);
        }
      } else {
        console.log(`❌ Form with googleFormId="${extractedId}" is NOT in the connected_forms table.`);
        console.log(`   You must use the "Detect Form" + "Save Mapping" flow in the admin UI first.`);
        if (forms.length > 0) {
          console.log(`   Existing connected forms:`);
          forms.forEach(f => console.log(`     - "${f.formTitle}" | googleFormId: ${f.googleFormId} | status: ${f.syncStatus}`));
        } else {
          console.log(`   (No forms connected at all.)`);
        }
      }
    }
  }
  console.log();

  // ── STEP 7: Pub/Sub configuration check ───────────────────────────────────────
  console.log('STEP 7: PUB/SUB CONFIGURATION CHECK');
  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC || 'NOT SET';
  const pubsubEndpoint = process.env.PUBSUB_PUSH_ENDPOINT_URL || 'NOT SET';
  const ngrokUrl = process.env.NGROK_URL || 'NOT SET';
  console.log(`GOOGLE_PUBSUB_TOPIC:       ${pubsubTopic}`);
  console.log(`PUBSUB_PUSH_ENDPOINT_URL:  ${pubsubEndpoint}`);
  console.log(`NGROK_URL:                 ${ngrokUrl}`);

  const expectedEndpoint = `${ngrokUrl}/api/v1/webhooks/forms-pubsub`;
  if (pubsubEndpoint !== expectedEndpoint && pubsubEndpoint !== 'NOT SET') {
    console.log(`⚠️ MISMATCH: PUBSUB_PUSH_ENDPOINT_URL does not match expected endpoint.`);
    console.log(`   Configured: ${pubsubEndpoint}`);
    console.log(`   Expected:   ${expectedEndpoint}`);
  } else {
    console.log(`✅ Push endpoint URL matches ngrok URL.`);
  }
  
  const pubsubTopicProject = pubsubTopic.match(/^projects\/([^/]+)\//)?.[1] || 'UNKNOWN';
  const oauthProjectNumber = (clientId.match(/^(\d+)-/) || ['', 'UNKNOWN'])[1];
  console.log(`\nPub/Sub topic project: ${pubsubTopicProject}`);
  console.log(`OAuth Client ID project number: ${oauthProjectNumber}`);
  if (pubsubTopicProject !== oauthProjectNumber && pubsubTopicProject !== 'mattwork' && pubsubTopicProject !== 'UNKNOWN') {
    console.log(`⚠️ WARNING: Pub/Sub topic project may not match OAuth project.`);
  }

  console.log('\n=======================================================================');
  console.log('  DIAGNOSIS SUMMARY                                                      ');
  console.log('=======================================================================');
  if (!hasFormsBodyScope || !hasFormsResponsesScope) {
    console.log('\n❌ ROOT CAUSE: Refresh token missing Forms API scopes.');
    console.log('   FIX: Run "npx ts-node generate-refresh-token.ts", re-authorize with Forms scopes, paste new token into .env, restart server.');
  } else if (formGetRes.status !== 200) {
    console.log('\n❌ ROOT CAUSE: Forms API call failing.');
    console.log(`   Error: ${formGetRes.data?.error?.message}`);
    console.log(`   FIX: ${formGetRes.data?.error?.status === 'PERMISSION_DENIED' ? 'The authenticated Google account does not have access to this form.' : 'Check GCP APIs & enabled services.'}`);
  } else if (respRes.status !== 200) {
    console.log('\n❌ ROOT CAUSE: responses.list failing.');
    console.log(`   Error: ${respRes.data?.error?.message}`);
  } else if (respRes.status === 200 && (respRes.data?.responses || []).length === 0) {
    console.log('\nℹ️  NO RESPONSES YET: Form is accessible and pipeline is ready.');
    console.log('   Submit the form at the URL above, then run a manual sync:');
    console.log('   POST /api/v1/forms/:connectedFormId/sync (admin auth required)');
  } else {
    console.log('\n✅ Forms API is accessible and responses are available.');
    console.log('   Issue is likely in Pub/Sub delivery or field mapping.');
    console.log('   Run a manual sync: POST /api/v1/forms/:connectedFormId/sync');
  }
  console.log();
}

run().catch(console.error);
