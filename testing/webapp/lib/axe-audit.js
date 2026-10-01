'use strict';
// Shared axe-core runner for the accessibility specs. index.html is one 13 MB document, and
// axe models the whole document on every run, so each view is checked with every other page
// view (and every other reference article) detached first, then put back afterwards. That
// keeps a run to about a second and lets one page load cover every view. The desktop and phone
// specs are separate files so node --test runs them in parallel.

const fs = require('fs');

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function axeSource() {
  let file;
  try {
    file = require.resolve('axe-core/axe.min.js');
  } catch (e) {
    throw new Error('The `axe-core` package is not resolvable. Run npm install inside testing/webapp before the browser suite.');
  }
  return fs.readFileSync(file, 'utf8');
}

async function injectAxe(page) {
  await page.addScriptTag({ content: axeSource() });
}

// Runs axe against `scope` ('page' = the visible page view, 'article' = the open reference
// article, 'chrome' = sidebar, header and breadcrumb). Returns one line per violation.
async function auditVisible(page, scope) {
  return page.evaluate(async ({ scope, tags }) => {
    const keep = el => !el.hidden;
    const parked = [];
    document.querySelectorAll('.page-view, article.eccs-reference').forEach(el => {
      if (keep(el)) return;
      const marker = document.createComment('axe-parked');
      el.replaceWith(marker);
      parked.push([marker, el]);
    });
    try {
      const context = scope === 'chrome'
        ? { include: ['.app-sidebar', '.app-header', '.app-breadcrumb'].map(s => document.querySelector(s)).filter(Boolean) }
        : document.querySelector(scope === 'article' ? 'article.eccs-reference:not([hidden])' : '.page-view:not([hidden])');
      const result = await axe.run(context, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return result.violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
    } finally {
      parked.forEach(([marker, el]) => marker.replaceWith(el));
    }
  }, { scope, tags: WCAG_TAGS });
}

// Every sidebar page (plus the journey map's detection route) and the app chrome, at the
// current viewport. With the nav drawer open too when it is collapsed (phone width).
async function auditAllPages(page) {
  const failures = [];
  const check = async (label, scope) => { for (const line of await auditVisible(page, scope)) failures.push(`${label}: ${line}`); };
  await check('chrome', 'chrome');
  if (await page.isVisible('#appNavToggle')) {
    await page.click('#appNavToggle');
    await page.waitForTimeout(200);
    await check('chrome (menu open)', 'chrome');
    // The open drawer covers its own toggle, so close it the way the toggle's handler would be reached.
    await page.evaluate(() => document.getElementById('appNavToggle').click());
  }
  const pages = await page.evaluate(() => Object.keys(pageTabs).filter(k => pageTabs[k]));
  if (pages.length < 31) failures.push(`expected at least 31 pages, found ${pages.length}`);
  for (const name of pages) {
    await page.evaluate(n => setActivePage(n), name);
    await page.waitForTimeout(150);
    await check(name, 'page');
  }
  await page.evaluate(() => { setActivePage('onboarding'); document.querySelector('#objRoutes [data-route="detection"]').click(); });
  await page.waitForTimeout(150);
  await check('onboarding (detection route)', 'page');
  return failures;
}

// Every reference article, opened the way the sidebar and in-page links open them.
async function auditAllArticles(page) {
  const failures = [];
  const details = await page.evaluate(() => [...document.querySelectorAll('article.eccs-reference[id$="ReferenceView"]')]
    .map(a => a.id.replace(/ReferenceView$/, '').replace(/[A-Z]/g, c => '-' + c.toLowerCase())));
  if (details.length < 101) failures.push(`expected at least 101 articles, found ${details.length}`);
  for (const detail of details) {
    await page.evaluate(d => showReferenceDetail(d), detail);
    for (const line of await auditVisible(page, 'article')) failures.push(`${detail}: ${line}`);
  }
  return failures;
}

// Loads the app at the given width with axe injected.
async function openForAudit(page, baseUrl, width) {
  await page.setViewportSize({ width, height: width < 600 ? 852 : 1000 });
  await page.goto(`${baseUrl}/index.html#info`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await injectAxe(page);
}

module.exports = { injectAxe, auditVisible, auditAllPages, auditAllArticles, openForAudit, WCAG_TAGS };
