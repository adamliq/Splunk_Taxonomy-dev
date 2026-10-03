'use strict';
// Diagram labels read at 11px or more. The onboarding journey map (both routes) sizes its labels
// at 12.5 units and is never drawn below 0.885 scale: beside the inspector while it fits, and
// otherwise at full width with the inspector as a bottom sheet (a station picked there stays
// visible above the sheet). No label overlaps another or leaves the map. The lifecycle pyramid's
// labels are 11.5 units or more, the side labels clear their brackets and the layer labels stay
// inside their shapes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');
const { injectAxe, auditVisible } = require('../lib/axe-audit');

const mapCheck = page => page.evaluate(() => {
  const svg = document.querySelector('#onboardingFlowMapWrap svg'), ctm = svg.getScreenCTM(), scale = Math.hypot(ctm.a, ctm.b);
  const texts = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim());
  const boxes = texts.map(t => ({ t: t.textContent.trim().slice(0, 20), b: t.getBoundingClientRect() }));
  const chips = [...svg.querySelectorAll('.obj-state-side rect, .obj-feed rect, .obj-tracked rect')].map(r => ({ own: r.parentNode, b: r.getBoundingClientRect() }));
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const overlaps = [];
  boxes.forEach((x, i) => boxes.slice(i + 1).forEach(y => { if (hit(x.b, y.b)) overlaps.push(`${x.t} / ${y.t}`); }));
  chips.forEach(c => texts.forEach((t, i) => { if (!c.own.contains(t) && hit(c.b, boxes[i].b)) overlaps.push(`chip / ${boxes[i].t}`); }));
  const sb = svg.getBoundingClientRect();
  return {
    min: Math.min(...texts.map(t => parseFloat(getComputedStyle(t).fontSize) * scale)),
    overlaps, outside: boxes.filter(x => x.b.right > sb.right + 1 || x.b.left < sb.left - 1).map(x => x.t),
    sheet: document.querySelector('#onboardingPage .obj-main').classList.contains('obj-sheet-mode'),
  };
});

test('journey map labels are 11px+, never overlap, at every width; narrow layouts use a sheet', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [1600, 1400, 1280, 1100, 1030, 900, 770]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      for (const route of ['onboarding', 'detection']) {
        await page.evaluate(r => document.querySelector(`#objRoutes [data-route="${r}"]`).click(), route);
        await page.waitForTimeout(200);
        const m = await mapCheck(page);
        assert.ok(m.min >= 10.95, `${width}px ${route}: smallest label ${m.min.toFixed(2)}px`);
        assert.deepEqual(m.overlaps, [], `${width}px ${route} overlaps`);
        assert.deepEqual(m.outside, [], `${width}px ${route} outside the map`);
        if (width >= 1600) assert.equal(m.sheet, false, `${width}px ${route} should sit beside the inspector`);
        if (width <= 1280) assert.equal(m.sheet, true, `${width}px ${route} should use the sheet`);
        if (m.sheet) {
          const n = await page.locator('#onboardingFlowMapWrap svg [data-item]').count();
          const station = page.locator('#onboardingFlowMapWrap svg [data-item]').nth(Math.floor(n * 0.7));
          await station.scrollIntoViewIfNeeded();
          await station.click();
          await page.waitForTimeout(800);
          const seen = await page.evaluate(() => {
            const insp = document.getElementById('objInspector'), sel = document.querySelector('#onboardingFlowMapWrap svg [aria-pressed="true"]').getBoundingClientRect();
            return { open: insp.classList.contains('obj-open'), above: sel.top >= 0 && sel.bottom <= insp.getBoundingClientRect().top };
          });
          assert.deepEqual(seen, { open: true, above: true }, `${width}px ${route} sheet`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('objInspector')).visibility), 'hidden');
        }
      }
    }
    // The sheet layout passes axe with the sheet open.
    await page.setViewportSize({ width: 1100, height: 900 });
    await injectAxe(page);
    await page.locator('#onboardingFlowMapWrap svg [data-item]').nth(3).click();
    await page.waitForTimeout(400);
    assert.deepEqual(await auditVisible(page, 'page'), []);
    assert.deepEqual(pageErrors, []);
  });
});

test('lifecycle pyramid labels are 11px+, clear the brackets and stay inside their layers', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    for (const width of [1400, 1100, 900, 393]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/index.html#log-assessment-lifecycle`, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const svg = document.querySelector('#lalPyramid svg'), ctm = svg.getScreenCTM(), scale = Math.hypot(ctm.a, ctm.b);
        const texts = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim() && !/\p{Extended_Pictographic}/u.test(t.textContent));
        const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const bad = [];
        svg.querySelectorAll('.lal-layer').forEach(g => {
          const bracket = g.querySelector('path')?.getBoundingClientRect(), poly = g.querySelector('polygon');
          g.querySelectorAll('text').forEach(t => {
            const b = t.getBoundingClientRect();
            if (t.getAttribute('fill') !== '#fff') { if (bracket && hit(b, bracket)) bad.push(`bracket: ${t.textContent}`); return; }
            const inside = [[b.left + 1, b.top + b.height / 2], [b.right - 1, b.top + b.height / 2]].every(([x, y]) => {
              const p = svg.createSVGPoint(); p.x = x; p.y = y; return poly.isPointInFill(p.matrixTransform(svg.getScreenCTM().inverse()));
            });
            if (!inside) bad.push(`outside its layer: ${t.textContent}`);
          });
        });
        return { min: Math.min(...texts.map(t => parseFloat(getComputedStyle(t).fontSize) * scale)), bad, flow: [...document.querySelectorAll('#lalFlows text')].map(t => parseFloat(getComputedStyle(t).fontSize)) };
      });
      assert.ok(r.min >= 11, `${width}px: smallest pyramid label ${r.min.toFixed(2)}px`);
      assert.deepEqual(r.bad, [], `${width}px`);
      assert.ok(r.flow.every(s => s >= 11), `${width}px flow labels ${r.flow}`);
    }
    assert.deepEqual(pageErrors, []);
  });
});
