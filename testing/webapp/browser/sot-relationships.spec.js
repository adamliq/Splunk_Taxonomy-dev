'use strict';
// Splunk object taxonomy › Relationships: every resolved "Depends on" / "Feeds" link drawn once
// between the objects that have any, around a ring in taxonomy order; picking, pointing at or
// following a link highlights what an object depends on and feeds; links recorded on one object
// only are flagged; objects with no links are listed by domain and open in the Tree Explorer;
// the view has its own link; phones.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

// The expected links, worked out from the taxonomy itself.
const expected = page => page.evaluate(() => {
  const links = new Map();
  const add = (a, b, side) => { if (!a || !b || a === b) return; const k = `${a.instanceId}>${b.instanceId}`; links.set(k, { ...(links.get(k) || {}), a: a.instanceId, b: b.instanceId, [side]: true }); };
  SOT_OBJECTS.forEach(o => { (o.deps || []).forEach(n => add(sotResolve(n), o, 'deps')); (o.feeds || []).forEach(n => add(o, sotResolve(n), 'feeds')); });
  const list = [...links.values()], linked = new Set(list.flatMap(l => [l.a, l.b]));
  return { links: list.length, linked: linked.size, oneSided: list.filter(l => !(l.deps && l.feeds)).length,
    finding: { ins: list.filter(l => l.b === 'FIND-001').length, outs: list.filter(l => l.a === 'FIND-001').length } };
});

test('every link once; select, hover and follow; one-sided links; the link', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy`, { waitUntil: 'load' });
    await page.click('#sotShowRelView');
    const want = await expected(page);
    const drawn = await page.evaluate(() => ({ edges: document.querySelectorAll('#relGraph .rel-edge').length, nodes: document.querySelectorAll('#relGraph .rel-node').length,
      unlinked: +document.getElementById('relUnlinkedCount').textContent, chips: document.querySelectorAll('#relUnlinked [data-rel-tree]').length,
      stats: document.getElementById('sotStatsBar').hidden, tab: document.getElementById('sotShowRelView').getAttribute('aria-selected'), facts: document.getElementById('relFacts').textContent }));
    assert.equal(drawn.edges, want.links);
    assert.equal(drawn.nodes, want.linked);
    assert.equal(drawn.unlinked, await page.evaluate(() => SOT_OBJECTS.length) - want.linked);
    assert.equal(drawn.chips, drawn.unlinked);
    assert.equal(drawn.stats, true, 'the type and lifecycle filters do not apply here');
    assert.equal(drawn.tab, 'true');
    assert.match(drawn.facts, new RegExp(`${want.oneSided} recorded on one object only`));
    // The view opens on the object with the most links and writes its link.
    assert.match(await page.evaluate(() => location.hash), /^#object-taxonomy\?object=.+&view=relationships$/);

    // Picking Finding highlights exactly its links, in two colours.
    await page.selectOption('#relPick', 'FIND-001');
    const sel = await page.evaluate(() => ({ ins: document.querySelectorAll('#relGraph .rel-edge.in').length, outs: document.querySelectorAll('#relGraph .rel-edge.out').length,
      title: document.querySelector('#relPanel h3').textContent, label: document.querySelector('#relGraph .rel-sel-label').textContent, hash: location.hash,
      oneSidedTags: document.querySelectorAll('#relPanel .sb-children .rel-one').length, dashed: document.querySelectorAll('#relGraph .rel-edge.one-sided').length }));
    assert.deepEqual({ ins: sel.ins, outs: sel.outs }, want.finding);
    assert.equal(sel.title, 'Finding');
    assert.equal(sel.label, 'Finding');
    assert.equal(sel.hash, '#object-taxonomy?object=Finding&view=relationships');
    assert.equal(sel.oneSidedTags, sel.dashed, 'a one-sided link is tagged in the panel and dashed in the chart');

    // Pointing at another object previews its links; leaving the chart goes back to the selection.
    // (Neighbouring hit areas overlap, so point at this one exactly.)
    await page.dispatchEvent('#relGraph .rel-hit[data-id="RS-001"]', 'mouseover');
    assert.ok(await page.evaluate(() => document.querySelector('#relGraph .rel-node[data-id="RS-001"]').classList.contains('sel')));
    await page.dispatchEvent('#relGraph', 'mouseleave');
    assert.equal(await page.evaluate(() => document.querySelector('#relGraph .rel-node.sel').getAttribute('data-id')), 'FIND-001');
    // Following a link in the panel selects that object.
    await page.click('#relPanel .sb-children button:has-text("Response Plan")');
    assert.equal(await page.textContent('#relPanel h3'), 'Response Plan');
    await page.dispatchEvent('#relGraph .rel-hit[data-id="FIND-001"]', 'click');
    assert.equal(await page.textContent('#relPanel h3'), 'Finding');

    // Open in Tree Explorer, then back to the tree's own link.
    await page.click('#relPanel [data-rel-open]');
    assert.deepEqual(await page.evaluate(() => ({ view: sotActiveView, selected: document.querySelector('#sotTreeShell .tree-row.selected').dataset.name, hash: location.hash, stats: document.getElementById('sotStatsBar').hidden })),
      { view: 'tree', selected: 'Finding', hash: '#object-taxonomy?object=Finding', stats: false });

    await page.click('#sotShowRelView');
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('a link opens the view on an object; unlinked objects open in the tree; phones', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy?object=Ingest%20Processor%20Pipeline&view=relationships`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => ({ view: sotActiveView, title: document.querySelector('#relPanel h3').textContent, pick: document.getElementById('relPick').value })),
      { view: 'relations', title: 'Ingest Processor Pipeline', pick: 'IPP-001' });
    // An unlinked object listed below opens in the tree.
    const group = page.locator('#relUnlinked details').first();
    await group.locator('summary').click();
    const id = await group.locator('[data-rel-tree]').first().getAttribute('data-rel-tree');
    const name = await page.evaluate(i => { const o = SOT_OBJECTS.find(x => x.instanceId === i); return (o.deps || []).length === 0 ? o.name : null; }, id);
    assert.ok(name, `${id} is listed as having no links`);
    await group.locator('[data-rel-tree]').first().click();
    assert.equal(await page.evaluate(() => document.querySelector('#sotTreeShell .tree-row.selected').dataset.name), name);

    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.click('#sotShowRelView');
      await page.waitForTimeout(200);
      const fit = await page.evaluate(() => {
        const svg = document.getElementById('relGraph').getBoundingClientRect(), panel = document.getElementById('relPanel').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth, inside: svg.left >= 0 && svg.right <= innerWidth, below: panel.top >= svg.bottom };
      });
      assert.deepEqual(fit, { overflow: 0, inside: true, below: true }, `${width}px`);
    }
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});
