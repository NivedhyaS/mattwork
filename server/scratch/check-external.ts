import http from 'http';
import https from 'https';

function checkUrl(urlStr: string, isHttps = false): Promise<void> {
  return new Promise((resolve) => {
    const getter = isHttps ? https : http;
    getter.get(urlStr, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log(`URL: ${urlStr}`);
        console.log(`- Status Code: ${res.statusCode}`);
        console.log(`- Response: ${data}`);
        resolve();
      });
    }).on('error', (err) => {
      console.log(`URL: ${urlStr}`);
      console.log(`- Error: ${err.message}`);
      resolve();
    });
  });
}

async function run() {
  console.log('--- CHECKING EXTERNAL ACCESS ---');
  await checkUrl('http://127.0.0.1:5000/health');
  await checkUrl('https://party-strung-blinker.ngrok-free.dev/health', true);
}

run();
