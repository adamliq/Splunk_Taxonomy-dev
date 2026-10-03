'use strict';
// Whole-app pass: Back and Forward move between pages and reference articles (and a link to a
// section inside an article lands on it); record links open a catalogue, assurance, viability,
// pattern or health record; on narrow screens a record opens in a bottom sheet; phone cards are
// compact (key fields, "More details"), every wide table but the ports matrix is cards, banners
// and filters fold so content starts early, and controls are at least 24px; the big tables cut to
// one page as they are built; and every table's header lines up with its rows (the Health table
// was missing its Subcategory header).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const state = page => page.evaluate(() => `${currentActivePageKey} ${location.hash}`);

test('Back and Forward move between pages and articles; article section links land', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await page.click('#infoPage [data-info-page="patterns"]');
    await page.evaluate(() => setActivePage('refConfigFileReferences'));
    await page.click('#configFileReferencesGrid .method-card:nth-child(3)', { position: { x: 30, y: 20 } });
    await page.evaluate(() => showReferenceDetail('props-conf'));
    assert.equal(await state(page), 'reference #props-conf-definition');
    const back = [];
    for (let i = 0; i < 4; i++) { await page.goBack(); await page.waitForTimeout(150); back.push(await state(page)); }
    assert.deepEqual(back, ['reference #app-conf-definition', 'refConfigFileReferences #config-file-reference', 'patterns #logging-patterns', 'info #info']);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('article.eccs-reference')].filter(a => a.offsetParent).length), 0);
    await page.goForward(); await page.waitForTimeout(150);
    assert.equal(await state(page), 'patterns #logging-patterns');

    // A link to an article, and to a section inside one, survives a reload.
    await page.goto('about:blank');
    await page.goto(`${baseUrl}/index.html#outputs-conf-syslog`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const section = await page.evaluate(() => ({ page: currentActivePageKey, open: !!document.getElementById('outputsConfReferenceView').offsetParent, top: document.getElementById('outputs-conf-syslog').getBoundingClientRect().top }));
    assert.ok(section.page === 'reference' && section.open && Math.abs(section.top) < 60, JSON.stringify(section));
    assert.deepEqual(pageErrors, []);
  });
});

test('record links open their record; picking a record writes its link; Copy link copies it', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    const ids = await page.evaluate(() => ({ source: sourceCatalogueRecords[20].sourceId, record: assuranceRecords.at(-1).id, viability: viabilityAssessmentData.at(-1).id, pattern: loggingPatternTableData[30]['Pattern ID'], test: healthCheckTableData[650]['Test ID'] }));
    const links = [
      [`#data-source-catalogue?source=${ids.source}`, 'catalogue', '#catalogueDetail'],
      [`#assurance-model?record=${encodeURIComponent(ids.record)}`, 'assurance', '#assuranceDetail'],
      [`#viability-assessment?record=${encodeURIComponent(ids.viability)}`, 'viability', '#viabilityDetail'],
      [`#logging-patterns?pattern=${ids.pattern}`, 'patterns', null],
      [`#health-checks?test=${ids.test}`, 'health', null],
    ];
    for (const [hash, name, detail] of links) {
      await page.goto('about:blank');
      // A filter left set must not hide the linked record.
      await page.goto(`${baseUrl}/index.html${hash}`, { waitUntil: 'load' });
      // A long smooth scroll (a row near the end of 678) can take a moment on a busy machine.
      await page.waitForFunction(() => { const b = document.querySelector('tr.row-linked')?.getBoundingClientRect(); return b && b.top >= 0 && b.bottom <= innerHeight; }, null, { timeout: 6000 }).catch(() => {});
      const r = await page.evaluate(d => {
        const row = document.querySelector('tr.row-linked'), b = row?.getBoundingClientRect();
        return { page: currentActivePageKey, onScreen: !!b && b.top >= 0 && b.bottom <= innerHeight, text: row?.textContent || '', detail: d ? document.querySelector(`${d} .assurance-detail-code`).textContent : '' };
      }, detail);
      const id = decodeURIComponent(hash.split('=')[1]);
      assert.equal(r.page, name, hash);
      assert.ok(r.onScreen && r.text.includes(id), `${hash}: ${JSON.stringify(r).slice(0, 200)}`);
      if (detail) assert.ok(r.detail.startsWith(id), `${hash} detail ${r.detail}`);
    }
    await page.evaluate(() => setActivePage('catalogue'));
    await page.locator('#catalogueTableBody tr[tabindex]').nth(4).click({ position: { x: 10, y: 8 } });
    const picked = await page.evaluate(() => sourceCatalogueRecords[4].sourceId);
    assert.equal(await page.evaluate(() => location.hash), `#data-source-catalogue?source=${picked}`);
    await page.click('#catalogueDetail .detail-copy-link');
    await page.waitForTimeout(100);
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).endsWith(`#data-source-catalogue?source=${picked}`));
    await page.evaluate(() => setActivePage('health'));
    await page.locator('#healthTableBody .row-copy-link').first().click();
    await page.waitForTimeout(100);
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /#health-checks\?test=TC-/);
    assert.deepEqual(pageErrors, []);
  });
});

