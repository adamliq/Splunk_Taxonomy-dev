'use strict';
// Live click-through equivalent of structural/reference-nav-integrity.test.js.
// The static checks can prove a link's target exists and is in the right
// article, but only a real click proves the JS handler fires, the hash
// updates, and the target actually ends up on screen -- which is exactly
// how the .eccs-subsection-nav bug (native anchor-jump resetting the whole
// SPA to the Info tab) was found.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

// Keys from showReferenceDetail's detailConfig map. Kept in sync manually;
// structural/reference-nav-integrity.test.js separately proves every
// reference article has a detailConfig entry, so a mismatch here (an
// article added without updating this list) will surface as this test
// covering fewer articles than that one expects -- check its article count
// assertion if this list and that one drift apart.
const DETAIL_KEYS = [
  'eccs', 'marginal-novelty', 'icd', 'pivot', 'timestamp-quality', 'log-format-quality',
  'datetime-format', 'datetime-parse', 'username-format', 'line-break', 'log-format-parse',
  'line-length', 'semantic-value', 'response-readiness', 'operational-assurance',
  'threat-detection', 'business-impact-level', 'cyber-value-index', 'log-source-cyber-value',
  'entity-coverage', 'identity-diversity', 'investigation-breadth', 'context-dimension-coverage',
  'investigative-noise-percentage', 'data-source-assurance', 'event-type-coverage',
  'required-field-coverage', 'data-quality-score', 'log-assessment-framework',
];

test('every anchor-nav link in every reference article scrolls to a visible target', { timeout: 300000 }, async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const broken = [];
    let totalLinks = 0;

    for (const key of DETAIL_KEYS) {
      await page.evaluate(k => { showReferenceDetail(k); }, key);
      await page.waitForTimeout(100);

      const navInfo = await page.evaluate(() => {
        const article = [...document.querySelectorAll('article.eccs-reference')].find(a => !a.hidden);
        if (!article) return { articleId: null, links: [] };
        const links = [...article.querySelectorAll('nav.eccs-anchor-nav a, nav.eccs-subsection-nav a')]
          .map(a => a.getAttribute('href'));
        return { articleId: article.id, links };
      });
      assert.ok(navInfo.articleId, `showReferenceDetail("${key}") did not reveal any article`);

      for (const href of navInfo.links) {
        totalLinks++;
        const linkSelector = `#${navInfo.articleId} a[href="${href}"]`;
        const linkEl = await page.$(linkSelector);
        if (!linkEl) { broken.push(`${key} ${href}: link element not found`); continue; }

        await linkEl.click();
        // Smooth-scroll duration varies with distance; poll until the
        // target's position stabilises instead of guessing a fixed wait.
        const check = await page.evaluate(async sel => {
          const target = document.querySelector(sel);
          if (!target) return { found: false };
          let last = null;
          for (let i = 0; i < 20; i++) {
            const top = target.getBoundingClientRect().top;
            if (last !== null && Math.abs(top - last) < 1) break;
            last = top;
            await new Promise(r => setTimeout(r, 100));
          }
          const r = target.getBoundingClientRect();
          return { found: true, visible: target.offsetParent !== null, top: r.top, hash: location.hash };
        }, href);

        // The target's top edge should land somewhere inside the 1000px-tall
        // viewport, not necessarily flush at 0 -- scrollIntoView({block:
        // "start"}) can't push a near-the-bottom target all the way to the
        // top if there isn't enough trailing content left to scroll past.
        const ok = check.found && check.visible && check.hash === href && check.top > -50 && check.top < 1000;
        if (!ok) broken.push(`${key} ${href}: ${JSON.stringify(check)}`);
      }
    }

    assert.ok(totalLinks > 100, `expected well over 100 nav links total, only found ${totalLinks}`);
    assert.deepEqual(broken, [], `broken nav links:\n${broken.join('\n')}`);
    assert.deepEqual(pageErrors, [], `unexpected page errors during navigation:\n${pageErrors.join('\n')}`);
  });
});
