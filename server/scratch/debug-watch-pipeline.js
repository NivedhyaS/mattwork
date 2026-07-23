/**
 * Live diagnostic: Checks watch existence, lists watches, tests manual response
 * fetch, and queries DB state for the target form.
 */
const dotenv = require('dotenv');
const https = require('https');
const http = require('http');

dotenv.config();

const TARGET_FORM_ID = '1FAIpQLSd_BE2moxKjVXtBtFydzdNPMqxLDiR11FQoyUATDzLEf-WWiQ';

function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, data: body }); } });
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
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, statusText: res.statusMessage, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, statusText: res.statusMessage, data: body }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function localGet(path) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 5000, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

async function run() {
  console.log('=============================================================');
  console.log('  PIPELINE WATCH + PUB/SUB INVESTIGATION');
  console.log('=============================================================\n');

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC || 'projects/mattwork/topics/mattwork-forms-notifications';
  const pubsubEndpoint = process.env.PUBSUB_PUSH_ENDPOINT_URL || '';
  const ngrokUrl = process.env.NGROK_URL || '';

  console.log('--- ENV SNAPSHOT ---');
  console.log(`GOOGLE_PUBSUB_TOPIC:       ${pubsubTopic}`);
  console.log(`PUBSUB_PUSH_ENDPOINT_URL:  ${pubsubEndpoint}`);
  console.log(`NGROK_URL:                 ${ngrokUrl}`);
  console.log();

  // ── Get fresh access token ──────────────────────────────────────────────────
  console.log('--- OAUTH TOKEN ---');
  const tokenRes = await postForm('https://oauth2.googleapis.com/token', {
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token'
  });
  if (tokenRes.status !== 200) {
    console.log('❌ Token exchange failed:', JSON.stringify(tokenRes.data));
    return;
  }
  const accessToken = tokenRes.data.access_token;
  const grantedScopes = tokenRes.data.scope || '';
  console.log(`Token OK. Scopes: ${grantedScopes}`);
  const hasForms = grantedScopes.includes('forms');
  console.log(`Has Forms API scopes: ${hasForms ? '✅ YES' : '❌ NO — stop here and regenerate token'}`);
  if (!hasForms) return;
  console.log();

  // ── STEP 1: forms.watches.list ──────────────────────────────────────────────
  console.log('=== STEP 1: forms.watches.list ===');
  const watchListUrl = `https://forms.googleapis.com/v1/forms/${TARGET_FORM_ID}/watches`;
  console.log(`GET ${watchListUrl}`);
  const watchListRes = await getJson(watchListUrl, { Authorization: `Bearer ${accessToken}` });
  console.log(`HTTP ${watchListRes.status} ${watchListRes.statusText}`);

  if (watchListRes.status === 200) {
    const watches = watchListRes.data.watches || [];
    if (watches.length === 0) {
      console.log('⚠️  NO WATCHES FOUND — Pub/Sub watch was never created or was deleted!');
      console.log('   Root cause: When "Map fields → Save" ran, createWatch() either failed silently');
      console.log('   or the Pub/Sub topic did not exist yet.');
    } else {
      console.log(`✅ ${watches.length} watch(es) found:`);
      watches.forEach((w, i) => {
        const expiry = new Date(w.expireTime);
        const isExpired = expiry < new Date();
        console.log(`\n   Watch ${i+1}:`);
        console.log(`     id:          ${w.id}`);
        console.log(`     state:       ${w.state}`);
        console.log(`     eventType:   ${w.eventType}`);
        console.log(`     topicName:   ${w.target?.topic?.topicName}`);
        console.log(`     createTime:  ${w.createTime}`);
        console.log(`     expireTime:  ${w.expireTime} ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
        const hoursLeft = Math.round((expiry - new Date()) / 3600000);
        if (!isExpired) console.log(`     expires in:  ~${hoursLeft}h`);
        const topicInWatch = w.target?.topic?.topicName;
        if (topicInWatch && topicInWatch !== pubsubTopic) {
          console.log(`     ⚠️  TOPIC MISMATCH:`);
          console.log(`       Watch topic: ${topicInWatch}`);
          console.log(`       .env topic:  ${pubsubTopic}`);
        }
      });
    }
  } else {
    console.log('❌ Could not list watches:', JSON.stringify(watchListRes.data, null, 2));
  }
  console.log();

  // ── STEP 2: forms.responses.list ───────────────────────────────────────────
  console.log('=== STEP 2: forms.responses.list (all responses) ===');
  const respListUrl = `https://forms.googleapis.com/v1/forms/${TARGET_FORM_ID}/responses`;
  const respRes = await getJson(respListUrl, { Authorization: `Bearer ${accessToken}` });
  console.log(`HTTP ${respRes.status} ${respRes.statusText}`);

  if (respRes.status === 200) {
    const responses = respRes.data.responses || [];
    console.log(`✅ Total responses in Google Forms: ${responses.length}`);
    if (responses.length > 0) {
      const latest = responses[responses.length - 1];
      console.log(`Latest response:`);
      console.log(`  responseId:        ${latest.responseId}`);
      console.log(`  createTime:        ${latest.createTime}`);
      console.log(`  lastSubmittedTime: ${latest.lastSubmittedTime}`);
      console.log(`  answers:`);
      if (latest.answers) {
        Object.entries(latest.answers).forEach(([qId, ans]) => {
          const vals = ans.textAnswers?.answers?.map(a => a.value).join(', ') || '(empty)';
          console.log(`    [${qId}] = "${vals}"`);
        });
      }
    }
  } else {
    console.log('❌ Could not fetch responses:', JSON.stringify(respRes.data, null, 2));
  }
  console.log();

  // ── STEP 3: Check DB via backend forms list ────────────────────────────────
  console.log('=== STEP 3: DATABASE STATE (via /api/v1/forms — no auth so may 401) ===');
  const dbRes = await localGet('/api/v1/forms');
  if (dbRes.status === 200) {
    const forms = dbRes.data?.data || [];
    const match = forms.find(f => f.googleFormId === TARGET_FORM_ID);
    if (match) {
      console.log(`✅ Form IS in DB — connectedFormId: ${match.id}`);
      console.log(`   syncStatus:                    ${match.syncStatus}`);
      console.log(`   lastSyncedAt:                  ${match.lastSyncedAt}`);
      console.log(`   lastProcessedResponseTimestamp: ${match.lastProcessedResponseTimestamp || 'null (never synced)'}`);
      console.log(`   mappings: ${match.mappings?.length || 0}`);
      match.mappings?.forEach(m => console.log(`     ${m.mattworkField} → qId=${m.googleQuestionId} (${m.googleQuestionType})`));
      const watch = match.watches?.[0];
      if (watch) {
        const expiry = new Date(watch.expireTime);
        const expired = expiry < new Date();
        console.log(`   DB Watch: watchId=${watch.watchId} expiry=${watch.expireTime} ${expired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
        console.log(`   DB Watch topic: ${watch.pubsubTopic}`);
      } else {
        console.log(`   ❌ NO WATCH in DB — watch creation failed silently during saveFormMapping!`);
      }
    } else {
      console.log(`❌ Form NOT in DB. Connected forms in DB: ${forms.length}`);
      forms.forEach(f => console.log(`   - ${f.googleFormId} | ${f.formTitle} | ${f.syncStatus}`));
    }
  } else {
    console.log(`/api/v1/forms returned ${dbRes.status} (needs auth bearer token — check server logs manually)`);
  }
  console.log();

  // ── STEP 4: Check ngrok inspector for recent requests ──────────────────────
  console.log('=== STEP 4: NGROK INSPECTOR — recent webhook hits ===');
  const ngrokRes = await new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port: 4040, path: '/api/requests/http', method: 'GET' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });

  if (ngrokRes.status === 200) {
    const requests = ngrokRes.data.requests || [];
    const webhookHits = requests.filter(r => r.request?.uri?.includes('forms-pubsub'));
    console.log(`Total ngrok requests captured: ${requests.length}`);
    console.log(`Webhook hits to /forms-pubsub: ${webhookHits.length}`);
    if (webhookHits.length > 0) {
      webhookHits.slice(-3).forEach((r, i) => {
        console.log(`\n  Hit ${i+1}:`);
        console.log(`    Time:   ${r.start}`);
        console.log(`    Method: ${r.request?.method} ${r.request?.uri}`);
        console.log(`    Status: ${r.response?.status}`);
        const body = r.request?.raw ? Buffer.from(r.request.raw, 'base64').toString('utf-8') : '(not captured)';
        console.log(`    Body:   ${body.slice(0, 300)}`);
      });
    } else {
      console.log('⚠️  NO /forms-pubsub requests ever hit ngrok.');
      console.log('   → Pub/Sub is NOT pushing to your endpoint.');
      console.log('   Causes: push subscription not created, wrong endpoint URL, or watch not active.');
    }
  } else {
    console.log(`ngrok inspector unavailable (${ngrokRes.status} / ${ngrokRes.error || ''}).`);
    console.log('Start ngrok with: ngrok http 5000 --host-header=rewrite');
  }
  console.log();

  // ── STEP 5: Manual sync test ───────────────────────────────────────────────
  console.log('=== STEP 5: MANUAL SYNC via processFormResponses ===');
  console.log('To trigger manual sync without Pub/Sub (bypasses the entire notification chain):');
  console.log('  1. Get a JWT admin token by logging into the app');
  console.log('  2. Run: curl -X POST http://localhost:5000/api/v1/forms/<connectedFormId>/sync \\');
  console.log('           -H "Authorization: Bearer <token>"');
  console.log('  OR use the admin UI: Forms page → Sync button');
  console.log();

  // ── STEP 6: Pub/Sub topic format check ─────────────────────────────────────
  console.log('=== STEP 6: PUB/SUB TOPIC + SUBSCRIPTION CONFIG ===');
  const topicMatch = pubsubTopic.match(/^projects\/([^/]+)\/topics\/([^/]+)$/);
  if (!topicMatch) {
    console.log(`❌ GOOGLE_PUBSUB_TOPIC format INVALID: "${pubsubTopic}"`);
    console.log('   Must be: projects/<project-id-or-number>/topics/<topic-name>');
  } else {
    console.log(`✅ Topic format OK: project="${topicMatch[1]}" topic="${topicMatch[2]}"`);
    const oauthProject = (clientId.match(/^(\d+)-/) || ['', '?'])[1];
    if (topicMatch[1] !== oauthProject && topicMatch[1] !== 'mattwork') {
      console.log(`   ⚠️  Topic project "${topicMatch[1]}" may differ from OAuth project "${oauthProject}"`);
    }
  }
  console.log(`Push endpoint: ${pubsubEndpoint || '(not set — defaults to request host + /api/v1/webhooks/forms-pubsub)'}`);
  console.log();

  console.log('=============================================================');
  console.log('  ACTION CHECKLIST (fix these in order)');
  console.log('=============================================================');
  console.log('□ 1. Confirm watch exists in forms.watches.list output above');
  console.log('□ 2. Confirm Pub/Sub topic exists in GCP project 741557059629');
  console.log('□ 3. Confirm push subscription endpoint = current ngrok URL/api/v1/webhooks/forms-pubsub');
  console.log('□ 4. Grant forms-notifications@system.gserviceaccount.com → roles/pubsub.publisher on topic');
  console.log('□ 5. Try manual sync (curl POST /sync) to verify pipeline works independently of Pub/Sub');
  console.log('□ 6. Check server logs for [WebhookController] Pub/Sub entries after submitting form');
}

run().catch(console.error);
