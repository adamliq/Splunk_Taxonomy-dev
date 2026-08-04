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

describe('Prompt library submenu is alphabetically ordered', () => {
  test('all 27 prompt-submenu-button labels are in ascending alphabetical order', () => {
    const text = readIndexHtml();
    const section = text.match(/<nav class="prompt-submenu"[\s\S]*?<\/nav>/)[0];
    const labels = [...section.matchAll(/<button[^>]*class="prompt-submenu-button[^"]*"[^>]*>([^<]+)<\/button>/g)]
      .map(m => m[1].replace(/&amp;/g, '&').trim());
    assert.equal(labels.length, 34);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(labels, sorted);
  });
});

describe('Splunk Index Sizing Calculator page', () => {
  const text = readIndexHtml();
  test('tab, page section and calculate button all exist and are wired into page navigation', () => {
    assert.match(text, /<button id="showSizingPage" class="page-tab"/);
    assert.match(text, /<section id="sizingCalculatorPage" class="page-view reference-page" role="tabpanel" aria-labelledby="showSizingPage" hidden>/);
    assert.match(text, /sizing: document\.getElementById\("showSizingPage"\)/);
    assert.match(text, /sizing: document\.getElementById\("sizingCalculatorPage"\)/);
    assert.match(text, /"info", "onboarding", "taxonomy", "assessments", "sizing", "reference"/);
    assert.match(text, /<button id="calculateIndexSizing" type="button">Calculate<\/button>/);
  });
  test('on-premises and cloud deployment toggle buttons both exist with distinct tier terminology', () => {
    const section = text.match(/<section id="sizingCalculatorPage"[\s\S]*?<\/section>\s*<\/section>/)[0];
    assert.match(section, /id="sizingDeployOnPrem"/);
    assert.match(section, /id="sizingDeployCloud"/);
    assert.match(section, /Hot &rarr; Warm &rarr; Cold &rarr; Frozen &rarr; Thawed/);
    assert.match(section, /Dynamic Data Active \(searchable\) &rarr; Dynamic Data Self Storage \(archive\)/);
  });
  test('indexer clustering inputs (RF, SF, indexer capacity) are on-premises only', () => {
    assert.match(text, /<section id="sizingClusterSection" class="reference-section">/);
    assert.match(text, /clusterSection\.hidden = cloud;/);
  });
  test('compression is adjustable directly and via a sourcetype preset dropdown, applied in both deployment modes', () => {
    assert.match(text, /id="sizingRawPct" type="number" value="15"/);
    assert.match(text, /id="sizingTsidxPct" type="number" value="35"/);
    assert.match(text, /id="sizingSourcetypePreset"/);
    const presetSection = text.match(/<select id="sizingSourcetypePreset">[\s\S]*?<\/select>/)[0];
    const presetCount = (presetSection.match(/<option value=/g) || []).length;
    assert.ok(presetCount >= 6, `expected several sourcetype presets, found ${presetCount}`);
    assert.match(text, /rawPctInput\.value = rawPct;/);
    assert.match(text, /tsidxPctInput\.value = tsidxPct;/);
    // Both deployment branches must read the adjustable fractions, not a hardcoded 0.15/0.35/0.5.
    assert.match(text, /const rawFraction = Math\.max\(0, sv\("sizingRawPct"\)\) \/ 100;/);
    assert.match(text, /const tsidxFraction = Math\.max\(0, sv\("sizingTsidxPct"\)\) \/ 100;/);
    assert.match(text, /perCopyRatio = rf \* rawFraction \+ sf \* tsidxFraction;/);
    assert.match(text, /frozenStorage = dailyIngest \* frozenDays \* rawFraction;/);
    assert.match(text, /searchableStorage = dailyIngest \* searchableDays \* \(rawFraction \+ tsidxFraction\);/);
    assert.match(text, /archiveStorage = dailyIngest \* archiveDays \* rawFraction;/);
  });
});

describe('Companion Tools external links page', () => {
  test('tab, page section and navigation wiring all exist', () => {
    assert.match(text, /<button id="showExternalToolsPage" class="page-tab"[^>]*>Companion tools<\/button>/);
    assert.match(text, /<section id="externalToolsPage" class="page-view reference-page" role="tabpanel" aria-labelledby="showExternalToolsPage" hidden>/);
    assert.match(text, /externalTools: document\.getElementById\("showExternalToolsPage"\)/);
    assert.match(text, /externalTools: document\.getElementById\("externalToolsPage"\)/);
    assert.match(text, /"info", "onboarding", "taxonomy", "assessments", "sizing", "reference", "prompts", "cmei", "assurance", "viability", "catalogue", "patterns", "health", "externalTools"/);
  });
  test('all 5 external links are present, open in a new tab, and are safely rel-attributed', () => {
    const section = text.match(/<section id="externalToolsPage"[\s\S]*<\/main>/)[0];
    const links = [
      ['https://adamliq.github.io/Splunk-spl-library/', 'Splunk SPL Library'],
      ['https://adamliq.github.io/lens/', 'LENS'],
      ['https://adamliq.github.io/Winevent-catalogue/', 'Windows Event Catalogue'],
      ['https://adamliq.github.io/knowledgegraph-splunk/', 'Knowledge Graph -- Splunk'],
      ['https://adamliq.github.io/knowledgegraph-logcollection/', 'Knowledge Graph -- Log Collection'],
    ];
    for (const [href, title] of links) {
      const escapedHref = href.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      const cardRe = new RegExp(`<a class="info-action-card" href="${escapedHref}" target="_blank" rel="noopener noreferrer"><strong>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</strong>`);
      assert.match(section, cardRe, `missing or malformed card for ${title}`);
    }
  });
});
