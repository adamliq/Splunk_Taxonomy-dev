'use strict';
// Links between the onboarding journey map and the Log assessment lifecycle page: shareable
// URLs on both, cross-links in both directions, global search results for both, "Show on map"
// on the onboarding detail cards, and the lifecycle page's "Show all details" switch.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const text = (page, sel) => page.$eval(sel, el => el.textContent);

test('shareable links restore the selection on both pages, and reject unknown values', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle?domain=6`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await text(page, '#lalDetail h3'), 'Fingerprinting');
    await page.click('.lal-layer[data-lal-layer="L4"]');
    assert.equal(await page.evaluate(() => location.hash), '#log-assessment-lifecycle?layer=L4');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await text(page, '#lalDetail h3'), 'Data Engineering');

    await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle?domain=99`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), '#log-assessment-lifecycle');

    await page.goto(`${baseUrl}/index.html#onboarding-flow?route=detection&step=gate-dl-review`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.getAttribute('#objRoutes [data-route="detection"]', 'aria-pressed'), 'true');
    assert.equal(await text(page, '#objInspector h3'), 'Detection Quality Gate');
    await page.click('#objRoutes [data-route="onboarding"]');
    await page.click('#onboardingFlowMapWrap [data-item="ob-quality"]');
    assert.equal(await page.evaluate(() => location.hash), '#onboarding-flow?step=ob-quality');
    assert.deepEqual(pageErrors, []);
  });
});

test('the lifecycle page and the onboarding journey link to each other', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle?layer=L4`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.click('#lalDetail [data-lal-journey="ob-build"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), '#onboarding-flow?step=ob-build');
    assert.equal(await text(page, '#objInspector h3'), 'Engineering build');
    await page.click('#objInspector [data-lal-open="L4"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => location.hash), '#log-assessment-lifecycle?layer=L4');
    assert.equal(await text(page, '#lalDetail h3'), 'Data Engineering');
    assert.deepEqual(pageErrors, []);
  });
});

test('global search finds lifecycle domains and journey steps, and detail cards show their step on the map', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.fill('#globalSearchInput', 'fingerprinting');
    await page.waitForTimeout(300);
    assert.match(await text(page, '#globalSearchResults'), /Log assessment lifecycle/);
    await page.fill('#globalSearchInput', 'Detection Quality Gate');
    await page.waitForTimeout(300);
    assert.match(await text(page, '#globalSearchResults'), /Onboarding & detection journeys/);
    await page.fill('#globalSearchInput', '');

    assert.equal(await page.locator('.ob-show-on-map').count(), 51);
    // The detail is folded by phase; governance approval is in phase D.
    await page.click('.ob-fold[data-fold="onboarding:D"]');
    await page.click('#ob-governance .ob-show-on-map');
    await page.waitForTimeout(900);
    assert.equal(await text(page, '#objInspector h3'), 'Governance approval');
    assert.deepEqual(pageErrors, []);
  });
});

test('"Show all details" lists every layer and domain; the wheel has an icon per domain', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#lalWheel .lal-domain-icon').count(), 10);
    assert.equal(await page.isVisible('#lalLayersGlance'), false);
    await page.click('#lalShowAll');
    assert.equal(await page.isVisible('#lalLayersGlance'), true);
    assert.equal(await page.locator('#lalLayersGlance tbody tr').count(), 5);
    assert.equal(await page.locator('.lal-glance-domain').count(), 10);
    assert.equal(await page.locator('#lalFlows .lal-flow-raw').count(), 0, 'arrows that would cross the tables are left out');
    assert.deepEqual(pageErrors, []);
  });
});
