// scripts/verify_autox_prepro.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\bazar\\.gemini\\antigravity\\brain\\5d02a6c9-21ac-42c1-9655-b2208618dd5c';

async function runVerification() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();

  // 1. Verify Course Gates Calibrator
  console.log('Testing prepro/gates.html...');
  await page.setViewport({ width: 1200, height: 800 });
  const gatesPath = 'file://' + path.resolve(__dirname, '..', 'prepro', 'gates.html').replace(/\\/g, '/');
  await page.goto(gatesPath, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  const gatesScreenshotPath = path.join(artifactDir, 'gates_calibration_screenshot.png');
  await page.screenshot({ path: gatesScreenshotPath });
  console.log(`Saved gates screenshot to: ${gatesScreenshotPath}`);

  // 2. Verify Pit Wall Ledger & Accordion Debrief (Desktop)
  console.log('Testing prepro/pitwall.html (Desktop)...');
  await page.setViewport({ width: 1280, height: 900 });
  const pitwallPath = 'file://' + path.resolve(__dirname, '..', 'prepro', 'pitwall.html').replace(/\\/g, '/');
  await page.goto(pitwallPath, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check that the ledger view is displayed
  const isLedgerVisible = await page.evaluate(() => {
    const view = document.getElementById('view-leaderboard');
    return view && view.style.display !== 'none';
  });
  console.log('Is Runs Ledger visible by default?', isLedgerVisible);

  // Click the first run row to expand debrief drawer
  console.log('Expanding first run in ledger...');
  await page.evaluate(() => {
    const firstRow = document.querySelector('#history-table-body tr.ledger-row');
    if (firstRow) firstRow.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const desktopScreenshotPath = path.join(artifactDir, 'prepro_pitwall_ledger_desktop.png');
  await page.screenshot({ path: desktopScreenshotPath });
  console.log(`Saved desktop ledger screenshot to: ${desktopScreenshotPath}`);

  // 3. Verify Pit Wall Ledger & Debrief (Mobile Viewport)
  console.log('Testing prepro/pitwall.html (Mobile 390x844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 500));

  const mobileScreenshotPath = path.join(artifactDir, 'prepro_pitwall_ledger_mobile.png');
  await page.screenshot({ path: mobileScreenshotPath });
  console.log(`Saved mobile ledger screenshot to: ${mobileScreenshotPath}`);

  // 4. Test inline edit (+1 cone)
  console.log('Testing inline edit toggle...');
  const editResult = await page.evaluate(() => {
    const firstPill = document.querySelector('.cone-pill-group button:nth-child(2)');
    if (firstPill) {
      firstPill.click();
      return { clicked: true, text: firstPill.textContent };
    }
    return { clicked: false };
  });
  console.log('Inline edit test result:', editResult);

  await browser.close();
  console.log('Verification completed successfully!');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
