// Overflow sweep: walk every sidebar tab at mobile and desktop viewports
// and flag any page that overflows horizontally.
//
// Same tab-walking pattern as nav_sweep.js (opens collapsed groups before
// clicking), but instead of watching for JS errors it checks
// `document.documentElement.scrollWidth - window.innerWidth` at each of two
// viewports. Anything over a 5px tolerance is reported as an offender.
//
// Usage:
//   node scripts/verify/overflow_sweep.js [path/to/index.html]
//
// Exit code 0 if no offenders at either viewport, 1 otherwise.

const path = require('path');

const VIEWPORTS = [
  { name: 'mobile (393x852)', width: 393, height: 852 },
  { name: 'desktop (1440x900)', width: 1440, height: 900 },
];
const TOLERANCE_PX = 5;

function resolveChromium() {
  const { chromium } = require('playwright');
  return chromium;
}

async function sweepViewport(chromium, htmlPath, launchOpts, viewport) {
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const tabCount = await page.$$eval('.app-sidebar .page-tab', els => els.length);
  const offenders = [];

  for (let i = 0; i < tabCount; i++) {
    const tabs = await page.$$('.app-sidebar .page-tab');
    const tab = tabs[i];
    const txt = (await tab.textContent() || '').trim();
    const opened = await page.evaluate(el => {
      const item = el.closest('.side-item');
      if (item && !item.classList.contains('open')) {
        const trigger = item.querySelector('.side-group-trigger');
        if (trigger) { trigger.click(); return true; }
      }
      return false;
    }, tab);
    if (opened) await page.waitForTimeout(100);
    await tab.click();
    await page.waitForTimeout(350);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    const over = overflow.scrollWidth - overflow.innerWidth;
    if (over > TOLERANCE_PX) offenders.push({ tab: txt, overflowPx: over });
  }

  await browser.close();
  return { tabCount, offenders, errors };
}

async function main() {
  const chromium = resolveChromium();
  const htmlPath = process.argv[2] || path.resolve(__dirname, '..', '..', 'index.html');
  const launchOpts = {};
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }

  let anyOffenders = false;
  let anyErrors = false;

  for (const viewport of VIEWPORTS) {
    console.log(`\n=== ${viewport.name} ===`);
    const { tabCount, offenders, errors } = await sweepViewport(chromium, htmlPath, launchOpts, viewport);
    console.log('Tab count:', tabCount);
    console.log('Offenders (>%dpx overflow):'.replace('%d', TOLERANCE_PX), JSON.stringify(offenders, null, 2));
    if (errors.length) {
      console.log('Console/page errors:', JSON.stringify(errors, null, 2));
      anyErrors = true;
    }
    if (offenders.length) anyOffenders = true;
  }

  if (anyOffenders || anyErrors) {
    console.log('\nFAIL: overflow sweep found issues');
    process.exit(1);
  }
  console.log('\nPASS: overflow sweep (no horizontal overflow at any viewport)');
  process.exit(0);
}

main().catch(e => {
  console.error('FAIL: overflow sweep crashed:', e);
  process.exit(1);
});
