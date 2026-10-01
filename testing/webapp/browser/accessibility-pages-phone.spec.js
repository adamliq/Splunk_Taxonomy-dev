'use strict';
// axe-core WCAG 2.1 A/AA check of the app chrome (menu closed and open), every page and the
// detection route at phone width (393px), where tables scroll sideways and several pages switch
// to their stacked layouts. Fails on any violation, listing the rule and the first few elements
// it found.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { openForAudit, auditAllPages } = require('../lib/axe-audit');

test('at phone width, the chrome and every page have no WCAG 2.1 A/AA violations', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await openForAudit(page, baseUrl, 393);
    assert.deepEqual(await auditAllPages(page), []);
    assert.deepEqual(pageErrors, []);
  });
});
