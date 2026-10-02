'use strict';
// Splunk Object Taxonomy: all 14 domains are counted and filterable; an object or node has its
// own link; dependency names link to their objects (short forms such as "Universal
// Forwarder" -> "Universal Forwarder (UF)"), unknown names stay unlinked, and "Used by" lists
// the objects that depend on it; empty fields are summarised in one line; the class counts and
// the lifecycle filter narrow both views; search highlights; phones get a bottom sheet.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const panelTitle = page => page.textContent('#sotTreeDetailPanel h2');

test('domains, links, dependencies and the detail summary', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy?object=Lookup%20Definition`, { waitUntil: 'load' });
    await page.waitForTimeout(900);

    const domains = await page.evaluate(() => ({
      list: SOT_DOMAINS.length, tree: Object.keys(SOT_TREE).length,
      missing: [...new Set(SOT_OBJECTS.map(o => o.domain))].filter(d => !SOT_DOMAINS.includes(d)),
      nav: document.querySelectorAll('#sotDomainNav button[data-domain]:not([data-domain=""])').length,
    }));
    assert.deepEqual(domains, { list: 14, tree: 14, missing: [], nav: 14 });
    assert.match(await page.textContent('#sotStatsBar'), /14\s*SOT domains/);

    assert.equal(await panelTitle(page), 'Lookup Definition');
    assert.ok(await page.evaluate(() => { const r = document.querySelector('#sotTreeShell .tree-row.selected').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    const detail = await page.evaluate(() => {
      const d = document.getElementById('sotTreeDetailPanel');
      return { tbc: d.innerText.includes('To be confirmed'), notRecorded: d.querySelector('.sot-not-recorded')?.textContent || '',
        usedBy: [...d.querySelectorAll('.sot-detail-row')].find(r => /Used by/.test(r.textContent))?.querySelectorAll('button.ref-pill').length || 0,
        spans: d.querySelectorAll('span.ref-pill[data-ref], span.ref-pill[data-jump-tax], span.ref-pill[data-open-reference-detail]').length };
    });
    assert.equal(detail.tbc, false, 'no "To be confirmed" rows');
    assert.match(detail.notRecorded, /^Not yet recorded: Platform, Namespace \/ App, Owner/);
    assert.ok(detail.usedBy >= 3, `used by ${detail.usedBy}`);
    assert.equal(detail.spans, 0, 'clickable pills are buttons');

    // Short forms resolve to the one object they abbreviate; names with no object stay unlinked.
    const resolved = await page.evaluate(() => Object.fromEntries(['Universal Forwarder', 'Heavy Forwarder', 'Search Head Cluster', 'Cluster Manager', 'Data Input (General)', 'KV Store Lookup', 'Detection Content Package (ESCU)']
      .map(n => [n, sotResolve(n)?.name || null])));
    assert.deepEqual(resolved, {
      'Universal Forwarder': 'Universal Forwarder (UF)', 'Heavy Forwarder': 'Heavy Forwarder (HF)', 'Search Head Cluster': 'Search Head Cluster (SHC)',
      'Cluster Manager': 'Cluster Manager (Master)', 'Data Input (General)': 'Data Input', 'KV Store Lookup': null, 'Detection Content Package (ESCU)': null,
    });
    const owner = await page.evaluate(() => SOT_OBJECTS.find(o => (o.deps || []).includes('Universal Forwarder')).name);
    await page.evaluate(n => selectObjectInTree(n), owner);
    await page.click('#sotTreeDetailPanel button.ref-pill[data-ref="Universal Forwarder (UF)"]');
    assert.equal(await panelTitle(page), 'Universal Forwarder (UF)');
    assert.equal(await page.evaluate(() => location.hash), '#object-taxonomy?object=Universal%20Forwarder%20(UF)');

    // A node link, and back/forward.
    await page.evaluate(() => { location.hash = '#object-taxonomy?code=SOT-14.02'; });
    await page.waitForTimeout(800);
    assert.deepEqual(await page.evaluate(() => sotTreeSelected), { level: 'class', code: 'SOT-14.02', name: null });
    await page.evaluate(() => { location.hash = '#object-taxonomy?object=Nope'; });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => sotTreeSelected.code), 'SOT-14.02', 'unknown object ignored');
    assert.deepEqual(pageErrors, []);
  });
});

test('class counts and the lifecycle filter narrow both views; search highlights', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy`, { waitUntil: 'load' });
    assert.equal(await page.locator('.sot-stat-shown').count(), 0, 'no "shown" count while unfiltered');
    const objectRows = () => page.locator('#sotTreeShell .tree-row[data-level="object"]').count();

    await page.click('#sotStatsBar [data-sot-type="Hybrid (Knowledge + Platform)"]');
    const hybrid = await page.evaluate(() => SOT_OBJECTS.filter(o => o.type === 'Hybrid (Knowledge + Platform)').length);
    assert.equal(await objectRows(), hybrid);
    assert.equal(await page.getAttribute('#sotStatsBar [data-sot-type="Hybrid (Knowledge + Platform)"]', 'aria-pressed'), 'true');
    assert.match(await page.textContent('.sot-stat-shown'), new RegExp(`^${hybrid}\\s*shown`));
    await page.click('#sotStatsBar [data-sot-type="Hybrid (Knowledge + Platform)"]');

    await page.selectOption('#sotLifecycleFilter', 'not-active');
    const notActive = await page.evaluate(() => SOT_OBJECTS.filter(o => o.lifecycle !== 'Active').map(o => o.name).sort());
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sotTreeShell .tree-row[data-level="object"]')].map(r => r.dataset.name).sort()), notActive);
    assert.equal(await page.locator('#sotTreeShell .sot-life').count(), notActive.length);
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), [], 'filtered tree');

    await page.click('#sotShowTableView');
    assert.equal(await page.locator('#sotTableBody tr[data-id]').count(), notActive.length);
    assert.deepEqual(await auditVisible(page, 'page'), [], 'table view');
    await page.click('#sotResetBtn');
    assert.equal(await page.locator('#sotTableBody tr[data-id]').count(), await page.evaluate(() => SOT_OBJECTS.length));
    await page.click('#sotShowTreeView');

    await page.fill('#sotTreeSearch', 'lookup');
    assert.match(await page.textContent('#sotTreeCount'), /objects? match or sit under a matching domain, class or subclass for “lookup”/);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#sotTreeShell mark')].every(m => m.textContent.toLowerCase() === 'lookup')));
    await page.fill('#sotTreeSearch', '<b>(');
    assert.equal(await page.locator('#sotTreeShell b').count(), 0);
    assert.deepEqual(pageErrors, []);
  });
});

test('at phone width the detail is a bottom sheet', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy`, { waitUntil: 'load' });
    const sheet = () => page.evaluate(() => { const d = document.getElementById('sotTreeDetailPanel'); return { open: d.classList.contains('sot-sheet-open'), top: d.getBoundingClientRect().top }; });
    assert.ok((await sheet()).top >= 852);
    await page.locator('#sotTreeShell .tree-row[data-level="class"]').first().click();
    await page.waitForTimeout(400);
    const open = await sheet();
    assert.ok(open.open && open.top < 852, JSON.stringify(open));
    await page.click('#sotTreeDetailPanel .sot-sheet-close');
    assert.equal((await sheet()).open, false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});
