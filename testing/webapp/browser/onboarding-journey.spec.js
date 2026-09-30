'use strict';
// Onboarding journey map: selecting a gate shows its outcomes in the inspector and emphasises
// its loop; links, arrow keys, layer toggles and search work; at phone width the route is a
// phase list and the inspector opens as a sheet.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const heading = page => page.$eval('#objInspector h3', el => el.textContent);

test('the journey map drives the inspector', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.textContent('#objStats'), '19 stages13 gates5 stop points11 loop-backs');
    assert.equal(await page.locator('#onboardingFlowMapWrap [data-item]').count(), 32);
    assert.equal(await page.locator('#onboardingFlowMapWrap .obj-loop').count(), 11);
    assert.equal(await page.locator('#onboardingFlowMapWrap .obj-stop').count(), 5);

    await page.click('#onboardingFlowMapWrap [data-item="gate-ob-quality"]');
    assert.equal(await heading(page), 'Quality gates pass?');
    const outcomes = await page.$$eval('#objInspector .obj-outcome', els => els.map(e => e.querySelector('.obj-badge').textContent));
    assert.deepEqual(outcomes, ['HOLD', 'PROCEED']);
    assert.equal(await page.$eval('.obj-loop[data-loop-from="gate-ob-quality"]', el => el.getAttribute('stroke-width')), '2.8');

    await page.click('#objInspector [data-item-link="ob-build"]');
    assert.equal(await heading(page), 'Engineering build');
    await page.keyboard.press('ArrowDown');
    assert.equal(await heading(page), 'Ingestion check');

    await page.click('[data-layer="loops"]');
    assert.equal(await page.locator('.obj-loop').count(), 0);
    await page.click('[data-layer="branch"]');
    assert.equal(await page.locator('#onboardingFlowMapWrap [data-item]').count(), 30);

    await page.fill('#objSearch', 'TAX-02.03');
    assert.equal(await page.textContent('#objSearchCount'), '2 matches');
    await page.press('#objSearch', 'Enter');
    assert.equal(await heading(page), 'Governance approval');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});

test('at phone width the journey is a phase list with an inspector sheet', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.obj-list-item').count(), 4, 'only the first phase is expanded');
    assert.equal(await page.$eval('#objInspector', el => el.classList.contains('obj-open')), false);
    await page.click('.obj-list-item[data-item="gate-ob-viability"]');
    assert.equal(await page.$eval('#objInspector', el => el.classList.contains('obj-open')), true);
    assert.equal(await heading(page), 'Viability Decision');
    await page.click('.obj-sheet-close');
    assert.equal(await page.$eval('#objInspector', el => el.classList.contains('obj-open')), false);
    await page.click('.obj-list-phase[data-phase="C"]');
    assert.equal(await page.$eval('.obj-list-item', el => el.textContent), 'Engineering build');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});

test('the detection lifecycle route and its links to the log source journey', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.click('#objRoutes [data-route="detection"]');
    assert.equal(await page.textContent('#objStats'), '14 stages5 gates2 stop points8 loop-backs6 links to onboarding');
    assert.equal(await page.locator('#onboardingFlowMapWrap [data-item]').count(), 19);
    assert.equal(await page.locator('#onboardingFlowMapWrap .obj-rail').count(), 6);
    assert.equal(await page.locator('[data-layer="branch"]').isHidden(), true);

    await page.click('#onboardingFlowMapWrap [data-item="gate-dl-review"]');
    assert.equal(await heading(page), 'Detection Quality Gate');
    assert.equal(await page.locator('#objInspector .obj-check li').count(), 19);

    await page.click('#onboardingFlowMapWrap [data-item="gate-dl-data"]');
    await page.click('#objInspector [data-route-link="ob-candidate"]');
    assert.equal(await page.getAttribute('#objRoutes [data-route="onboarding"]', 'aria-selected'), 'true');
    assert.equal(await heading(page), 'Candidate log source identified');

    await page.click('#onboardingFlowMapWrap [data-item="ob-detection"]');
    await page.click('#objInspector [data-detection-link="dl-analytic"]');
    assert.equal(await page.getAttribute('#objRoutes [data-route="detection"]', 'aria-selected'), 'true');
    assert.equal(await heading(page), 'Detection analytic & rule');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});
