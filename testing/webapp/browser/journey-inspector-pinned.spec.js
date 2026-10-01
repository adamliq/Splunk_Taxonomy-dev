'use strict';
// Onboarding journey, desktop: the inspector stays pinned beside the map, so wherever the
// selected station is, both it and the top of the inspector are on screen -- including the last
// gate, where the inspector meets the bottom of the map, and after "Show on map" from a detail
// card. Also: TAX codes inside "Feeds in" text stay inline chips.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const onScreen = (page, id) => page.evaluate(id => {
  const item = document.querySelector(`#onboardingFlowMapWrap svg [data-item="${id}"]`).getBoundingClientRect();
  const title = document.querySelector('#objInspector h3').getBoundingClientRect();
  const seen = r => r.top >= 0 && r.bottom <= innerHeight;
  return { item: seen(item), title: seen(title), titleText: document.querySelector('#objInspector h3').textContent };
}, id);

test('the selected station and the inspector title are both on screen', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('objInspector')).position), 'sticky');

    for (const id of ['ob-review90', 'gate-ob-review90']) {
      await page.click(`#onboardingFlowMapWrap svg [data-item="${id}"]`);
      await page.waitForTimeout(900);
      const seen = await onScreen(page, id);
      assert.ok(seen.item && seen.title, `${id}: ${JSON.stringify(seen)}`);
    }
    assert.equal((await onScreen(page, 'gate-ob-review90')).titleText, 'Retain, Filter or Retire Decision');

    // A scrolled inspector starts at its top for the next selection.
    await page.evaluate(() => { document.getElementById('objInspector').scrollTop = 300; });
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getElementById('objInspector').scrollTop), 0);

    // "Show on map" from a detail card far below goes to that station.
    await page.evaluate(() => document.querySelector('#ob-golive .ob-show-on-map').click());
    await page.waitForTimeout(1600);
    const golive = await onScreen(page, 'ob-golive');
    assert.ok(golive.item && golive.title, JSON.stringify(golive));

    // The TAX popover sits just under its chip.
    await page.hover('#objInspector [data-tax]');
    const gap = await page.evaluate(() => document.getElementById('objTaxPop').getBoundingClientRect().top - document.querySelector('#objInspector [data-tax]').getBoundingClientRect().bottom);
    assert.ok(gap >= 0 && gap <= 10, `popover gap ${gap}`);
    assert.deepEqual(pageErrors, []);
  });
});

test('TAX codes inside "Feeds in" text are inline chips, not full-width bars', async () => {
  await withServerAndPage(async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    const tags = await page.evaluate(() => [...document.querySelectorAll('#onboardingPage .onboarding-feed > div > span .assessment-tag')]
      .map(t => ({ text: t.textContent, display: getComputedStyle(t).display, ratio: t.getBoundingClientRect().width / t.parentElement.getBoundingClientRect().width })));
    assert.ok(tags.length >= 5, `expected feed TAX tags, found ${tags.length}`);
    assert.deepEqual(tags.filter(t => t.display === 'block' || t.ratio > 0.6).map(t => t.text), []);
  });
});
