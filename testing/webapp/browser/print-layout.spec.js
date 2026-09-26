'use strict';
// Print layout: app chrome is hidden and a header line (page, version, date, URL) is shown;
// the S3 calculator no longer prints on every page; a role comparison can be printed on its
// own; tables wider than the paper are scaled to fit and restored afterwards.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

const displayed = (page, selector) => page.$eval(selector, el => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0);

test('printing a page hides app chrome, shows the print header, and leaves the S3 calculator out', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#splunk-api?product=hec`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    assert.equal(await displayed(page, '.app-header'), false);
    assert.equal(await displayed(page, '.app-sidebar'), false);
    assert.equal(await displayed(page, '#s3CalcPage'), false, 'S3 calculator must not print on other pages');
    assert.equal(await displayed(page, '#printHeader'), true);
    const header = await page.textContent('#printHeader');
    assert.match(header, /LATCH · Splunk API/);
    assert.match(header, /v\d{4}\.\d{2}\.\d{2} · build \d+ · Printed \d{4}-\d{2}-\d{2}/);
    assert.match(header, /#splunk-api\?product=hec/);
    assert.match(await page.$eval('#printPageStyle', el => el.textContent), /landscape/);
    assert.deepEqual(pageErrors, []);
  });
});

test('Print comparison prints only the role comparison', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#roles`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const roles = await page.$$eval('#roleCompareA option', opts => opts.map(o => o.value).filter(Boolean));
    await page.selectOption('#roleCompareA', roles[0]);
    await page.selectOption('#roleCompareB', roles[1]);
    await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')); });
    await page.click('#roleComparePrint');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await displayed(page, '#roleToolCompare'), true);
    assert.equal(await displayed(page, '#roleCompareResult table'), true);
    assert.equal(await displayed(page, '.role-view-switch'), false);
    assert.equal(await displayed(page, '#rolesSection .patterns-hero'), false, 'the rest of the Roles page should not print');
    assert.match(await page.textContent('#printHeader'), /Role comparison: .+ vs .+/);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.$$eval('.print-scope, .print-scope-path', els => els.length), 0, 'scope classes are cleared after printing');
    assert.deepEqual(pageErrors, []);
  });
});

test('a table wider than the paper is scaled to fit, then restored after printing', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#ports-matrix`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); // must be idempotent
    const zoom = Number(await page.$eval('#portsMatrixTable', t => t.style.zoom));
    assert.ok(zoom > 0 && zoom < 1, `expected the full ports grid to be scaled down, got zoom ${zoom}`);
    assert.equal(await page.$$eval('.print-fit-note', n => n.length), 1);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.$eval('#portsMatrixTable', t => t.style.zoom), '');
    assert.equal(await page.$$eval('.print-fit-note', n => n.length), 0);
    assert.deepEqual(pageErrors, []);
  });
});
