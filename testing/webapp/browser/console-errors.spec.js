'use strict';
// Smoke test: load every primary tab and assert nothing throws. This is
// intentionally broad and shallow -- it exists to catch the class of
// mistake none of the narrower tests would (a typo in a template literal,
// a null-ref in a rarely-hit render path) rather than to assert specific
// behaviour. Full per-article error coverage for the Reference tab lives in
// reference-navigation.spec.js, which already asserts pageErrors is empty
// while exercising all 34 detail articles.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

// Several sidebar buttons live inside a collapsible group (.side-item[data-group] >
// .side-sub) that starts closed, so a plain page.click() on them times out waiting for
// visibility. Expand the button's own group first, exactly as a real user would, rather
// than reaching into the hidden .side-sub directly. Returns false if the button doesn't
// exist at all (a stale/renamed id), true otherwise.
async function openSidebarPage(page, buttonId) {
  const btn = await page.$(`#${buttonId}`);
  if (!btn) return false;
  if (!(await btn.isVisible())) {
    await page.evaluate(id => {
      const el = document.getElementById(id);
      const trigger = el && el.closest('.side-item[data-group]')?.querySelector('.side-group-trigger');
      if (trigger) trigger.click();
    }, buttonId);
    await page.waitForTimeout(150);
  }
  await btn.click();
  return true;
}

const TABS = [
  { name: 'Info', buttonId: 'showInfoPage' },
  { name: 'Onboarding flow', buttonId: 'showOnboardingPage' },
  { name: 'Taxonomy explorer', buttonId: 'showTaxonomyPage' },
  { name: 'Assessments', buttonId: 'showAssessmentsPage' },
  { name: 'Sizing calculator', buttonId: 'showSizingPage' },
  { name: 'Prompt library', buttonId: 'showPromptLibraryPage' },
  { name: 'Framework', buttonId: 'showCmeiPage' },
  { name: 'Data source catalogue', buttonId: 'showCataloguePage' },
  { name: 'Logging patterns table', buttonId: 'showPatternsPage' },
  { name: 'Health checks table', buttonId: 'showHealthChecksPage' },
  { name: 'Companion tools', buttonId: 'showExternalToolsPage' },
  // No 'Reference' entry: the sidebar's "Reference" item is a group trigger with no page
  // (and no button id) of its own -- reference-navigation.spec.js already asserts
  // pageErrors is empty while exercising all of its articles individually.
];

test('every primary tab loads without a page error', { timeout: 60000 }, async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const missingButtons = [];
    for (const tab of TABS) {
      const opened = await openSidebarPage(page, tab.buttonId);
      if (!opened) { missingButtons.push(tab.name); continue; }
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

    // Exercises the actual click->button->showReferenceDetail wiring (not
    // just the function directly) for a representative sample, including
    // the two reference sections added this session. Each key's real (plain
    // "Open detailed reference") entry-point button lives on a specific page --
    // not all four are on the same one.
    const sampleKeys = [
      { key: 'username-format', sourceButtonId: 'showStandardsReferencesPage' },
      { key: 'datetime-format', sourceButtonId: 'showStandardsReferencesPage' },
      { key: 'log-format-parse', sourceButtonId: 'showStandardsReferencesPage' },
      { key: 'log-format-quality', sourceButtonId: 'showAssessmentMethodsPage' },
    ];
    for (const { key, sourceButtonId } of sampleKeys) {
      // showReferenceDetail() opens the requested article inside a shared, generic hub page
      // (id="referencePage"), and the back-link below returns to *that* hub -- not back to
      // wherever the entry-point button actually lives. Re-navigate to the source page before
      // every iteration rather than assuming the previous iteration's "back" landed on it.
      await openSidebarPage(page, sourceButtonId);
      await page.waitForTimeout(150);
      // Concepts & definitions renders its own button for the same detailView key into its
      // (currently hidden) page, so the plain selector can resolve to more than one element
      // -- :visible scopes the click to the one actually on screen, same as the existing
      // back-link scoping below.
      await page.click(`[data-open-reference-detail="${key}"]:visible`);
      await page.waitForTimeout(150);
      const opened = await page.evaluate(k => {
        const cfg = { 'username-format': 'usernameFormatReferenceView', 'datetime-format': 'datetimeFormatReferenceView',
          'log-format-parse': 'logFormatParseReferenceView', 'log-format-quality': 'logFormatQualityReferenceView' };
        const el = document.getElementById(cfg[k]);
        return el ? !el.hidden : false;
      }, key);
      assert.equal(opened, true, `clicking the entry-point button for "${key}" did not open its article`);
      // 34 back-links exist (one per article); only the currently-open
      // article's is visible, so scope the click to it explicitly rather
      // than clicking whichever one Playwright's plain selector resolves
      // first (which is often a different, hidden article's link).
      await page.click('article.eccs-reference:not([hidden]) [data-back-to-references]');
      await page.waitForTimeout(150);
    }

    assert.deepEqual(pageErrors, []);
  });
});

