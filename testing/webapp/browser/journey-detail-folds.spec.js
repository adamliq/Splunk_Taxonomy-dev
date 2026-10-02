'use strict';
// Onboarding flow: the stage and gate detail below the map folds under a heading per phase,
// closed at first, so the page is a fraction of its unfolded length. Headings and "Expand all"
// open it; "Open full stage detail" in the inspector opens its phase; print shows every card.
// On a phone the phase stepper is hidden (the phase list does that job) and the header fits.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const shown = (page, id) => page.evaluate(id => getComputedStyle(document.getElementById(id)).display !== 'none', id);

test('detail cards fold by phase and open from headings, Expand all and the inspector', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    const heads = await page.evaluate(() => [...document.querySelectorAll('.ob-fold')].map(h => [h.dataset.fold, h.getAttribute('aria-expanded'), h.textContent]));
    assert.equal(heads.length, 12);
    assert.ok(heads.every(h => h[1] === 'false'));
    assert.match(heads[0][2], /^AIntake & Viability2 stages · 2 gates/);
    assert.match(heads.find(h => h[0] === 'detection:C')[2], /3 stages(?! · 0)/, 'no "0 gates"');
    assert.equal(await shown(page, 'ob-candidate'), false);
    assert.ok(await page.evaluate(() => document.getElementById('onboardingPage').scrollHeight) < 5000, 'folded page is short');

    await page.click('.ob-fold[data-fold="onboarding:C"]');
    assert.equal(await shown(page, 'ob-build'), true);
    assert.equal(await shown(page, 'ob-candidate'), false);
    await page.click('.ob-fold[data-fold="onboarding:C"]');
    assert.equal(await shown(page, 'ob-build'), false);

    await page.click('.ob-fold-all[data-fold-all="onboarding"]');
    assert.equal(await page.textContent('.ob-fold-all[data-fold-all="onboarding"]'), 'Collapse all');
    assert.equal(await page.locator('[data-fold-in^="onboarding:"].ob-folded').count(), 0);
    assert.equal(await page.locator('[data-fold-in^="detection:"].ob-folded').count() > 0, true, 'the other route stays folded');
    await page.click('.ob-fold-all[data-fold-all="onboarding"]');
    assert.equal(await shown(page, 'ob-golive'), false);

    // "Open full stage detail" opens the phase and scrolls to the card.
    await page.click('#onboardingFlowMapWrap [data-item="ob-golive"]');
    await page.click('#objInspector [data-scroll]');
    await page.waitForTimeout(1000);
    assert.equal(await shown(page, 'ob-golive'), true);
    assert.equal(await page.getAttribute('.ob-fold[data-fold="onboarding:E"]', 'aria-expanded'), 'true');
    const top = await page.evaluate(() => document.getElementById('ob-golive').getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 300, `card top ${top}`);

    // Print shows everything.
    await page.click('.ob-fold[data-fold="onboarding:E"]');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await shown(page, 'ob-golive'), true);
    assert.equal(await shown(page, 'ob-candidate'), true);
    await page.emulateMedia({ media: 'screen' });
    assert.deepEqual(pageErrors, []);
  });
});

test('at phone width the journey header fits its card and has no phase stepper', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const top = document.querySelector('.obj-top'), box = top.getBoundingClientRect(), right = box.right - parseFloat(getComputedStyle(top).paddingRight);
      return {
        stepper: getComputedStyle(document.getElementById('objStepper')).display,
        wider: ['#objRoutes', '.obj-search', '.obj-toggles'].filter(s => document.querySelector(s).getBoundingClientRect().right > right + 1),
        overflow: document.documentElement.scrollWidth - innerWidth,
        height: document.getElementById('onboardingPage').scrollHeight,
      };
    });
    assert.equal(m.stepper, 'none');
    assert.deepEqual(m.wider, []);
    assert.equal(m.overflow, 0);
    assert.ok(m.height < 5000, `page height ${m.height}`);
    assert.deepEqual(pageErrors, []);
  });
});
