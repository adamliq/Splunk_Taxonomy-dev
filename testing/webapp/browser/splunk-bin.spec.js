'use strict';
// Splunk bin CLI reference: the table is shown straight away and grows with the page (no box
// scrolling inside it, nothing wider than a phone); example commands copy exactly; search
// filters, counts and highlights; every command has a link and an A-Z entry; commands whose own
// examples say they remove something carry a caution badge quoting those examples.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

test('the reference is open, searchable, linkable and copyable', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#splunk-bin`, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const wrap = document.querySelector('.bin-table-wrap');
      return {
        visible: !!document.getElementById('binTable').offsetParent, details: document.querySelectorAll('#splunkBinSection details').length,
        rows: binRows.length, index: document.querySelectorAll('#binIndex a').length,
        innerScroll: wrap.scrollHeight > wrap.clientHeight + 1 || wrap.scrollWidth > wrap.clientWidth + 1,
        copies: document.querySelectorAll('.bin-cmd .bin-copy').length,
        cautions: [...document.querySelectorAll('.bin-caution')].map(c => c.closest('tr').id),
        cautionTitle: document.querySelector('#bin-clean .bin-caution').title,
        inline: /Run splunk envvars to see/.test(document.querySelector('#bin-cmd td:nth-child(3)').textContent.replace(/\s+/g, ' ')),
      };
    });
    assert.equal(m.visible, true);
    assert.equal(m.details, 0, 'no collapsed section');
    assert.equal(m.rows, 39);
    assert.equal(m.index, 39);
    assert.equal(m.innerScroll, false, 'table scrolls inside the page');
    assert.ok(m.copies >= 50, `copy buttons ${m.copies}`);
    assert.deepEqual(m.cautions, ['bin-clean', 'bin-remove']);
    assert.equal(m.cautionTitle, 'From its examples: Removes data from Splunk installation. eventdata refers to exported events indexed as raw log files.');
    assert.ok(m.inline, 'a command named inside a sentence stays inline');

    // No option is split across lines (browsers break after a hyphen otherwise).
    const split = await page.evaluate(() => [...document.querySelectorAll('.bin-tok')].filter(t => t.getClientRects().length > 1).map(t => t.textContent));
    assert.deepEqual(split, []);

    await page.click('#bin-add .bin-copy');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), './splunk add monitor /var/log/');
    assert.equal(await page.textContent('#binCount'), 'Copied: ./splunk add monitor /var/log/');

    await page.fill('#binSearch', 'cluster-bundle');
    assert.equal(await page.textContent('#binCount'), '4 of 39 commands match');
    assert.deepEqual(await page.evaluate(() => binRows.filter(r => !r.tr.hidden).map(r => r.command)), ['apply', 'rollback', 'show', 'validate']);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#binTable mark')].every(x => x.textContent.toLowerCase() === 'cluster-bundle') && !document.querySelector('.bin-copy mark')));
    await page.fill('#binSearch', '<img src=x>');
    assert.equal(await page.locator('#binTable img').count(), 0);
    await injectAxe(page);
    await page.fill('#binSearch', 'cluster');
    assert.deepEqual(await auditVisible(page, 'page'), [], 'search state');

    // A-Z link and global search both clear the filter and land on the command.
    await page.fill('#binSearch', '');
    await page.click('#binIndex a:text-is("rollback")');
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => location.hash), '#splunk-bin?command=rollback');
    const landed = await page.evaluate(() => { const r = document.getElementById('bin-rollback'); const b = r.getBoundingClientRect(); return { target: r.classList.contains('bin-target'), top: b.top, header: document.querySelector('#binTable thead th').getBoundingClientRect().bottom }; });
    assert.ok(landed.target && landed.top >= landed.header - 1 && landed.top < 300, JSON.stringify(landed));

    await page.fill('#binSearch', 'anonymize');
    await page.evaluate(() => { const d = GLOBAL_SEARCH_DOMAINS.find(x => x.id === 'splunkbin'); d.go(d.getItems().find(c => c.command === 'rebalance')); });
    await page.waitForTimeout(600);
    assert.equal(await page.inputValue('#binSearch'), '');
    assert.equal(await page.evaluate(() => document.getElementById('bin-rebalance').hidden), false);
    assert.deepEqual(pageErrors, []);
  });
});

test('a command link opens the page on that command, and phones get cards', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#splunk-bin?command=clean`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => { const row = document.getElementById('bin-clean'); const b = row.getBoundingClientRect(); return { target: row.classList.contains('bin-target'), top: b.top }; });
    assert.ok(r.target && r.top >= 0 && r.top < 300, JSON.stringify(r));

    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#splunk-bin`, { waitUntil: 'load' });
    const phone = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, rowWidth: document.getElementById('bin-add').getBoundingClientRect().width, labels: [...document.querySelectorAll('#bin-add td[data-label]')].map(td => getComputedStyle(td, '::before').content) }));
    assert.equal(phone.overflow, 0);
    assert.ok(phone.rowWidth <= 393, `row ${phone.rowWidth}px`);
    assert.deepEqual(phone.labels, ['"Objects"', '"Examples"']);
    assert.deepEqual(pageErrors, []);
  });
});