test('Sizing calculator: on-prem and cloud toggle, calculate, produce correct results with no errors', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await openSidebarPage(page, 'showSizingPage');
    await page.waitForTimeout(200);

    // Default on-prem inputs: 100 GB/day, 90 days searchable, RF=1, SF=1
    // -> 100 * 90 * 0.5 = 4500 GB = 4.39 TB (the standard 50% compression baseline).
    await page.click('#calculateIndexSizing');
    await page.waitForTimeout(150);
    const onPremText = await page.evaluate(() => document.getElementById('sizingCalculatorResult').textContent);
    assert.match(onPremText, /4\.39 TB/, 'default on-prem searchable-tier storage should be 4.39 TB');
    assert.match(onPremText, /Hot \+ Warm \+ Cold \(searchable\)/);
    assert.match(onPremText, /Recommended indexer count: 1/);

    // RF=3, SF=2 -> per-copy ratio 3*0.15 + 2*0.35 = 1.15 -> 100*90*1.15 = 10350 GB = 10.11 TB.
    await page.fill('#sizingRF', '3');
    await page.fill('#sizingSF', '2');
    await page.click('#calculateIndexSizing');
    await page.waitForTimeout(150);
    const clusteredText = await page.evaluate(() => document.getElementById('sizingCalculatorResult').textContent);
    assert.match(clusteredText, /10\.11 TB/, 'RF=3/SF=2 searchable-tier storage should be 10.11 TB');

    // Compression preset dropdown populates the raw/tsidx percentage fields,
    // and those fields drive the formula (not a hardcoded 15/35 split).
    // Endpoint/EDR preset is 18% raw + 38% tsidx = 56% total; back to RF=1/SF=1
    // -> 100 * 90 * 0.56 = 5040 GB = 4.92 TB.
    await page.fill('#sizingRF', '1');
    await page.fill('#sizingSF', '1');
    await page.selectOption('#sizingSourcetypePreset', '18,38');
    const rawAfterPreset = await page.inputValue('#sizingRawPct');
    const tsidxAfterPreset = await page.inputValue('#sizingTsidxPct');
    assert.equal(rawAfterPreset, '18', 'Endpoint/EDR preset should set raw % to 18');
    assert.equal(tsidxAfterPreset, '38', 'Endpoint/EDR preset should set tsidx % to 38');
    await page.click('#calculateIndexSizing');
    await page.waitForTimeout(150);
    const presetText = await page.evaluate(() => document.getElementById('sizingCalculatorResult').textContent);
    assert.match(presetText, /4\.92 TB/, 'Endpoint/EDR preset (18%+38%) searchable-tier storage should be 4.92 TB');

    // Manually overriding raw/tsidx directly (not via the preset) also works:
    // 10% + 30% = 40% total -> 100*90*0.4 = 3600 GB = 3.52 TB.
    await page.fill('#sizingRawPct', '10');
    await page.fill('#sizingTsidxPct', '30');
    await page.click('#calculateIndexSizing');
    await page.waitForTimeout(150);
    const manualText = await page.evaluate(() => document.getElementById('sizingCalculatorResult').textContent);
    assert.match(manualText, /3\.52 TB/, 'manually-overridden 10%+30% compression should compute 3.52 TB');

    // Switching to Cloud must hide the on-prem-only clustering section,
    // relabel tiers to Splunk Cloud's Dynamic Data Active / Self Storage
    // terms, and still respect the currently-configured 10%/30% compression.
    await page.click('#sizingDeployCloud');
    await page.waitForTimeout(150);
    const clusterHidden = await page.evaluate(() => document.getElementById('sizingClusterSection').hidden);
    assert.equal(clusterHidden, true, 'indexer clustering section must be hidden in Cloud mode');
    await page.click('#calculateIndexSizing');
    await page.waitForTimeout(150);
    const cloudText = await page.evaluate(() => document.getElementById('sizingCalculatorResult').textContent);
    assert.match(cloudText, /Dynamic Data Active \(searchable\)/);
    assert.match(cloudText, /Dynamic Data Self Storage \(archive\)/);
    assert.doesNotMatch(cloudText, /Hot \+ Warm \+ Cold/, 'on-prem tier terminology must not leak into Cloud mode results');
    assert.match(cloudText, /3\.52 TB/, 'Cloud mode should also use the configured 10%+30% compression');

    assert.deepEqual(pageErrors, []);
  });
});
