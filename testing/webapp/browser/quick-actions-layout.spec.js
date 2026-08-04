'use strict';
// Regression test for the Quick Actions card text-overflow bug: .info-
// action-card is a <button>, and browsers apply white-space: nowrap to
// buttons by default. Without an explicit override, each card's
// description ran on one line and bled past the card border into the next
// card instead of wrapping.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

test('Quick actions cards never let text overflow their own box', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const cards = await page.$$('.info-action-card');
    assert.ok(cards.length > 0, 'expected at least one .info-action-card on the Info page');

    const overflowing = [];
    for (const card of cards) {
      const info = await card.evaluate(el => ({
        label: el.querySelector('strong')?.textContent || '(no label)',
        offsetWidth: el.offsetWidth,
        scrollWidth: el.scrollWidth,
        whiteSpace: getComputedStyle(el).whiteSpace,
      }));
      // A small allowance for sub-pixel rounding; anything beyond that is a
      // real overflow, not measurement noise.
      if (info.scrollWidth > info.offsetWidth + 2) overflowing.push(info);
    }

    assert.deepEqual(overflowing, [], `cards with overflowing text: ${JSON.stringify(overflowing, null, 2)}`);
    assert.deepEqual(pageErrors, []);
  });
});
