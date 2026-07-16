const puppeteer = require('puppeteer-core');
const path = require('path');

async function main() {
  console.log('--- STARTING CLIENT LOGIN VERIFICATION ---');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nived\\.gemini\\antigravity-ide\\brain\\519107f6-ee84-431f-b380-4d61af73414d';

  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

  console.log('Logging in as client (usd_client@test.com)...');
  await page.type('input[type="email"]', 'usd_client@test.com');
  await page.type('input[type="password"]', 'Password@123');
  
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  const currentUrl = page.url();
  console.log(`Successfully redirected to: ${currentUrl}`);

  if (currentUrl.includes('/client')) {
    console.log('✓ Redirected successfully to client dashboard!');
    
    await new Promise(r => setTimeout(r, 3000)); // wait for balance fetch

    // Take screenshot of dashboard
    const screenshotPath = path.join(artifactDir, 'browser_client_dashboard.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot of client dashboard to: ${screenshotPath}`);
    console.log('✓ Client login is fully working!');
  } else {
    console.log('✗ Failed to redirect to client dashboard!');
    const content = await page.evaluate(() => document.body.innerText);
    console.log(`Page contents:\n${content}`);
  }

  await browser.close();
  console.log('--- VERIFICATION COMPLETE ---');
}

main().catch(console.error);
