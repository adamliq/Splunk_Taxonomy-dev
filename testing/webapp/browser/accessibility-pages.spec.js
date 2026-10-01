'use strict';
// axe-core WCAG 2.1 A/AA check of the app chrome and every sidebar page, plus the journey
// map's second route. Fails on any violation, listing the rule and the first few elements.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

test('the sidebar, header and every page have no WCAG 2.1 A/AA violations', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await injectAxe(page);
    const failures = [];
    const check = async (label, scope) => {
      for (const line of await auditVisible(page, scope)) failures.push(`${label}: ${line}`);
    };
    await check('chrome', 'chrome');
    const pages = await page.evaluate(() => Object.keys(pageTabs).filter(k => pageTabs[k]));
    assert.ok(pages.length >= 31, `expected at least 31 pages, found ${pages.length}`);
    for (const name of pages) {
      await page.evaluate(n => setActivePage(n), name);
      await page.waitForTimeout(150);
      await check(name, 'page');
    }
    await page.evaluate(() => { setActivePage('onboarding'); document.querySelector('#objRoutes [data-route="detection"]').click(); });
    await page.waitForTimeout(150);
    await check('onboarding (detection route)', 'page');
    assert.deepEqual(failures, []);
    assert.deepEqual(pageErrors, []);
  });
});
