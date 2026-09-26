'use strict';
// The Settings sections of these conf-file articles are generated from Splunk's .conf.spec
// files (scripts/spec/). These checks catch a partial regeneration or a hand edit that leaves
// a section's stated counts out of step with its actual rows and stanzas.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();
const GENERATED = ['server', 'limits', 'restmap', 'health'];

function section(prefix) {
  const start = text.indexOf(`<section id="${prefix}-conf-settings" class="eccs-detail-section">`);
  assert.ok(start !== -1, `${prefix}-conf-settings section not found`);
  return text.slice(start, text.indexOf('</section>', start));
}

for (const prefix of GENERATED) {
  test(`${prefix}.conf settings section matches its stated setting and stanza counts`, () => {
    const html = section(prefix);
    const stated = html.match(/(\d+) settings across (\d+) stanzas/);
    assert.ok(stated, 'source note with counts is missing');
    const rows = (html.match(/<tr><td>/g) || []).length;
    const stanzas = (html.match(/<h4 id="[^"]+" class="spec-stanza">/g) || []).length;
    const navLinks = (html.match(/<a href="#[^"]+-stanza-[^"]+">/g) || []).length;
    assert.equal(rows, Number(stated[1]), 'row count differs from the stated number of settings');
    assert.equal(stanzas, Number(stated[2]), 'stanza headings differ from the stated number of stanzas');
    assert.equal(navLinks, stanzas, 'stanza jump links differ from stanza headings');
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