test('every table header lines up with its rows; big tables cut to one page as they are built', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    const pages = await page.evaluate(() => Object.keys(pageViews));
    for (const name of pages) {
      await page.evaluate(n => setActivePage(n, false), name);
      await page.waitForTimeout(100);
      const bad = await page.evaluate(n => [...pageViews[n].querySelectorAll('table')].filter(t => t.tHead?.rows.length === 1).map(t => {
        const span = r => [...r.cells].filter(c => !c.classList.contains('flow-card-more')).reduce((a, c) => a + (c.colSpan || 1), 0);
        const row = [...(t.tBodies[0]?.rows || [])].find(r => r.cells.length > 1);
        return row && span(t.tHead.rows[0]) !== span(row) ? `${t.className}: ${span(t.tHead.rows[0])} headers, ${span(row)} cells` : null;
      }).filter(Boolean), name);
      assert.deepEqual(bad, [], name);
    }
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.health-table thead th')].map(th => th.textContent)[4]), 'Subcategory');
    // Opening Questions leaves only the first 100 of 2,747 rows laid out, straight away.
    const cut = await page.evaluate(() => { setActivePage('refQuestions', false); const rows = document.getElementById('questionsTableBody').rows; return { total: rows.length, shown: [...rows].filter(r => !r.classList.contains('flow-cut')).length }; });
    assert.ok(cut.total > 2000 && cut.shown === 100, JSON.stringify(cut));
    // Data pipeline and the unassigned-capabilities table grow with the page too.
    for (const [name, body] of [['dataPipeline', 'dataPipelineTableBody'], ['refRoles', 'rolesUnassignedBody']]) {
      await page.evaluate(n => setActivePage(n, false), name);
      assert.equal(await page.evaluate(b => { const w = document.getElementById(b).closest('.flow-table'); return !!w && w.scrollHeight <= w.clientHeight + 2; }, body), true, name);
    }
    assert.deepEqual(pageErrors, []);
  });
});

