'use strict';
// The big reference tables (questions, health checks, SOC metrics, roles, Splunk API, logging
// patterns, Splunk ports) grow with the page instead of scrolling inside a fixed-height box:
// the header row follows the reader down, 100 rows show at first (25 on a phone) with "Show
// more" / "Show all", a filter starts the count again, global search reveals a row past the
// first page, and on phones each row is a labelled card. Also: the Roles toolbar fits its page.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const TABLES = [
  ['refQuestions', 'questionsTableBody'], ['health', 'healthTableBody'], ['metrics', 'socMetricsTableBody'],
  ['refRoles', 'rolesTableBody'], ['splunkApi', 'apiTableBody'], ['patterns', 'patternTableBody'], ['refNetworkReference', 'splunkPortsTableBody'],
];
const measure = (page, body) => page.evaluate(id => {
  const tbody = document.getElementById(id), wrap = tbody.closest('table').parentElement;
  return {
    shown: [...tbody.rows].filter(r => r.offsetParent).length, total: tbody.rows.length,
    innerScroll: wrap.scrollHeight > wrap.clientHeight + 2, more: wrap.nextElementSibling?.classList.contains('flow-more') ? wrap.nextElementSibling.textContent : null,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
}, body);

test('the big tables grow with the page, page their rows and keep the header in view', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    for (const [name, body] of TABLES) {
      await page.evaluate(n => { setActivePage(n); window.scrollTo(0, 0); }, name);
      await page.waitForTimeout(200);
      const m = await measure(page, body);
      assert.equal(m.innerScroll, false, `${name}: scrolls inside a box`);
      assert.equal(m.overflow, 0, `${name}: page overflow`);
      assert.equal(m.shown, Math.min(100, m.total), `${name}: rows shown`);
      if (m.total > 100) assert.match(m.more, new RegExp(`Showing 100 of ${m.total.toLocaleString('en')} rows`));
      // Scrolled well into the table, its header row is still at the top of the screen.
      const head = await page.evaluate(id => new Promise(resolve => {
        const table = document.getElementById(id).closest('table');
        window.scrollTo(0, table.getBoundingClientRect().top + scrollY + 700);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(table.tHead.rows[0].cells[0].getBoundingClientRect().top)));
      }), body);
      assert.ok(head >= -2 && head <= 4, `${name}: header at ${head}px`);
    }

    // Show more / Show all, and a filter starting the count again.
    await page.evaluate(() => { setActivePage('refQuestions'); window.scrollTo(0, 0); });
    await page.waitForTimeout(200);
    const moreOf = (id, sel) => page.evaluate(([id, sel]) => document.getElementById(id).closest('.flow-table').nextElementSibling.querySelector(sel).click(), [id, sel]);
    await moreOf('questionsTableBody', 'button:not([data-all])');
    await page.waitForTimeout(100);
    const afterMore = await measure(page, 'questionsTableBody');
    assert.equal(afterMore.shown, 200);
    await moreOf('questionsTableBody', 'button[data-all]');
    await page.waitForTimeout(100);
    const all = await measure(page, 'questionsTableBody');
    assert.equal(all.shown, all.total);
    await page.fill('#questionsTableSearch', 'logging');
    await page.waitForTimeout(300);
    const filtered = await measure(page, 'questionsTableBody');
    assert.equal(filtered.shown, Math.min(100, filtered.total));

    // Revealing a row beyond the first page shows it; global search's last question lands on a visible row.
    await page.fill('#questionsTableSearch', '');
    await page.waitForTimeout(300);
    const revealed = await page.evaluate(() => {
      const rows = document.getElementById('questionsTableBody').rows;
      flowReveal(rows[rows.length - 1]);
      return { shown: [...rows].filter(r => r.offsetParent).length, last: !!rows[rows.length - 1].offsetParent };
    });
    assert.ok(revealed.shown > 100 && revealed.last, `after revealing the last question: ${JSON.stringify(revealed)}`);
    await page.evaluate(() => { const d = GLOBAL_SEARCH_DOMAINS.find(x => x.id === 'questions'), items = d.getItems(); d.go(items[items.length - 1]); });
    await page.waitForTimeout(300);
    assert.ok((await measure(page, 'questionsTableBody')).shown >= 1);

    // Roles: the toolbar fits the page.
    await page.evaluate(() => { setActivePage('refRoles'); window.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.getElementById('exportRolesTable').getBoundingClientRect().right <= document.documentElement.clientWidth), true);
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), [], 'roles page');
    assert.deepEqual(pageErrors, []);
  });
});

test('on a phone each row is a labelled card, 25 at a time', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    for (const [name, body] of TABLES) {
      await page.evaluate(n => { setActivePage(n); window.scrollTo(0, 0); }, name);
      await page.waitForTimeout(200);
      const m = await measure(page, body);
      assert.equal(m.overflow, 0, `${name}: page overflow`);
      assert.equal(m.shown, Math.min(25, m.total), `${name}: cards shown`);
      const card = await page.evaluate(id => {
        const row = document.getElementById(id).rows[0];
        return { width: row.getBoundingClientRect().width, label: getComputedStyle(row.cells[0], '::before').content, head: getComputedStyle(row.closest('table').tHead).display };
      }, body);
      assert.ok(card.width <= 393, `${name}: card ${card.width}px wide`);
      assert.notEqual(card.label, 'none', `${name}: unlabelled card`);
      assert.equal(card.head, 'none');
    }
    assert.deepEqual(pageErrors, []);
  });
});
