'use strict';
// One test per distinct bug fixed in index.html this session, each written
// so it fails again if the fix is ever accidentally reverted or overwritten
// by a future edit. General taxonomy/nav/content regressions live in the
// other structural test files; this one is for one-off, narrowly-scoped
// fixes that don't fit elsewhere.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readIndexHtml, INDEX_HTML_PATH } = require('../lib/parse-index');

const text = readIndexHtml();

describe('Quick actions card text overflow (Info page)', () => {
  test('.info-action-card has white-space: normal so description text wraps instead of overflowing', () => {
    const m = text.match(/\.info-action-card\s*\{([^}]*)\}/);
    assert.ok(m, '.info-action-card rule not found');
    assert.match(m[1], /white-space:\s*normal/, '.info-action-card is missing white-space: normal -- ' +
      'buttons default to white-space: nowrap in the browser UA stylesheet, which makes the ' +
      'description text overflow past the card border instead of wrapping');
  });
});

describe('anchor-nav hero-only styling stays scoped', () => {
  test('.eccs-anchor-nav a is still white-on-translucent (hero-only) and NOT reused for light sections', () => {
    const m = text.match(/\.eccs-anchor-nav a\s*\{([^}]*)\}/);
    assert.ok(m);
    assert.match(m[1], /color:#fff/);
  });
  test('.eccs-subsection-nav a exists as the light-background equivalent used inside body sections', () => {
    const m = text.match(/\.eccs-subsection-nav a\s*\{([^}]*)\}/);
    assert.ok(m, '.eccs-subsection-nav a rule not found');
    assert.doesNotMatch(m[1], /color:#fff/, '.eccs-subsection-nav a should not use hero white text on a light background');
  });
});

describe('embedded <script> stays syntactically valid', () => {
  test('node --check passes on the extracted <script> body', () => {
    const scriptMatch = text.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'no <script> block found');
    const tmpFile = path.join(os.tmpdir(), `latch-script-check-${Date.now()}.js`);
    fs.writeFileSync(tmpFile, scriptMatch[1]);
    try {
      execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('there is exactly one <script> block (so the check above covers the whole app)', () => {
    const count = (text.match(/<script>/g) || []).length;
    assert.equal(count, 1);
  });
});

describe('index.html is where the tests think it is', () => {
  test('resolved path ends in /index.html at the repo root', () => {
    assert.match(INDEX_HTML_PATH, /\/index\.html$/);
    assert.ok(fs.existsSync(INDEX_HTML_PATH));
  });
});
