const email = process.argv[2];
const password = process.argv[3] || 'password123';

async function login() {
  const url = 'http://localhost:5000/api/v1/auth/login';
  console.log(`POST ${url} - Email: ${email}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const text = await response.text();
    console.log(`\n--- HTTP STATUS ---`);
    console.log(`${response.status} ${response.statusText}`);
    console.log(`\n--- RESPONSE BODY ---`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch (e) {
      console.log(text);
    }
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

login();
