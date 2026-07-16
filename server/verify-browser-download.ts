import puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('--- STARTING BROWSER DOWNLOAD VERIFICATION ---');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nived\\.gemini\\antigravity-ide\\brain\\519107f6-ee84-431f-b380-4d61af73414d';
  const downloadDir = path.join(artifactDir, 'downloads');

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

  console.log('Navigating to Admin Invoices page...');
  await page.goto('http://localhost:3000/admin/invoices', { waitUntil: 'networkidle2' });

  // Wait for the download button to appear (first row in table)
  console.log('Waiting for invoices table...');
  await page.waitForSelector('button[title="Download PDF"]');

  // Let's take a screenshot of the invoices page before clicking download
  const pageBeforePath = path.join(artifactDir, 'browser_invoices_page.png');
  await page.screenshot({ path: pageBeforePath });
  console.log(`Saved screenshot of invoices list to: ${pageBeforePath}`);

  // Find and click the download button of the first row
  console.log('Clicking the PDF download button...');
  await page.click('button[title="Download PDF"]');

  // Take an immediate screenshot showing the button click / loader if any
  const downloadActivePath = path.join(artifactDir, 'browser_download_active.png');
  await page.screenshot({ path: downloadActivePath });
  console.log(`Saved screenshot of active click state to: ${downloadActivePath}`);

  // Wait for file download (poll the downloads directory)
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
    console.log(`\nSUCCESS: Download completed!`);
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
      console.log('✓ File is a valid, uncorrupted PDF document!');
    } else {
      console.log('✗ File is corrupted or not a valid PDF!');
    }
  } else {
    console.log('\nERROR: PDF Download timed out or failed!');
  }

  await browser.close();
  console.log('\n--- VERIFICATION COMPLETE ---');
}

main().catch(console.error);
