'use strict';
// Regression test for the 20 stale entryCount badges fixed in the Taxonomy
// Explorer: the tree's "N current" badge is driven by node.entryCount
// (falsy = no badge at all), which had drifted out of sync with the actual
// number of current-entries records under several nodes. Complements
// structural/taxonomy-integrity.test.js, which checks the underlying data;
// this proves the badge actually renders correctly in the live UI.
//
// Each tree row renders as <div class="node-title"><span class="node-code">
// TAX-XX...</span><strong class="node-term">Name</strong>[<span class=
// "count-badge">N current</span>]</div> -- matching on node-code is exact,
// unlike matching on visible label text (which can collide, e.g. "Sourcetype
// Identity" containing the substring "Sourcetype").

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

async function badgeForCode(page, code) {
  return page.evaluate((c) => {
    const codeEl = [...document.querySelectorAll('.node-code')].find(el => el.textContent.trim() === c);
    if (!codeEl) return undefined; // node not found/rendered
    const badge = codeEl.parentElement.querySelector('.count-badge');
    return badge ? badge.textContent.trim() : null; // null = rendered, no badge
  }, code);
}

test('Required SIEM Event Type (TAX-03.01.01.01) shows its "1180 current" badge in the tree', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Search taxonomy terms').fill('Required SIEM Event Type');
    await page.waitForTimeout(400);

    const badge = await badgeForCode(page, 'TAX-03.01.01.01');
    assert.equal(badge, '1180 current');
    assert.deepEqual(pageErrors, []);
  });
});

test('Data Source (TAX-03.01.01) parent badge was also corrected: 39, not the stale 18', async () => {
  await withServerAndPage(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Search taxonomy terms').fill('Required SIEM Event Type');
    await page.waitForTimeout(400);

    const badge = await badgeForCode(page, 'TAX-03.01.01');
    assert.equal(badge, '39 current');
  });
});

test('Sourcetype Identity (TAX-04.11) shows no badge; its child Sourcetype (TAX-04.11.01) shows 25', async () => {
  await withServerAndPage(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Search taxonomy terms').fill('Sourcetype Identity');
    await page.waitForTimeout(400);

    const parentBadge = await badgeForCode(page, 'TAX-04.11');
    const childBadge = await badgeForCode(page, 'TAX-04.11.01');
    assert.equal(parentBadge, null, 'TAX-04.11 (Sourcetype Identity) should render with no badge (entryCount 0)');
    assert.equal(childBadge, '25 current', 'TAX-04.11.01 (Sourcetype) should keep its own 25 current badge');
  });
});
