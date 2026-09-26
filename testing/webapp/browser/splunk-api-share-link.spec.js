'use strict';
// Splunk API page: the URL carries the search, filters and sort, so a copied link reopens
// the same view. Checks both directions (controls -> URL, URL -> controls), that unknown
// values are dropped rather than applied, and that an incoming link survives the page's
// first render.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const readState = page => page.evaluate(() => ({
  hash: location.hash,
  visible: !document.getElementById('splunkApiPage').hidden,
  q: document.getElementById('apiSearch').value,
  product: document.getElementById('apiProductFilter').value,
  group: document.getElementById('apiGroupFilter').value,
  method: document.getElementById('apiMethodFilter').value,
  count: document.getElementById('apiVisibleCount').textContent,
  endpointSort: document.querySelector('#apiTableHead th').getAttribute('aria-sort'),
}));

test('Splunk API filters and sort round-trip through the URL', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#splunk-api`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.selectOption('#apiProductFilter', 'core');
    await page.selectOption('#apiGroupFilter', 'Search jobs');
    await page.fill('#apiSearch', 'jobs');
    await page.click('.api-sort[data-sort="endpoint"]');
    await page.click('.api-sort[data-sort="endpoint"]');
    const before = await readState(page);
    assert.equal(before.hash, '#splunk-api?q=jobs&product=core&group=Search+jobs&sort=endpoint&dir=desc');

    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.goto(`${baseUrl}/index.html${before.hash}`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const after = await readState(page);
    assert.deepEqual(after, before, 'a fresh load of the link should restore the same view');
    assert.deepEqual(pageErrors, []);
  });
});

test('unknown values in a Splunk API link are dropped, not applied', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#splunk-api?product=acs&group=Search+jobs&method=BOGUS&sort=nope`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const state = await readState(page);
    assert.equal(state.visible, true);
    assert.equal(state.product, 'acs');
    assert.equal(state.group, '', 'a group from another product should not be applied');
    assert.equal(state.method, '');
    assert.equal(state.endpointSort, 'none');
    assert.equal(state.hash, '#splunk-api?product=acs');
    assert.deepEqual(pageErrors, []);
  });
});
