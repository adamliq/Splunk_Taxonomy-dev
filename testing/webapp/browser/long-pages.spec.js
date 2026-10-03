'use strict';
// Readability pass: no page text under 11px (the S3 calculator's charts are drawn at the width
// they are shown at, so their labels stay 11-12px on a phone too); every page opens with the
// same banner and h2; Framework overview's steps open the pages that do each step; and the three
// longest pages fold -- the S3 calculator (sections, a sticky bar with "Go to section" and the
// live total), Concepts & definitions (categories) and the Configuration file reference (a
// compact list by default, the full cards on request).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

// Visible HTML text smaller than 11px on the page (SVG diagrams are measured separately).
const smallText = (page, name) => page.evaluate(n => {
  const out = [], walker = document.createTreeWalker(pageViews[n], NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    const el = t.parentElement;
    if (!t.textContent.trim() || el.closest('svg') || !el.getClientRects().length || getComputedStyle(el).color === 'rgba(0, 0, 0, 0)') continue;
    if (parseFloat(getComputedStyle(el).fontSize) < 11) out.push(`${el.className || el.tagName}: ${t.textContent.trim().slice(0, 20)}`);
  }
  return out.slice(0, 5);
}, name);

test('no page text under 11px, at desktop and phone widths', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [1400, 393]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
      const pages = await page.evaluate(() => Object.keys(pageViews));
      for (const name of pages) {
        await page.evaluate(n => setActivePage(n, false), name);
        await page.waitForTimeout(120);
        assert.deepEqual(await smallText(page, name), [], `${width}px ${name}`);
      }
      // The S3 charts, opened and drawn at this width.
      await page.evaluate(() => { setActivePage('s3calc', false); s3cGo('s3c-capacity'); });
      await page.waitForTimeout(500);
      const chartText = await page.evaluate(() => [...document.querySelectorAll('#s3c-capacity svg text')].map(t => parseFloat(getComputedStyle(t).fontSize) * Math.hypot(t.getScreenCTM().a, t.getScreenCTM().b)));
      assert.ok(chartText.length >= 30, `chart labels: ${chartText.length}`);
      assert.ok(Math.min(...chartText) >= 10.9, `${width}px smallest chart label ${Math.min(...chartText)}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    }
    assert.deepEqual(pageErrors, []);
  });
});

test('every page opens with a banner and its own h2; Framework overview steps open their pages', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
    const titles = { taxonomy: 'Onboard taxonomy', refFrameworkOverview: 'Framework overview', refConceptDefinitions: 'Concepts & definitions',
      refAssessmentMethods: 'Assessment methodologies', refStandardsReferences: 'Standards & references',
      refConfigFileReferences: 'Configuration file reference', dataPipeline: 'Data Pipeline' };
    for (const [name, title] of Object.entries(titles)) {
      await page.evaluate(n => setActivePage(n, false), name);
      const hero = await page.evaluate(n => { const h = pageViews[n].querySelector('.patterns-hero'); return h && { first: pageViews[n].firstElementChild === h, h2: h.querySelector('h2').textContent, eyebrow: h.querySelector('.eyebrow').textContent }; }, name);
      assert.ok(hero && hero.first && hero.eyebrow, `${name}: ${JSON.stringify(hero)}`);
      assert.equal(hero.h2, title);
    }
    const expected = ['taxonomy', 'viability', 'patterns', 'assessments', 'assessments', 'assurance', 'refConceptDefinitions', 'refAssessmentMethods', 'refStandardsReferences'];
    for (const [i, target] of expected.entries()) {
      await page.evaluate(() => setActivePage('refFrameworkOverview'));
      await page.locator('#frameworkOverview [data-info-page]').nth(i).click();
      assert.equal(await page.evaluate(() => currentActivePageKey), target, `step ${i + 1}`);
    }
    assert.deepEqual(pageErrors, []);
  });
});

test('S3 calculator: folded sections, Go to section, links that open their section, the live total', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#s3-calculator`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const open = () => page.evaluate(() => [...document.querySelectorAll('#s3CalcPage .fold-section')].filter(s => !s.classList.contains('is-folded')).map(s => s.id));
    assert.deepEqual(await open(), ['s3c-overview', 's3c-volume', 's3c-cost-summary']);
    assert.ok(await page.evaluate(() => pageViews.s3calc.offsetHeight) < 7000);
    // The sticky bar stays at the top of the screen, carrying the total.
    await page.evaluate(() => scrollTo(0, 3000));
    await page.waitForTimeout(100);
    assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.s3c-bar').getBoundingClientRect().top)) <= 1);
    assert.match(await page.textContent('#s3cBarTotal'), /^Monthly A\$[\d,.]+ · Annual A\$[\d,.]+$/);

    await page.selectOption('#s3cJump', 's3c-projection');
    await page.waitForTimeout(900);
    const projection = await page.evaluate(() => { const s = document.getElementById('s3c-projection'); return { open: !s.classList.contains('is-folded'), top: s.getBoundingClientRect().top, select: document.getElementById('s3cJump').value }; });
    assert.ok(projection.open && projection.top > 40 && projection.top < 120 && projection.select === '', JSON.stringify(projection));

    // "Pricing Configuration" in the intro opens that section without leaving the page.
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#s3CalcPage a[data-s3c-go="s3c-pricing"]');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => !document.getElementById('s3c-pricing').classList.contains('is-folded')), true);
    assert.equal(await page.evaluate(() => currentActivePageKey), 's3calc');

    // A fold's heading toggles it; Expand all / Collapse all reach every section.
    await page.click('#s3c-ingest .fold-toggle');
    assert.equal(await page.getAttribute('#s3c-ingest .fold-toggle', 'aria-expanded'), 'true');
    assert.equal(await page.getAttribute('#s3c-ingest-body', 'hidden'), null);
    await page.click('[data-s3c-fold="close"]');
    assert.deepEqual(await open(), []);
    assert.equal(await page.getAttribute('#s3c-volume-body', 'hidden'), 'until-found');
    await page.click('[data-s3c-fold="open"]');
    assert.equal((await open()).length, 15);

    // Changing an input updates the total in the bar.
    const before = await page.textContent('#s3cBarTotal');
    await page.evaluate(() => { const i = document.querySelector('#s3c-volume input[type=number]'); i.value = String(+i.value * 2); i.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.notEqual(await page.textContent('#s3cBarTotal'), before);

    await injectAxe(page);
    await page.click('[data-s3c-fold="close"]');
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('Concepts fold by category; search, chips and links open the group they need', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#concept-definitions`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const open = () => page.evaluate(() => [...document.querySelectorAll('#conceptGrid .concept-group')].filter(g => !g.classList.contains('is-folded')).map(g => g.dataset.conceptGroup));
    assert.deepEqual(await open(), ['Collection']);
    assert.ok(await page.evaluate(() => pageViews.refConceptDefinitions.offsetHeight) < 2500);
    // Heading outline: page h2 > category h3 > card h4.
    assert.equal(await page.evaluate(() => document.querySelectorAll('#conceptGrid h3 > .concept-fold').length), 5);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#conceptGrid .concept-card h4').length), 81);

    await page.click('#conceptCategoryNav a:has-text("Assurance")');
    await page.waitForTimeout(800);
    assert.deepEqual(await open(), ['Collection', 'Assurance']);
    assert.ok(Math.abs(await page.evaluate(() => document.getElementById('concept-cat-assurance').getBoundingClientRect().top)) < 30);

    await page.fill('#conceptSearch', 'score');
    await page.waitForTimeout(200);
    const groups = await page.evaluate(() => document.querySelectorAll('#conceptGrid .concept-group').length);
    assert.equal((await open()).length, groups, 'a search opens every group with a match');
    await page.fill('#conceptSearch', '');
    await page.waitForTimeout(200);
    assert.deepEqual(await open(), ['Collection', 'Assurance']);

    await page.click('#conceptCollapseAll');
    assert.deepEqual(await open(), []);
    await page.click('#concept-cat-governance .concept-fold');
    assert.deepEqual(await open(), ['Governance']);
    await page.click('#conceptExpandAll');
    assert.equal((await open()).length, 5);

    // Linking to one concept opens its group.
    await page.click('#conceptCollapseAll');
    await page.evaluate(() => openReferenceConcept('Data Source Assurance'));
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => currentActivePageKey), 'refConceptDefinitions');
    assert.ok(await page.evaluate(() => { const c = document.querySelector('.concept-card.highlight'); const r = c.getBoundingClientRect(); return c.dataset.conceptTerm === 'Data Source Assurance' && r.top > 0 && r.bottom < innerHeight; }));

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('Configuration file reference: a compact list by default, each row opening its file', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/index.html#config-file-reference`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    assert.equal(await page.getAttribute('[data-conf-layout="list"]', 'aria-pressed'), 'true');
    const listHeight = await page.evaluate(() => pageViews.refConfigFileReferences.offsetHeight);
    assert.ok(listHeight < 4000, `list ${listHeight}px`);
    assert.match(await page.getAttribute('#configFileReferencesGrid .method-card [data-open-reference-detail]', 'aria-label'), /^Open detailed reference: .+ Configuration$/);

    await page.click('#configFileReferencesGrid .method-card:nth-child(2)', { position: { x: 40, y: 20 } });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.getElementById('alertActionsConfReferenceView')?.offsetParent !== null), true);

    await page.evaluate(() => setActivePage('refConfigFileReferences'));
    await page.click('[data-conf-layout="cards"]');
    assert.ok(await page.evaluate(() => pageViews.refConfigFileReferences.offsetHeight) > listHeight * 1.5);
    assert.equal(await page.isVisible('#configFileReferencesGrid .method-card .method-list'), true);
    // The choice is remembered.
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.getAttribute('[data-conf-layout="cards"]', 'aria-pressed'), 'true');
    await page.click('[data-conf-layout="list"]');

    await injectAxe(page);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});