test('phone: bottom sheets, compact cards, folded banners and filters, cards for wide tables, 24px targets', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    await injectAxe(page);

    // A record opens in a sheet on screen; Escape closes it.
    for (const [name, body, panel] of [['catalogue', 'catalogueTableBody', 'catalogueDetail'], ['assurance', 'assuranceTableBody', 'assuranceDetail'], ['viability', 'viabilityTableBody', 'viabilityDetail']]) {
      await page.evaluate(n => { setActivePage(n, false); scrollTo(0, 0); }, name);
      const row = page.locator(`#${body} tr[tabindex]`).nth(2);
      await row.scrollIntoViewIfNeeded();
      await row.click({ position: { x: 12, y: 8 } });
      await page.waitForTimeout(300);
      const open = await page.evaluate(p => { const r = document.getElementById(p).getBoundingClientRect(); return r.top > 0 && r.top < innerHeight / 2 && Math.round(r.bottom) <= innerHeight; }, panel);
      assert.equal(open, true, `${name} sheet`);
      assert.deepEqual(await auditVisible(page, 'page'), [], `${name} with sheet open`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(p => getComputedStyle(document.getElementById(p)).visibility, panel), 'hidden');
    }

    // Compact cards: key fields, the rest behind More details.
    await page.evaluate(() => setActivePage('health', false));
    const card = await page.evaluate(() => { const r = document.getElementById('healthTableBody').rows[0]; return { shown: [...r.cells].filter(c => c.offsetHeight && c.dataset.label).map(c => c.dataset.label), h: r.offsetHeight }; });
    assert.deepEqual(card.shown, ['Test ID', 'Test name', 'Category', 'Priority', 'Automation']);
    await page.locator('#healthTableBody .flow-card-more button').first().click();
    assert.equal(await page.evaluate(() => [...document.getElementById('healthTableBody').rows[0].cells].filter(c => c.offsetHeight && c.dataset.label === 'Subcategory').length), 1);

    // Folded banners and filters: content starts within about a screen.
    for (const name of ['health', 'splunkApi', 'catalogue', 'patterns', 'refQuestions']) {
      await page.evaluate(n => { setActivePage(n, false); scrollTo(0, 0); }, name);
      await page.waitForTimeout(150);
      const at = await page.evaluate(n => { const v = pageViews[n], t = v.querySelector('table tbody tr'); return Math.round(t.getBoundingClientRect().top - v.getBoundingClientRect().top); }, name);
      assert.ok(at < 1200, `${name}: first row ${at}px down`);
    }
    await page.evaluate(() => setActivePage('health', false));
    const filters = page.locator('#healthChecksPage .filter-toggle');
    assert.equal(await page.isVisible('#healthCategoryFilter'), false);
    await filters.click();
    await page.selectOption('#healthCategoryFilter', { index: 1 });
    assert.equal(await filters.textContent(), 'Filters (1)');
    await page.click('#resetHealthTable');
    await page.waitForTimeout(50);
    assert.equal(await filters.textContent(), 'Filters');
    const more = page.locator('#healthChecksPage .hero-more');
    assert.equal(await more.isVisible(), true);
    await more.click();
    assert.equal(await more.getAttribute('aria-expanded'), 'true');

    // Nothing but the ports matrix grid (shown on a phone only when asked for) scrolls sideways.
    const pages = await page.evaluate(() => Object.keys(pageViews));
    for (const name of pages) {
      await page.evaluate(n => { setActivePage(n, false); if (n === 's3calc') document.querySelector('[data-s3c-fold="open"]').click(); }, name);
      await page.waitForTimeout(120);
      const sideways = await page.evaluate(n => [...pageViews[n].querySelectorAll('*')].filter(e => e.getClientRects().length && /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 4 && !e.querySelector('#portsMatrixTable')).map(e => e.className || e.tagName), name);
      assert.deepEqual(sideways, [], `${name} scrolls sideways`);
      // Controls are at least 24px (links and term buttons inside sentences excepted; a
      // checkbox inside its label counts the label).
      const small = await page.evaluate(n => [...pageViews[n].querySelectorAll('button, a[href], select, input:not([type=hidden]), summary')].filter(e => {
        if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden' || e.closest('#portsMatrixTable')) return false;
        const b = e.getBoundingClientRect();
        if (b.width === 0 || (b.height >= 23.5 && b.width >= 23.5)) return false;
        if (e.type === 'checkbox' && e.closest('label')) return false;
        if (e.matches('.lal-term')) return false;
        return !(e.tagName === 'A' && getComputedStyle(e).display === 'inline');
      }).map(e => `${e.tagName}.${e.className}`).slice(0, 4), name);
      assert.deepEqual(small, [], `${name} small targets`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(pageErrors, []);
  });
});
