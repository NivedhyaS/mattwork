async function main() {
  const baseURL = 'http://localhost:5000/api/v1';
  console.log('--- TESTING DOWNLOAD API (with fetch) ---');
  
  // 1. Login as Admin
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@mattwork.com',
      password: 'Admin@123456'
    })
  });
  const loginData: any = await loginRes.json();
  console.log('Login Response:', loginData);
  const token = loginData.data?.tokens?.accessToken;
  console.log('Token extracted:', token);

  // 2. Fetch list of invoices
  const invoicesRes = await fetch(`${baseURL}/invoices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const invoicesData: any = await invoicesRes.json();
  console.log('Invoices API Response:', invoicesData);
  const invoices = invoicesData.data || [];
  console.log(`Fetched ${invoices.length} invoices.`);

  // 3. Try downloading each of them
  for (const inv of invoices.slice(0, 3)) {
    console.log(`\nAttempting download for Invoice ID=${inv.id}, Number=${inv.number}`);
    try {
      const downloadRes = await fetch(`${baseURL}/invoices/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`Status: ${downloadRes.status}`);
      console.log(`Content-Type: ${downloadRes.headers.get('content-type')}`);
      if (downloadRes.status !== 200) {
        const text = await downloadRes.text();
        console.log(`Response text: ${text}`);
      } else {
        const buffer = await downloadRes.arrayBuffer();
        console.log(`Buffer length: ${buffer.byteLength}`);
      }
    } catch (err: any) {
      console.log(`Download FAILED: ${err.message}`);
    }
  }
}

main().catch(console.error);
