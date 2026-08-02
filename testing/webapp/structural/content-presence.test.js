'use strict';
// Guards the reference content added this session against silent loss or
// truncation (e.g. a future edit that clips a table or drops a category).
// Each count is pinned to the exact figure verified against the source
// reference documents when the content was added.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml, parseFrameworkConcepts } = require('../lib/parse-index');

const text = readIndexHtml();

describe('glossary', () => {
  test('frameworkConcepts has exactly 59 terms', () => {
    const concepts = parseFrameworkConcepts(text);
    assert.equal(concepts.length, 59);
  });
  test('every glossary term has a non-empty term, category and definition', () => {
    const concepts = parseFrameworkConcepts(text);
    for (const c of concepts) {
      assert.ok(c.term && c.term.length > 0, 'empty term');
      assert.ok(c.category && c.category.length > 0, `${c.term}: empty category`);
      assert.ok(c.definition && c.definition.length > 0, `${c.term}: empty definition`);
    }
  });
});

describe('Datetime Format catalogue (78 formats / 15 categories)', () => {
  test('catalogue section exists with the expected total in its intro', () => {
    assert.match(text, /id="datetime-format-catalogue"/);
    assert.match(text, /78 named formats across 15 categories/);
  });
  test('all 15 category anchors are present', () => {
    const expected = [
      'datetime-format-cat-iso8601', 'datetime-format-cat-rfc', 'datetime-format-cat-webserver',
      'datetime-format-cat-syslog', 'datetime-format-cat-epoch', 'datetime-format-cat-database',
      'datetime-format-cat-lang', 'datetime-format-cat-human', 'datetime-format-cat-compact',
      'datetime-format-cat-iso8601nonstd', 'datetime-format-cat-iso8601ext', 'datetime-format-cat-iso8601basic',
      'datetime-format-cat-winevt', 'datetime-format-cat-oracle', 'datetime-format-cat-vendor',
    ];
    for (const id of expected) assert.match(text, new RegExp(`id="${id}"`), `missing category anchor ${id}`);
  });
  test('exactly 78 data rows across the 15 category tables', () => {
    const section = text.match(/<section id="datetime-format-catalogue"[\s\S]*?<\/section>/)[0];
    const rows = section.match(/<tr>/g) || [];
    // one <tr> per data row plus one <tr> per table header = 15 tables
    assert.equal(rows.length, 78 + 15);
  });
});

describe('Username / Principal Format reference (37 formats / 13 categories)', () => {
  test('article exists with the expected total in its intro', () => {
    assert.match(text, /id="usernameFormatReferenceView"/);
    assert.match(text, /37 named username\/principal formats across 13 categories/);
  });
  test('all 13 category anchors are present', () => {
    const expected = [
      'username-format-cat-saml', 'username-format-cat-aws', 'username-format-cat-internet',
      'username-format-cat-phone', 'username-format-cat-windows', 'username-format-cat-entra',
      'username-format-cat-gcp', 'username-format-cat-database', 'username-format-cat-ldap',
      'username-format-cat-kerberos', 'username-format-cat-social', 'username-format-cat-netauth',
      'username-format-cat-generic',
    ];
    for (const id of expected) assert.match(text, new RegExp(`id="${id}"`), `missing category anchor ${id}`);
  });
  test('exactly 37 data rows across the 13 category tables', () => {
    const section = text.match(/<section id="username-format-catalogue"[\s\S]*?<\/section>\s*<section id="username-format-precedence"/)[0];
    const rows = section.match(/<tr>/g) || [];
    assert.equal(rows.length, 37 + 13);
  });
  test('detector precedence order table has all 37 entries, numbered 1 to 37 in order', () => {
    const section = text.match(/<section id="username-format-precedence"[\s\S]*?<\/section>/)[0];
    const nums = [...section.matchAll(/<tr><td>(\d+)<\/td>/g)].map(m => parseInt(m[1], 10));
    assert.deepEqual(nums, Array.from({ length: 37 }, (_, i) => i + 1));
  });
});

describe('Key-value pair styles section (6 styles)', () => {
  test('section exists inside Log Format Detection & Parsing', () => {
    assert.match(text, /id="log-format-parse-kv"/);
  });
  test('nav link to the section is present in the article hero', () => {
    const hero = text.match(/<h2 id="logFormatParseReferenceTitle">[\s\S]*?<\/nav>/)[0];
    assert.match(hero, /href="#log-format-parse-kv"/);
  });
  test('exactly 6 style rows in the table', () => {
    const section = text.match(/<section id="log-format-parse-kv"[\s\S]*?<\/section>/)[0];
    const rows = section.match(/<tr>/g) || [];
    assert.equal(rows.length, 6 + 1); // 6 data rows + 1 header row
  });
  test('both separator styles and all three delimiters are represented', () => {
    const section = text.match(/<section id="log-format-parse-kv"[\s\S]*?<\/section>/)[0];
    assert.match(section, /KV_MODE = auto/);
    assert.match(section, /EXTRACT-action/);
    assert.match(section, /Space-separated/);
    assert.match(section, /Comma-separated/);
    assert.match(section, /Semicolon-separated/);
  });
});
