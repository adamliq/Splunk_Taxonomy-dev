'use strict';
// Info page: the release line matches the header badge, the at-a-glance tiles count the app's
// own data, every card and step opens a real page (two land on a part of it), each grid fills
// its rows at desktop, tablet and phone widths, and the phone layout drops the logo -- without
// changing Companion tools, which shares the card classes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const rowCounts = page => page.evaluate(() => Object.fromEntries(['.info-glance', '.info-grid', '.info-workflow', '.info-action-grid', '.info-output-grid'].map(sel => {
  const per = {};
  [...document.querySelector('#infoPage ' + sel).children].forEach(c => { const t = Math.round(c.getBoundingClientRect().top); per[t] = (per[t] || 0) + 1; });
  return [sel, Object.values(per)];
})));

test('release line, live counts and links', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    assert.equal((await page.textContent('#infoVersion')).trim(), (await page.textContent('#appVersion')).trim());
    assert.match(await page.textContent('#infoVersion'), /^v\d{4}\.\d{2}\.\d{2} · build \d+$/);

    const glance = await page.evaluate(() => ({
      tiles: [...document.querySelectorAll('.info-glance-tile')].map(t => [t.querySelector('b').textContent, t.dataset.glancePage]),
      expect: [nodes.filter(n => n.nodeType === 'taxonomy').length, healthCheckTableData.length, loggingPatternTableData.length, sourceCatalogueRecords.length,
        document.querySelectorAll('article.eccs-reference[id$="ReferenceView"]').length, onboardingJourney.models.onboarding.items.length].map(n => n.toLocaleString('en')),
    }));
    assert.deepEqual(glance.tiles.map(t => t[0]), glance.expect);

    const targets = await page.evaluate(() => [...document.querySelectorAll('#infoPage [data-info-page], #infoPage [data-glance-page]')].map(b => b.dataset.infoPage || b.dataset.glancePage));
    assert.ok(targets.length >= 28, `expected 28+ links, found ${targets.length}`);
    for (const [i, target] of targets.entries()) {
      await page.evaluate(() => setActivePage('info'));
      await page.locator('#infoPage [data-info-page], #infoPage [data-glance-page]').nth(i).click();
      assert.equal(await page.evaluate(() => currentActivePageKey), target, `link ${i}`);
    }

    // "Review complexity" opens the calculator's complexity section; "Track your sources" the tracker.
    await page.evaluate(() => setActivePage('info'));
    await page.click('.info-workflow-link[data-info-focus]');
    await page.waitForTimeout(1200);
    const section = await page.evaluate(() => { const d = document.querySelector('.calc-nested-complexity-section'); return { open: d.open, outer: d.parentElement.closest('details').open, top: d.getBoundingClientRect().top }; });
    assert.ok(section.open && section.outer && Math.abs(section.top) < 200, JSON.stringify(section));
    await page.evaluate(() => setActivePage('info'));
    await page.click('[data-info-focus="#objTracker"]');
    await page.waitForTimeout(1200);
    assert.equal(await page.isVisible('#objTracker'), true);
    assert.equal(await page.getAttribute('#objTrackerBtn', 'aria-expanded'), 'true');
    assert.deepEqual(pageErrors, []);
  });
});

test('every grid fills its rows at desktop, tablet and phone widths', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [1400, 1100, 900, 393]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
      const rows = await rowCounts(page);
      for (const [sel, counts] of Object.entries(rows)) {
        assert.ok(counts.every(n => n === counts[0]), `${width}px ${sel}: rows of ${counts.join('+')}`);
      }
      // Card titles sit at the top of their card, however much text the neighbours have.
      const offsets = await page.evaluate(() => [...document.querySelectorAll('#infoPage .info-grid > *, #infoPage .info-action-grid > *')].map(c => Math.round(c.querySelector('strong').getBoundingClientRect().top - c.getBoundingClientRect().top)));
      assert.equal(new Set(offsets).size, 1, `${width}px title offsets ${[...new Set(offsets)]}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      if (width === 393) {
        assert.equal(await page.isVisible('.info-logo-mark'), false);
        assert.ok(await page.evaluate(() => document.getElementById('infoPage').scrollHeight) < 3200);
      }
      // Companion tools shares the card classes; the Info page's column counts must not reach it.
      const tools = await page.evaluate(() => { setActivePage('externalTools'); const g = document.querySelector('#externalToolsPage .info-action-grid'); return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, desc: getComputedStyle(g.querySelector('.info-action-card span')).display }; });
      assert.equal(tools.desc, 'block');
      if (width === 393) assert.equal(tools.cols, 1);
    }
    assert.deepEqual(pageErrors, []);
  });
});
