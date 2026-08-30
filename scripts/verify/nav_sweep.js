// Nav sweep: click every sidebar tab and confirm zero page/console errors.
//
// Walks `.app-sidebar .page-tab` in document order, opening its parent
// `.side-item`'s `.side-group-trigger` first if the group is collapsed
// (mirrors how a real user would reach a tab inside a collapsed group),
// then clicks the tab and watches for `pageerror` / console `error` events.
//
// Usage:
//   node scripts/verify/nav_sweep.js [path/to/index.html]
//
// Exit code 0 if every tab opens with zero errors, 1 otherwise.

const path = require('path');

function resolveChromium() {
  const { chromium } = require('playwright');
  return chromium;
}

async function main() {
  const chromium = resolveChromium();
  const htmlPath = process.argv[2] || path.resolve(__dirname, '..', '..', 'index.html');
  const launchOpts = {};
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

  const fileUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const tabCount = await page.$$eval('.app-sidebar .page-tab', els => els.length);
  console.log('Tab count:', tabCount);

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
    if (opened) await page.waitForTimeout(150);
    await tab.click();
    await page.waitForTimeout(400);
    console.log('  clicked:', txt);
  }

  await browser.close();

  console.log('Total errors after sweep:', errors.length);
  if (errors.length) {
    console.log(errors.slice(0, 20).join('\n'));
    process.exit(1);
  }
  console.log('PASS: nav sweep');
  process.exit(0);
}

main().catch(e => {
  console.error('FAIL: nav sweep crashed:', e);
  process.exit(1);
});
