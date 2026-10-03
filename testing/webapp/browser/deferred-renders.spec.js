'use strict';
// The questions, concepts, schema explorer and permissions tables are built the first time
// their page opens instead of at load. Opening each page, by a direct link or from another
// page, must still show the full table, and the tables must not exist before then.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const TABLES = {
  questions: '#questionsTableBody tr',
  'concept-definitions': '#conceptGrid .concept-card',
  'input-coverage': '#msPermissionsTableBody tr',
};

test('deferred tables are empty at load and filled when their page opens', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    for (const selector of Object.values(TABLES)) assert.equal(await page.locator(selector).count(), 0, `${selector} built at load`);
    for (const [hash, selector] of Object.entries(TABLES)) {
      await page.evaluate(h => { location.hash = h; }, hash);
      await page.waitForTimeout(150);
      assert.ok(await page.locator(selector).count() > 10, `${selector} not built on opening #${hash}`);
    }
    assert.ok(await page.locator('#awsPermissionsTableBody tr').count() > 10, 'AWS permissions table not built');
    assert.ok(await page.locator('#seAppList > *').count() > 0, 'schema explorer not built');
    assert.deepEqual(pageErrors, []);
  });
});

test('a direct link to a deferred page builds its table', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const [hash, selector] of Object.entries(TABLES)) {
      await page.goto(`${baseUrl}/index.html#${hash}`, { waitUntil: 'load' });
      await page.reload({ waitUntil: 'load' });
      assert.ok(await page.locator(selector).count() > 10, `${selector} not built when loading #${hash}`);
    }
    assert.deepEqual(pageErrors, []);
  });
});
