'use strict';
// axe-core WCAG 2.1 A/AA check of every reference article at desktop width (1400px). Fails on
// any violation, listing the rule and the first few elements it found.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { openForAudit, auditAllArticles } = require('../lib/axe-audit');

test('every reference article has no WCAG 2.1 A/AA violations', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await openForAudit(page, baseUrl, 1400);
    assert.deepEqual(await auditAllArticles(page), []);
    assert.deepEqual(pageErrors, []);
  });
});
