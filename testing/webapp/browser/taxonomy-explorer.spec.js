'use strict';
// Onboard taxonomy: a term has its own link (#taxonomy?code=...), restored on load and on
// back/forward; a term chosen from elsewhere is scrolled into view in the tree or the table;
// search says how many terms and entries match and highlights the words; at single-column
// widths the detail is a bottom sheet.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const inView = (page, selector) => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, selector);

test('links to a term, and the selection is brought into view', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#taxonomy?code=TAX-04.10.01`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    assert.equal(await page.textContent('#detail .detail-title'), 'Event Health Check');
    assert.ok(await inView(page, '#tree .node-card.selected'), 'deep-linked term in view');

    await page.locator('#tree .node-card').filter({ hasText: 'TAX-04.10 ' }).first().click();
    assert.equal(await page.evaluate(() => location.hash), '#taxonomy?code=TAX-04.10');

    await page.evaluate(() => { location.hash = '#taxonomy?code=TAX-02.06.03'; });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => state.selectedCode), 'TAX-02.06.03');
    assert.ok(await inView(page, '#tree .node-card.selected'), 'term from a hash change in view');
    await page.evaluate(() => { location.hash = '#taxonomy?code=TAX-99'; });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => state.selectedCode), 'TAX-02.06.03', 'unknown code ignored');

    await page.click('#taxShowTableView');
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), [], 'table view');
    await page.evaluate(() => selectTaxNodeFromTable('TAX-06.04.01'));
    await page.waitForTimeout(900);
    assert.ok(await inView(page, '#taxTableBody tr.selected'), 'table row in view');
    assert.equal(await page.evaluate(() => location.hash), '#taxonomy?code=TAX-06.04.01');

    // Back to the first domain: the plain link.
    await page.evaluate(() => selectTaxNodeFromTable('TAX-01'));
    assert.equal(await page.evaluate(() => location.hash), '#taxonomy');
    assert.deepEqual(pageErrors, []);
  });
});

test('search counts matches, highlights them and escapes what was typed', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    assert.ok(await page.evaluate(() => document.getElementById('search').getBoundingClientRect().width) >= 280, 'search box wide enough');
    assert.equal(await page.locator('#taxonomyPage .stat', { hasText: 'opens fully collapsed' }).count(), 0);

    await page.fill('#search', 'timestamp');
    const m = await page.evaluate(() => {
      const hits = nodes.filter(n => searchableText(n).includes('timestamp'));
      return {
        text: document.getElementById('taxSearchCount').textContent,
        expectTerms: hits.filter(n => n.nodeType === 'taxonomy').length,
        expectEntries: hits.filter(n => n.nodeType === 'instance').length,
        marks: [...document.querySelectorAll('#tree mark')].map(x => x.textContent.toLowerCase()),
        tableMarks: document.querySelectorAll('#taxTableBody mark').length,
      };
    });
    assert.ok(m.text.startsWith(`${m.expectTerms} taxonomy terms and ${m.expectEntries.toLocaleString('en')} current entries match`), m.text);
    assert.ok(m.marks.length > 0 && m.marks.every(x => x === 'timestamp'));
    // Highlights and the shaded context cards keep WCAG AA contrast.
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);

    await page.selectOption('#domainFilter', 'Data Engineering & Parsing');
    assert.match(await page.textContent('#taxSearchCount'), / in Data Engineering & Parsing\./);
    await page.selectOption('#domainFilter', '');

    await page.fill('#search', '<img src=x onerror=alert(1)>(');
    assert.equal(await page.locator('#tree img').count(), 0);
    assert.match(await page.textContent('#taxSearchCount'), /^0 taxonomy terms and 0 current entries match/);
    await page.fill('#search', '');
    assert.equal(await page.textContent('#taxSearchCount'), '');
    assert.deepEqual(pageErrors, []);
  });
});

test('at phone width the detail is a bottom sheet', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    const sheet = () => page.evaluate(() => { const d = document.getElementById('detail'); return { open: d.classList.contains('tax-sheet-open'), top: d.getBoundingClientRect().top }; });
    assert.equal((await sheet()).open, false);
    assert.ok((await sheet()).top >= 852, 'closed sheet is off screen');
    await page.locator('#tree .node-card').nth(2).click();
    await page.waitForTimeout(400);
    const open = await sheet();
    assert.ok(open.open && open.top < 400, JSON.stringify(open));
    assert.equal(await page.textContent('#detail .detail-title'), 'Data Collection & Routing');
    await page.click('#detail .tax-sheet-close');
    assert.equal((await sheet()).open, false);
    await page.locator('#tree .node-card').nth(1).click();
    await page.keyboard.press('Escape');
    assert.equal((await sheet()).open, false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});
