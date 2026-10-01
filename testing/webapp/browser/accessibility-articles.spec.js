'use strict';
// axe-core WCAG 2.1 A/AA check of every reference article (opened the same way the sidebar
// and in-page links open them). Fails on any violation, listing the rule and elements.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

test('every reference article has no WCAG 2.1 A/AA violations', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await injectAxe(page);
    const details = await page.evaluate(() => [...document.querySelectorAll('article.eccs-reference[id$="ReferenceView"]')]
      .map(a => a.id.replace(/ReferenceView$/, '').replace(/[A-Z]/g, c => '-' + c.toLowerCase())));
    assert.ok(details.length >= 101, `expected at least 101 articles, found ${details.length}`);
    const failures = [];
    for (const detail of details) {
      await page.evaluate(d => showReferenceDetail(d), detail);
      for (const line of await auditVisible(page, 'article')) failures.push(`${detail}: ${line}`);
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(pageErrors, []);
  });
});
