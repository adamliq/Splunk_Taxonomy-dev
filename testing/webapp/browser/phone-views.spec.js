'use strict';
// Phones: the ports matrix opens on its flow table (cards) rather than the 53-column grid, while a
// link can still ask for either view and desktop keeps the grid; the S3 calculator's architecture
// is a drawn diagram that fits the screen (no sideways scroll, outputs side by side); and on the
// smallest phones (320px) the header fits on every page.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const ports = page => page.evaluate(() => ({
  hash: location.hash, flows: !document.getElementById('portsMatrixFlowSchemaView').hidden,
  sideways: [...document.querySelectorAll('#portsMatrixPage *')].some(e => e.getClientRects().length && /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 4),
}));

test('ports matrix: flow table by default on a phone, grid on desktop, links choose either', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const [width, hash, flows, written] of [
      [393, '#ports-matrix', true, '#ports-matrix?view=flows'],
      [393, '#ports-matrix?view=grid', false, '#ports-matrix?view=grid'],
      [1400, '#ports-matrix', false, '#ports-matrix'],
      [1400, '#ports-matrix?view=flows', true, '#ports-matrix?view=flows'],
    ]) {
      await page.setViewportSize({ width, height: 852 });
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/index.html${hash}`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const r = await ports(page);
      assert.equal(r.flows, flows, `${width}px ${hash}`);
      assert.equal(r.hash, written, `${width}px ${hash} link`);
      if (width === 393 && flows) assert.equal(r.sideways, false, 'phone flow table scrolls sideways');
    }
    // From the sidebar on a phone, too; and switching to the grid writes the link.
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('about:blank');
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.evaluate(() => setActivePage('portsMatrix'));
    assert.equal((await ports(page)).flows, true);
    assert.equal(await page.evaluate(() => document.querySelector('#portsMatrixFlowSchemaView table').classList.contains('phone-cards')), true);
    await page.click('#portsViewGridBtn');
    assert.equal(await page.evaluate(() => location.hash), '#ports-matrix?view=grid');
    assert.deepEqual(pageErrors, []);
  });
});

test('S3 calculator architecture diagram fits a phone; header fits at 320px', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [1400, 393]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/index.html#s3-calculator`, { waitUntil: 'load' });
      await page.evaluate(() => { const d = [...document.querySelectorAll('#s3c-overview details')].find(x => x.querySelector('summary').textContent === 'Architecture diagram'); d.open = true; d.scrollIntoView(); });
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const f = document.querySelector('.s3c-arch'), [splunk, s3] = [...f.querySelectorAll('.s3c-arch-branch')].map(b => b.getBoundingClientRect());
        return {
          pre: !!document.querySelector('#s3CalcPage pre'), sideways: f.scrollWidth > f.clientWidth + 1, overflow: document.documentElement.scrollWidth - innerWidth,
          sideBySide: Math.abs(splunk.top - s3.top) < 2 && splunk.right <= s3.left,
          names: [...f.querySelectorAll('.s3c-arch-node strong')].map(s => s.textContent),
          small: [...f.querySelectorAll('strong, small, li, span')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 11).length,
        };
      });
      assert.deepEqual(r.names, ['Data Source', 'Ingest Processor', 'Splunk Cloud', 'Amazon S3', 'Federated Search']);
      assert.ok(!r.pre && !r.sideways && r.overflow === 0 && r.sideBySide && r.small === 0, `${width}px ${JSON.stringify(r)}`);
      await injectAxe(page);
      assert.deepEqual(await auditVisible(page, 'page'), [], `${width}px`);
    }
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    const pages = await page.evaluate(() => Object.keys(pageViews));
    for (const name of pages) {
      await page.evaluate(n => setActivePage(n, false), name);
      await page.waitForTimeout(60);
      // The same 5px tolerance as the overflow sweep (a long command path on Splunk bin is 2px).
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 5, `${name} at 320px`);
    }
    assert.deepEqual(pageErrors, []);
  });
});
