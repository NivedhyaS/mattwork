import puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('--- STARTING PAYMENTS BROWSER VERIFICATION ---');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nived\\.gemini\\antigravity-ide\\brain\\519107f6-ee84-431f-b380-4d61af73414d';
  const downloadDir = path.join(artifactDir, 'downloads_pay');

  // Re-create downloads folder
  if (fs.existsSync(downloadDir)) {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
  fs.mkdirSync(downloadDir, { recursive: true });

  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Set download behavior
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir
  });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

  console.log('Logging in as admin...');
  await page.type('input[type="email"]', 'admin@mattwork.com');
  await page.type('input[type="password"]', 'Admin@123456');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  console.log('Navigating to Admin Payments page...');
  await page.goto('http://localhost:3000/admin/payments', { waitUntil: 'networkidle2' });

  // Wait for the table row to appear
  console.log('Waiting for payments table...');
  await page.waitForSelector('button[title="Download Invoice PDF"]');

  // Take a screenshot of the payments list page
  const pagePath = path.join(artifactDir, 'browser_payments_page.png');
  await page.screenshot({ path: pagePath });
  console.log(`Saved screenshot of payments page to: ${pagePath}`);

  // Click the PDF download button
  console.log('Clicking the PDF download button...');
  await page.click('button[title="Download Invoice PDF"]');

  // Wait a bit for download completion
  console.log('Waiting for the PDF file to download...');
  let downloadedFile = '';
  let attempts = 0;
  while (attempts < 15) {
    const files = fs.readdirSync(downloadDir);
    const completedFiles = files.filter(f => !f.endsWith('.crdownload') && f.endsWith('.pdf'));
    if (completedFiles.length > 0) {
      downloadedFile = completedFiles[0];
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
    attempts++;
  }

  if (downloadedFile) {
    const filePath = path.join(downloadDir, downloadedFile);
    const stats = fs.statSync(filePath);
    console.log(`\nSUCCESS: Payout download completed!`);
    console.log(`Downloaded File: ${downloadedFile}`);
    console.log(`File Size: ${stats.size} bytes`);
    
    // Check PDF signature (%PDF-)
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(5);
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    
    const signature = buffer.toString('utf-8');
    console.log(`File header signature: ${signature}`);
    if (signature === '%PDF-') {
      console.log('✓ Payout PDF file is a valid, uncorrupted document!');
    } else {
      console.log('✗ Payout PDF file is corrupted!');
    }
  } else {
    console.log('\nERROR: PDF Payout Download timed out or failed!');
  }

  await browser.close();
  console.log('\n--- VERIFICATION COMPLETE ---');
}

main().catch(console.error);
