'use strict';
// Onboard taxonomy sunburst: every TAX term drawn once under its parent, sized by the terms
// at the ends of its branches or by the current records beneath it; colour by status (keyed
// with counts) or a highlighted value; zoom by arc, panel and breadcrumb; a term's current
// records and linked Splunk objects in the panel; search; links; Open in Onboard taxonomy;
// phones. The Splunk object taxonomy sunburst keeps its own page and label.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const clickArc = (page, key) => page.evaluate(k => {
  const g = [...document.querySelectorAll('#tbChart .slice')].find(s => s.__data__.data.key === k);
  g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, key);
const state = page => page.evaluate(() => ({ focus: tbState.focus ? tbState.focus.key : null, title: document.querySelector('#tbPanel h3').textContent, hash: location.hash }));

test('every term once; sizes, colours and zoom', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#taxonomy-sunburst`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => {
      const terms = nodes.filter(n => n.nodeType === 'taxonomy'), drawn = tbState.data.nodes.filter(n => n.kind === 'term');
      return {
        page: currentActivePageKey, tabs: [...document.querySelectorAll('[data-group="onboarding"] .page-tab')].map(t => t.textContent),
        once: drawn.length === terms.length && new Set(drawn.map(n => n.t)).size === terms.length,
        parents: drawn.every(n => (tbState.data.parentOf.get(n).t || { code: '' }).code === n.t.parentCode),
        records: drawn.reduce((s, n) => s + n.records.length, 0) === nodes.filter(n => n.nodeType === 'instance').length,
        slices: document.querySelectorAll('#tbChart .slice').length,
      };
    });
    assert.deepEqual(data, { page: 'taxSunburst', once: true, parents: true, records: true, slices: 628,
      tabs: ['Assessments', 'Onboard taxonomy', 'Onboard taxonomy sunburst', 'Onboarding flow', 'Splunk object taxonomy', 'Splunk object taxonomy sunburst'] });
    // Status key counts every term.
    assert.equal((await page.evaluate(() => [...document.querySelectorAll('#tbLegend .sb-key strong')].map(s => +s.textContent))).reduce((a, b) => a + b, 0), await page.evaluate(() => nodes.filter(n => n.nodeType === 'taxonomy').length));

    // Zoom in by arc, out by the arc in focus; sizing by records drops terms with none.
    await clickArc(page, 'TAX-03');
    assert.deepEqual(await state(page), { focus: 'TAX-03', title: 'Data Collection & Routing', hash: '#taxonomy-sunburst?focus=TAX-03' });
    await page.selectOption('#tbSizeBy', 'records');
    await page.waitForTimeout(700);
    assert.equal((await state(page)).hash, '#taxonomy-sunburst?focus=TAX-03&size=records');
    const sub = await page.textContent('#tbPanel .sb-sub');
    assert.match(sub, /(\d+) current records/);
    assert.equal(+sub.match(/(\d+) current records/)[1], await page.evaluate(() => (function sum(n) { return n.records.length + (n.children || []).reduce((s, c) => s + sum(c), 0); })(tbState.data.byKey.get('TAX-03'))));
    assert.ok(await page.locator('#tbPanel .sb-children .sb-empty').count() > 0, 'terms without records are listed but not buttons');
    await clickArc(page, 'TAX-03');
    assert.equal((await state(page)).focus, null);
    await page.selectOption('#tbSizeBy', 'terms');

    // Highlight an owner: the blue arcs are exactly the terms with that owner.
    await page.selectOption('#tbColorBy', 'owner');
    // Colours fade in over the transition; wait for it to settle.
    await page.waitForFunction(() => !document.querySelector('#tbChart .slice path.main-arc[style*="fill"]') || [...document.querySelectorAll('#tbChart .slice path.main-arc')].every(p => /^rgb\((42, 120, 214|179, 178, 171)\)$/.test(p.style.fill)), null, { timeout: 5000 }).catch(() => {});
    const owner = await page.evaluate(() => ({
      value: document.getElementById('tbValue').value,
      key: +document.querySelector('#tbLegend .sb-key strong').textContent,
      blue: [...document.querySelectorAll('#tbChart .slice')].filter(s => s.querySelector('path.main-arc').style.fill === 'rgb(42, 120, 214)').length,
      expected: nodes.filter(n => n.nodeType === 'taxonomy' && n.owner === document.getElementById('tbValue').value).length,
    }));
    assert.equal(owner.key, owner.expected);
    assert.equal(owner.blue, owner.expected);
    await page.selectOption('#tbColorBy', 'sot');
    assert.equal(await page.isVisible('#tbValueWrap'), false);
    assert.match(await page.textContent('#tbLegend'), /Linked to Splunk objects\s*\d+/);

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('a term\'s records and Splunk objects; search; links; Open in Onboard taxonomy; phones', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#taxonomy-sunburst?focus=TAX-01.01.01&color=records`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    assert.deepEqual(await state(page), { focus: 'TAX-01.01.01', title: 'Platform', hash: '#taxonomy-sunburst?focus=TAX-01.01.01&color=records' });
    assert.equal(await page.textContent('#tbPanel .sb-crumbs'), 'All domains›TAX-01›TAX-01.01›TAX-01.01.01');
    assert.match(await page.textContent('#tbPanel'), /Current records \(12\)/);
    assert.equal(await page.locator('#tbPanel .sb-records li').count(), 8);
    assert.match(await page.textContent('#tbPanel'), /and 4 more in the Onboard taxonomy/);

    // A term linked to Splunk objects opens one in the Splunk object taxonomy.
    await page.fill('#tbSearch', 'TAX-03.02.03');
    assert.equal(await page.locator('#tbResults button').first().textContent(), 'TAX-03.02.03Collection Routing');
    await page.press('#tbSearch', 'Enter');
    assert.equal((await state(page)).focus, 'TAX-03.02.03');
    await page.click('#tbPanel [data-sb-act="sot"][data-code="SOT-05.06.01.01"]');
    assert.deepEqual(await page.evaluate(() => ({ page: currentActivePageKey, selected: document.querySelector('#sotTreeShell .tree-row.selected').dataset.name })), { page: 'objectTaxonomy', selected: 'Ingest Processor Pipeline' });
    await page.goBack();
    await page.waitForTimeout(500);
    assert.equal((await state(page)).focus, 'TAX-03.02.03');

    // Open in Onboard taxonomy selects the term there; the Onboard taxonomy page links back.
    await page.click('#tbPanel [data-sb-open]');
    assert.deepEqual(await page.evaluate(() => ({ page: currentActivePageKey, code: state.selectedCode })), { page: 'taxonomy', code: 'TAX-03.02.03' });
    await page.click('#taxonomyPage .patterns-hero a[href="#taxonomy-sunburst"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => currentActivePageKey), 'taxSunburst');

    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.waitForTimeout(400);
      const fit = await page.evaluate(() => {
        const svg = document.querySelector('#tbChart svg').getBoundingClientRect(), panel = document.getElementById('tbPanel').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth, inside: svg.left >= 0 && svg.right <= innerWidth, below: panel.top >= svg.bottom };
      });
      assert.deepEqual(fit, { overflow: 0, inside: true, below: true }, `${width}px`);
    }
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});
