'use strict';
// Input coverage › Microsoft cloud based inputs › Resource input: the Azure resource collection
// matrix from azure_resource_splunk_collection_crosscut.xlsx (19 resources; UF / HEC / Event Hub /
// API marked Primary, Secondary or Not normally used, with the workbook's legend), its search,
// layer and primary-path filters and CSV export; the table grows with the page on desktop and is
// labelled cards on a phone.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const open = async (page, baseUrl) => {
  await page.goto('about:blank');
  await page.goto(`${baseUrl}/index.html#input-coverage`, { waitUntil: 'load' });
  await page.click('#showMsResourceInputView');
};
const names = page => page.evaluate(() => [...document.querySelectorAll('#riTableBody th')].map(t => t.textContent));

test('the resource input matrix matches the workbook; filters and export work', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, baseUrl);
    assert.equal(await page.getAttribute('#showMsResourceInputView', 'aria-selected'), 'true');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#riTable thead th')].map(t => t.textContent)),
      ['Azure resource / source', 'Layer / plane', 'UF', 'HEC', 'Event Hub', 'API', 'Typical telemetry']);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#riTableBody tr')].map(r => [...r.cells].map(c => c.textContent)));
    assert.equal(rows.length, 19);
    assert.deepEqual(rows[0], ['Custom web application', 'Application', 'Primary', 'Secondary', 'Secondary', 'Not normally used', 'App, audit, error, business logs']);
    assert.deepEqual(rows[18], ['Recovery Services / Backup', 'Backup / Recovery', 'Not normally used', 'Not normally used', 'Primary', 'Secondary', 'Backup, restore, failover activity']);
    assert.equal(await page.textContent('#riResultCount'), '19 of 19 resources');
    assert.match(await page.textContent('.ri-legend'), /Primary Preferred or normal collection path.*Secondary Alternative, supplementary, or service-specific path.*Not normally used Not normally selected for this resource\/source/s);
    // The table grows with the page.
    assert.equal(await page.evaluate(() => { const w = document.querySelector('#msResourceInputView .eccs-table-wrap'); return w.scrollHeight > w.clientHeight + 2; }), false);

    await page.selectOption('#riPrimaryFilter', 'HEC');
    assert.deepEqual(await names(page), ['Azure DevOps']);
    await page.selectOption('#riPrimaryFilter', 'API');
    assert.deepEqual(await names(page), ['Defender for Cloud / Servers']);
    await page.selectOption('#riPrimaryFilter', '');
    await page.selectOption('#riLayerFilter', 'Data / Storage');
    assert.deepEqual(await names(page), ['Storage Account', 'Azure SQL']);
    await page.selectOption('#riLayerFilter', '');
    await page.fill('#riSearchBox', 'waf');
    assert.deepEqual(await names(page), ['Application Gateway / WAF', 'Front Door']);
    assert.equal(await page.locator('#riTableBody mark').count() >= 2, true);

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#riExportBtn')]);
    const csv = require('fs').readFileSync(await download.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
    assert.equal(download.suggestedFilename(), 'Azure-Resource-Collection-Paths.csv');
    assert.equal(csv.length, 3);
    assert.equal(csv[0], 'Azure resource / source,Layer / plane,UF,HEC,Event Hub,API,Typical telemetry');
    assert.match(csv[1], /^Application Gateway \/ WAF,Edge \/ Ingress,Not normally used,Not normally used,Primary,Secondary,"Access, performance, WAF events"$/);

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('on a phone each resource is a labelled card, paths two by two', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await open(page, baseUrl);
      const r = await page.evaluate(() => {
        const row = document.querySelector('#riTableBody tr');
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          head: getComputedStyle(document.querySelector('#riTable thead')).display,
          labels: [...row.cells].filter(c => c.tagName === 'TD').map(c => getComputedStyle(c, '::before').content.replace(/"/g, '')),
          oneLineBadges: [...document.querySelectorAll('#riTable .ri-status')].every(b => b.getClientRects().length === 1),
        };
      });
      assert.equal(r.overflow, 0, `${width}px`);
      assert.equal(r.head, 'none');
      assert.deepEqual(r.labels, ['Layer / plane', 'UF', 'HEC', 'Event Hub', 'API', 'Typical telemetry']);
      assert.equal(r.oneLineBadges, true, `${width}px badges wrap`);
    }
    assert.deepEqual(pageErrors, []);
  });
});
