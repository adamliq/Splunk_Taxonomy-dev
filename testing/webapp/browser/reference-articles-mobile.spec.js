'use strict';
// Every reference article opens without errors and fits a phone screen. The overflow sweep in
// scripts/verify covers the sidebar pages only; long unbroken text inside an article (a
// $SPLUNK_HOME path, a limits.conf stanza name in the section links) widened the whole page.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

test('every reference article fits a 393px-wide screen', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const results = await page.evaluate(() => [...document.querySelectorAll('article.eccs-reference[id$="ReferenceView"]')].map(article => {
      const detail = article.id.replace(/ReferenceView$/, '').replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      showReferenceDetail(detail);
      return { id: article.id, shown: !article.hidden, overflow: document.documentElement.scrollWidth - innerWidth };
    }));
    assert.ok(results.length >= 101, `expected at least 101 articles, found ${results.length}`);
    assert.deepEqual(results.filter(r => !r.shown).map(r => r.id), [], 'articles that did not open');
    assert.deepEqual(results.filter(r => r.overflow > 5).map(r => `${r.id} (+${r.overflow}px)`), [], 'articles wider than the screen');
    assert.deepEqual(pageErrors, []);
  });
});
