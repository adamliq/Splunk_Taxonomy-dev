'use strict';
// Log assessment lifecycle at phone width: the stages table becomes stacked cards (no scroll
// box inside the page), the domain list never splits a word, and the pyramid drops its side
// labels for a readable list below it. Crossing the breakpoint redraws the pyramid and keeps
// the selection.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

test('the lifecycle page reads without inner scrolling or tiny text on a phone', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const wrap = document.querySelector('.lal-stages-wrap');
      const rows = [...document.querySelectorAll('#lalTable tr.lal-row')];
      // A word split across two lines has two client rects.
      const splitWords = item => [...item.childNodes].filter(n => n.nodeType === 3).flatMap(node => {
        const out = [];
        for (const m of node.textContent.matchAll(/\S+/g)) {
          const r = document.createRange(); r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
          if (r.getClientRects().length > 1) out.push(m[0]);
        }
        return out;
      });
      const names = [...document.querySelectorAll('.lal-dl-item')].flatMap(splitWords);
      return {
        innerScroll: wrap.scrollHeight > wrap.clientHeight + 1 || wrap.scrollWidth > wrap.clientWidth + 1,
        rowsVisible: rows.length, rowWidths: rows.every(r => r.getBoundingClientRect().width <= wrap.clientWidth + 1),
        labelled: rows.every(r => r.querySelector('td[data-label="Key outputs"]') && r.querySelector('td[data-label="Key terms / assessments"]')),
        tinyPyramidText: [...document.querySelectorAll('#lalPyramid svg text')].filter(t => t.getBoundingClientRect().height < 9).map(t => t.textContent),
        lenses: [...document.querySelectorAll('.lal-pyr-lenses li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
        names, overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    assert.equal(m.innerScroll, false, 'stages table scrolls inside the page');
    assert.equal(m.rowsVisible, 6);
    assert.ok(m.rowWidths, 'a stage card is wider than the page');
    assert.ok(m.labelled, 'stage cards lost their column labels');
    assert.deepEqual(m.tinyPyramidText, []);
    assert.equal(m.lenses.length, 5);
    assert.match(m.lenses[1], /ANALYSIS Stage 3/);
    assert.deepEqual(m.names, [], 'domain names split mid-word');
    assert.equal(m.overflow, 0);

    // "Show all details" keeps its own table inside the page width.
    await page.click('#lalShowAll');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.click('#lalShowAll');

    // Crossing the breakpoint redraws the pyramid with its side labels and keeps the selection.
    await page.click('#lalPyramid [data-lal-layer="L4"]');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(400);
    assert.equal(await page.getAttribute('#lalPyramid svg', 'viewBox'), '0 0 482 390');
    assert.equal(await page.locator('.lal-pyr-lenses').count(), 0);
    assert.equal(await page.getAttribute('#lalPyramid .lal-sel', 'data-lal-layer'), 'L4');
    assert.deepEqual(pageErrors, []);
  });
});
