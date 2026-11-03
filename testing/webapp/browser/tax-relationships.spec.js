'use strict';
// Onboard taxonomy › Relationships: links between TAX terms as a bundled ring, from the
// cross-references written into the terms (definition, relationship rule, notes; parents and
// children aside) or from current records that point to records under another term by ID.
// Terms sit in taxonomy order, each domain together; picking a term draws what it refers to
// and what refers to it and shows its record in the detail panel; the view has its own link
// (with the mode); unlinked terms open in the Tree Explorer; phones.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

// The expected links, worked out from the taxonomy itself.
const expected = page => page.evaluate(() => {
  const terms = nodes.filter(n => n.nodeType === 'taxonomy'), byCode = new Map(terms.map(t => [t.code, t]));
  const text = new Set();
  terms.forEach(t => ['definition', 'relationshipRule', 'notes', 'mandatoryAttributes'].forEach(f => (String(t[f] || '').match(/TAX-\d\d(?:\.\d\d)*/g) || []).forEach(c => {
    const x = byCode.get(c);
    if (x && x !== t && x.code !== t.parentCode && x.parentCode !== t.code) text.add(`${c}>${t.code}`);
  })));
  const group = new Map(nodes.filter(n => n.nodeType === 'group').map(g => [g.code, g.parentCode]));
  const recs = nodes.filter(n => n.nodeType === 'instance'), byKey = new Map(recs.map(r => [r.primaryKey, r]));
  const rec = new Map();
  recs.forEach(r => Object.values(r.fields || {}).forEach(v => String(v).split(/[;,]\s*/).forEach(x => {
    const t = byKey.get(x.trim());
    if (t && t !== r && group.get(t.parentCode) !== group.get(r.parentCode)) { const k = `${group.get(t.parentCode)}>${group.get(r.parentCode)}`; rec.set(k, (rec.get(k) || 0) + 1); }
  })));
  return { text: text.size, records: rec.size, weight: [...rec.values()].reduce((a, b) => a + b, 0), terms: terms.length };
});
const drawn = page => page.evaluate(() => ({ edges: document.querySelectorAll('#trelGraph .rel-edge').length, nodes: document.querySelectorAll('#trelGraph .rel-node').length,
  unlinked: +document.getElementById('trelUnlinkedCount').textContent, title: document.querySelector('#trelPanel h3').textContent, detail: state.selectedCode, hash: location.hash,
  domains: [...document.querySelectorAll('#trelGraph .rel-dom-label')].map(t => t.textContent) }));

test('both kinds of link, each drawn once; domains together; select, follow, switch', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#taxonomy`, { waitUntil: 'load' });
    await page.click('#taxShowRelView');
    const want = await expected(page);
    let d = await drawn(page);
    assert.equal(d.edges, want.text);
    assert.equal(d.nodes + d.unlinked, want.terms);
    assert.deepEqual(d.domains, [...new Set(d.domains)], 'each domain appears once around the ring');
    assert.equal(d.hash, '#taxonomy?view=relationships');
    assert.equal(await page.textContent('#trelKeyIn'), 'Refers to');

    // Picking a term highlights its links and shows its record beside the chart.
    await page.selectOption('#trelPick', 'TAX-04.13.05');
    d = await drawn(page);
    assert.equal(d.title, 'Ingest Processor Rule');
    assert.equal(d.detail, 'TAX-04.13.05');
    assert.equal(d.hash, '#taxonomy?code=TAX-04.13.05&view=relationships');
    const lit = await page.evaluate(() => document.querySelectorAll('#trelGraph .rel-edge.in, #trelGraph .rel-edge.out').length);
    assert.equal(lit, await page.locator('#trelPanel .sb-children button').count());
    assert.match(await page.textContent('#detail'), /Ingest Processor Rule/);

    // Records: fewer, weighted links; the key follows; the link carries the mode.
    await page.selectOption('#trelMode', 'records');
    d = await drawn(page);
    assert.equal(d.edges, want.records);
    assert.match(await page.textContent('#trelFacts'), new RegExp(`from ${want.weight} record references`));
    assert.equal(await page.textContent('#trelKeyIn'), 'Its records point to');
    await page.selectOption('#trelPick', 'TAX-03.01.01');
    assert.equal((await drawn(page)).hash, '#taxonomy?code=TAX-03.01.01&view=relationships&mode=records');
    const widths = await page.evaluate(() => [...document.querySelectorAll('#trelGraph .rel-edge')].map(e => parseFloat(e.style.getPropertyValue('--w'))));
    assert.ok(Math.max(...widths) > Math.min(...widths) * 3, 'busier links draw thicker');
    // Following a link selects that term.
    await page.click('#trelPanel .sb-children button:has-text("Platform")');
    assert.equal((await drawn(page)).title, 'Platform');

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('a link opens the view; Open in Tree Explorer; unlinked terms; phones', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#taxonomy?code=TAX-03.03.01&view=relationships&mode=records`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => ({ view: taxActiveView, mode: document.getElementById('trelMode').value, title: document.querySelector('#trelPanel h3').textContent, detail: state.selectedCode })),
      { view: 'relations', mode: 'records', title: 'Input Component', detail: 'TAX-03.03.01' });
    await page.click('#trelPanel [data-rel-open]');
    assert.deepEqual(await page.evaluate(() => ({ view: taxActiveView, code: state.selectedCode, hash: location.hash })), { view: 'tree', code: 'TAX-03.03.01', hash: '#taxonomy?code=TAX-03.03.01' });
    // An unlinked term opens in the tree.
    await page.click('#taxShowRelView');
    const group = page.locator('#trelUnlinked details').first();
    await group.locator('summary').click();
    const code = await group.locator('[data-rel-tree]').first().getAttribute('data-rel-tree');
    await group.locator('[data-rel-tree]').first().click();
    assert.deepEqual(await page.evaluate(() => ({ view: taxActiveView, code: state.selectedCode })), { view: 'tree', code });

    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/index.html#taxonomy?view=relationships`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const fit = await page.evaluate(() => {
        const svg = document.getElementById('trelGraph').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth, inside: svg.left >= 0 && svg.right <= innerWidth, sheet: document.getElementById('detail').classList.contains('tax-sheet-open') };
      });
      assert.deepEqual(fit, { overflow: 0, inside: true, sheet: false }, `${width}px`);
    }
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});
