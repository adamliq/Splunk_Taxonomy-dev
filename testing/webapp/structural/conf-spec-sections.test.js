'use strict';
// The Settings sections of these conf-file articles are generated from Splunk's .conf.spec
// files (scripts/spec/). These checks catch a partial regeneration or a hand edit that leaves
// a section's stated counts out of step with its actual rows and stanzas.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();
const GENERATED = ['server', 'limits', 'restmap', 'health', 'inputs', 'outputs', 'indexes', 'web', 'savedsearches', 'web-features',
  'wmi', 'transactiontypes', 'field-filters', 'workload-pools', 'workload-rules', 'workload-policy', 'splunk-launch', 'user-seed',
  'multikv', 'segmenters', 'metric-alerts', 'metric-rollups', 'agent-management', 'authentication-node', 'global-banner',
  'checklist', 'procmon-filters', 'source-classifier', 'times'];
// Section ids: one per generated article, plus the Tags article's CIM tag list (tags.conf.cim.spec).
const SECTION_IDS = [...GENERATED.map(prefix => `${prefix}-conf-settings`), 'tags-conf-cim-settings'];

function section(id) {
  const start = text.indexOf(`<section id="${id}" class="eccs-detail-section">`);
  assert.ok(start !== -1, `${id} section not found`);
  return text.slice(start, text.indexOf('</section>', start));
}

for (const id of SECTION_IDS) {
  test(`${id} matches its stated setting and stanza counts`, () => {
    const html = section(id);
    // indexes.conf has no stanza lines, so it is grouped into the spec's banner sections instead.
    const stated = html.match(/(\d+) settings (?:across|in) (\d+) (?:stanzas?|sections?)/);
    assert.ok(stated, 'source note with counts is missing');
    const rows = (html.match(/<tr><td>/g) || []).length;
    const headings = (html.match(/<h4 id="[^"]+" class="spec-stanza">/g) || []).length;
    // Settings outside any stanza (e.g. inputs.conf's host/index/source) get their own group,
    // which isn't one of the stated stanzas. (Matched by text: restmap.conf has a real [global].)
    const globalGroups = (html.match(/class="spec-stanza">Settings outside any stanza<\/h4>/g) || []).length;
    const navLinks = (html.match(/<a href="#[^"]+-stanza-[^"]+">/g) || []).length;
    assert.equal(rows, Number(stated[1]), 'row count differs from the stated number of settings');
    assert.equal(headings - globalGroups, Number(stated[2]), 'stanza/section headings differ from the stated number');
    assert.equal(navLinks, headings, 'stanza jump links differ from stanza headings');
  });
}

test('no generated article still carries the old "Lighter entry" disclaimer', () => {
  for (const prefix of GENERATED) {
    const start = text.indexOf(`<section id="${prefix}-conf-settings"`);
    const articleStart = text.lastIndexOf('<article ', start);
    const articleEnd = text.indexOf('</article>', start);
    assert.ok(!/Lighter entry/.test(text.slice(articleStart, articleEnd)), `${prefix}.conf article still says "Lighter entry"`);
  }
});
