'use strict';
// Shared axe-core runner for the accessibility specs. index.html is one 13 MB document, and
// axe models the whole document on every run, so each view is checked with every other page
// view (and every other reference article) detached first, then put back afterwards. That
// keeps a run to about a second and lets one page load cover every view.

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

module.exports = { injectAxe, auditVisible, WCAG_TAGS };
