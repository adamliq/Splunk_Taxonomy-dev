'use strict';
// Splunk object taxonomy sunburst: every object in the Splunk object taxonomy appears once, under
// domain > class > subclass (a one-object subclass is drawn as its object; components sit
// outside their parent); an arc zooms in, the arc in focus zooms back out, and the panel's
// buttons do the same from the keyboard; colour by object type (keyed with counts) or a
// highlighted value; search; a link per zoom and colour; Open in Tree Explorer; phones.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const clickArc = (page, key) => page.evaluate(k => {
  const g = [...document.querySelectorAll('#sbChart .slice')].find(s => s.__data__.data.key === k);
  g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, key);
const state = page => page.evaluate(() => ({ focus: sbState.focus ? sbState.focus.key : null, title: document.querySelector('#sbPanel h3').textContent, hash: location.hash }));

test('the sunburst holds every object once; arcs and the panel zoom in and out', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${baseUrl}/index.html#object-taxonomy-sunburst`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => {
      const objects = sbState.data.nodes.filter(n => n.kind === 'object');
      return {
        page: currentActivePageKey, tab: document.getElementById('showSotSunburstPage').getAttribute('aria-selected'),
        once: objects.length === SOT_OBJECTS.length && new Set(objects.map(n => n.obj)).size === SOT_OBJECTS.length,
        components: objects.filter(n => n.obj.parent).every(n => sbState.data.parentOf.get(n).obj.name === n.obj.parent),
        domains: sbState.data.root.children.length,
        drawn: document.querySelectorAll('#sbChart .slice').length,
        svg: document.querySelector('#sbChart svg').getBoundingClientRect().width,
      };
    });
    assert.deepEqual({ ...data, drawn: data.drawn > 450, svg: data.svg > 600 }, { page: 'sotSunburst', tab: 'true', once: true, components: true, domains: 14, drawn: true, svg: true });

    // An arc zooms in; the same arc, now in the centre, zooms out; the background resets.
    await clickArc(page, 'SOT-10');
    assert.deepEqual(await state(page), { focus: 'SOT-10', title: 'Splunk Solution & Premium Product Objects', hash: '#object-taxonomy-sunburst?focus=SOT-10' });
    await clickArc(page, 'SOT-10.01');
    assert.equal((await state(page)).focus, 'SOT-10.01');
    await clickArc(page, 'SOT-10.01');
    assert.equal((await state(page)).focus, 'SOT-10');
    // The panel: a child button zooms in, a crumb zooms out.
    await page.click('#sbPanel .sb-children button:has-text("Enterprise Security")');
    assert.equal((await state(page)).focus, 'SOT-10.01');
    await page.click('#sbPanel .sb-children button:has-text("Response Plan")');
    assert.match(await page.textContent('#sbPanel h4'), /Components/);
    assert.equal(await page.locator('#sbPanel .sb-children li').count(), 5);
    await page.click('#sbPanel .sb-crumbs button:has-text("All domains")');
    assert.deepEqual(await state(page), { focus: null, title: 'Splunk object taxonomy', hash: '#object-taxonomy-sunburst' });
    assert.match(await page.textContent('#sbPanel .sb-sub'), /^398 objects in 14 domains$|^\d+ objects in 14 domains$/);

    // Colour by type: the key counts every object; the arcs carry those colours.
    const key = await page.evaluate(() => [...document.querySelectorAll('#sbLegend .sb-key strong')].map(s => +s.textContent));
    assert.equal(key.reduce((a, b) => a + b, 0), await page.evaluate(() => SOT_OBJECTS.length));
    // Colour by product highlights one value; the arcs in blue are exactly those objects.
    await page.selectOption('#sbColorBy', 'product');
    // Colours fade in over the transition; wait for the object arcs to settle.
    await page.waitForFunction(() => [...document.querySelectorAll('#sbChart .slice')].filter(s => s.__data__.data.kind === 'object').every(s => /^rgb\((42, 120, 214|179, 178, 171)\)$/.test(s.querySelector('path.main-arc').style.fill)), null, { timeout: 5000 }).catch(() => {});
    const product = await page.evaluate(() => ({
      value: document.getElementById('sbValue').value, shown: !document.getElementById('sbValueWrap').hidden,
      key: +document.querySelector('#sbLegend .sb-key strong').textContent,
      expected: SOT_OBJECTS.filter(o => o.product === document.getElementById('sbValue').value).length,
      blue: [...document.querySelectorAll('#sbChart .slice')].filter(s => s.__data__.data.kind === 'object' && s.querySelector('path.main-arc').style.fill === 'rgb(42, 120, 214)').length,
      hash: location.hash,
    }));
    assert.equal(product.shown, true);
    assert.equal(product.key, product.expected);
    assert.equal(product.blue, product.expected);
    assert.equal(product.hash, `#object-taxonomy-sunburst?color=product&value=${encodeURIComponent(product.value).replace(/%20/g, '+')}`);
    await page.selectOption('#sbColorBy', 'type');
    assert.equal(await page.isVisible('#sbValueWrap'), false);

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('search, links, Open in Tree Explorer and Back; phones', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    // A link opens a zoom and a colour.
    await page.goto(`${baseUrl}/index.html#object-taxonomy-sunburst?focus=SOT-05.06&color=lifecycle&value=Active`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    assert.deepEqual(await page.evaluate(() => ({ focus: sbState.focus.key, mode: document.getElementById('sbColorBy').value, value: document.getElementById('sbValue').value })), { focus: 'SOT-05.06', mode: 'lifecycle', value: 'Active' });

    // Search finds objects by name, code or instance ID; Enter opens the first match.
    await page.fill('#sbSearch', 'RPTOK');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sbResults button')].map(b => b.textContent)), ['RPTOK-001Response Plan Token']);
    await page.press('#sbSearch', 'Enter');
    assert.equal(await page.isVisible('#sbResults'), false);
    const token = await state(page);
    assert.equal(token.focus, 'RPTOK-001');
    assert.match(await page.textContent('#sbPanel'), /Part of\s*Response Plan/);
    assert.equal(await page.textContent('#sbPanel .sb-crumbs'), 'All domains›SOT-10›SOT-10.01›RP-001›RPTOK-001');
    await page.fill('#sbSearch', 'zzzz');
    assert.match(await page.textContent('#sbResults'), /Nothing in the taxonomy matches/);
    await page.press('#sbSearch', 'Escape');

    await page.click('#sbPanel [data-sb-open]');
    assert.deepEqual(await page.evaluate(() => ({ page: currentActivePageKey, selected: document.querySelector('#sotTreeShell .tree-row.selected').dataset.name })), { page: 'objectTaxonomy', selected: 'Response Plan Token' });
    await page.goBack();
    await page.waitForTimeout(500);
    assert.equal((await state(page)).focus, 'RPTOK-001');
    // The Tree Explorer page links here.
    await page.evaluate(() => setActivePage('objectTaxonomy'));
    await page.click('#objectTaxonomyPage .patterns-hero a[href="#object-taxonomy-sunburst"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => currentActivePageKey), 'sotSunburst');

    // Phones: the chart fits the screen, the panel sits below it.
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.waitForTimeout(400);
      const fit = await page.evaluate(() => {
        const svg = document.querySelector('#sbChart svg').getBoundingClientRect(), panel = document.getElementById('sbPanel').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - innerWidth, inside: svg.left >= 0 && svg.right <= innerWidth, below: panel.top >= svg.bottom };
      });
      assert.deepEqual(fit, { overflow: 0, inside: true, below: true }, `${width}px`);
    }
    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});
