'use strict';
// Smoke test: load every primary tab and assert nothing throws. This is
// intentionally broad and shallow -- it exists to catch the class of
// mistake none of the narrower tests would (a typo in a template literal,
// a null-ref in a rarely-hit render path) rather than to assert specific
// behaviour. Full per-article error coverage for the Reference tab lives in
// reference-navigation.spec.js, which already asserts pageErrors is empty
// while exercising all 29 detail articles.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const TABS = [
  { name: 'Info', buttonId: 'showInfoPage' },
  { name: 'Onboarding flow', buttonId: 'showOnboardingPage' },
  { name: 'Taxonomy explorer', buttonId: 'showTaxonomyPage' },
  { name: 'Assessments', buttonId: 'showAssessmentsPage' },
  { name: 'Reference', buttonId: 'showReferencePage' },
  { name: 'Prompt library', buttonId: 'showPromptLibraryPage' },
  { name: 'Framework', buttonId: 'showCmeiPage' },
  { name: 'Data source catalogue', buttonId: 'showCataloguePage' },
  { name: 'Logging patterns table', buttonId: 'showPatternsPage' },
  { name: 'Health checks table', buttonId: 'showHealthChecksPage' },
];

test('every primary tab loads without a page error', { timeout: 60000 }, async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const missingButtons = [];
    for (const tab of TABS) {
      const btn = await page.$(`#${tab.buttonId}`);
      if (!btn) { missingButtons.push(tab.name); continue; }
      await btn.click();
      await page.waitForTimeout(250);
    }

    assert.deepEqual(missingButtons, [], `tab buttons not found (id may have changed): ${missingButtons.join(', ')}`);
    assert.deepEqual(pageErrors, [], `page errors while clicking through tabs:\n${pageErrors.join('\n')}`);
  });
});

test('Reference tab: a handful of real entry-point buttons open their article without throwing', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.click('#showReferencePage');
    await page.waitForTimeout(300);

    // Exercises the actual click->button->showReferenceDetail wiring (not
    // just the function directly) for a representative sample, including
    // the two reference sections added this session.
    const sampleKeys = ['username-format', 'datetime-format', 'log-format-parse', 'eccs'];
    for (const key of sampleKeys) {
      await page.click(`[data-open-reference-detail="${key}"]`);
      await page.waitForTimeout(150);
      const opened = await page.evaluate(k => {
        const cfg = { 'username-format': 'usernameFormatReferenceView', 'datetime-format': 'datetimeFormatReferenceView',
          'log-format-parse': 'logFormatParseReferenceView', 'eccs': 'eccsReferenceView' };
        const el = document.getElementById(cfg[k]);
        return el ? !el.hidden : false;
      }, key);
      assert.equal(opened, true, `clicking the entry-point button for "${key}" did not open its article`);
      // 29 back-links exist (one per article); only the currently-open
      // article's is visible, so scope the click to it explicitly rather
      // than clicking whichever one Playwright's plain selector resolves
      // first (which is often a different, hidden article's link).
      await page.click('article.eccs-reference:not([hidden]) [data-back-to-references]');
      await page.waitForTimeout(150);
    }

    assert.deepEqual(pageErrors, []);
  });
});
