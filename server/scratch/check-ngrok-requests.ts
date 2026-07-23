import http from 'http';

async function checkNgrok() {
  console.log('--- FETCHING NGROK WEBHOOK REQUEST PAYLOADS ---');
  http.get('http://127.0.0.1:4040/api/requests/http', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const requests = parsed.requests || [];
        console.log(`Found ${requests.length} HTTP requests in Ngrok:`);
        for (const req of requests) {
          console.log(`- Request URI: ${req.uri} (Status: ${req.response?.status})`);
          if (req.request?.raw) {
            try {
              const bodyStr = Buffer.from(req.request.raw, 'base64').toString();
              console.log('Request Body:', bodyStr);
            } catch (e: any) {
              console.log('Failed to decode body:', e.message);
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to parse response:', err.message);
      }
    });
  }).on('error', (err) => {
    console.error('Failed to query Ngrok:', err.message);
  });
}

checkNgrok().catch(console.error);
