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

describe('Encoding & character set detection section (5 BOM signatures / 8 non-UTF-8 encodings)', () => {
  test('section exists inside Log Format Detection & Parsing', () => {
    assert.match(text, /id="log-format-parse-encoding"/);
  });
  test('nav link to the section is present in the article hero', () => {
    const hero = text.match(/<h2 id="logFormatParseReferenceTitle">[\s\S]*?<\/nav>/)[0];
    assert.match(hero, /href="#log-format-parse-encoding"/);
  });
  test('exactly 5 BOM signature rows and 8 non-UTF-8 encoding rows', () => {
    const section = text.match(/<section id="log-format-parse-encoding"[\s\S]*?<\/section>/)[0];
    const tables = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/g) || [];
    assert.equal(tables.length, 2, 'expected exactly 2 tables in the encoding section');
    const rowCounts = tables.map(t => (t.match(/<tr>/g) || []).length - 1); // subtract header row
    assert.deepEqual(rowCounts, [5, 8]);
  });
  test('all five BOM byte-order marks and the UTF-32LE/UTF-16LE ambiguity note are present', () => {
    const section = text.match(/<section id="log-format-parse-encoding"[\s\S]*?<\/section>/)[0];
    assert.match(section, /EF BB BF/);
    assert.match(section, /FE FF/);
    assert.match(section, /FF FE/);
    assert.match(section, /00 00 FE FF/);
    assert.match(section, /FF FE 00 00/);
    assert.match(section, /misdetected/);
  });
  test('Splunk CHARSET scoping and PREAMBLE_REGEX guidance are present', () => {
    const section = text.match(/<section id="log-format-parse-encoding"[\s\S]*?<\/section>/)[0];
    assert.match(section, /CHARSET/);
    assert.match(section, /PREAMBLE_REGEX/);
    assert.match(section, /AUTO/);
  });
});

describe('Field Extraction reference article (6 extraction methods)', () => {
  test('article exists and is wired into detailConfig / setReferenceDetailVisibility / method-card', () => {
    assert.match(text, /id="fieldExtractionReferenceView"/);
    assert.match(text, /"field-extraction":\{hash:"#field-extraction-definition",view:"fieldExtractionReferenceView"\}/);
    assert.match(text, /if\(fieldExtraction\) fieldExtraction\.hidden=detailName!=="field-extraction"/);
    assert.match(text, /data-open-reference-detail="field-extraction"/);
  });
  test('exactly 6 rows in the extraction methods table', () => {
    const section = text.match(/<section id="field-extraction-methods"[\s\S]*?<\/section>/)[0];
    const rows = section.match(/<tr>/g) || [];
    assert.equal(rows.length, 6 + 1); // 6 data rows + 1 header row
  });
  test('both index-time and search-time mechanisms are covered', () => {
    const section = text.match(/<section id="field-extraction-methods"[\s\S]*?<\/section>/)[0];
    assert.match(section, /INDEXED_EXTRACTIONS/);
    assert.match(section, /WRITE_META/);
    assert.match(section, /INGEST_EVAL/);
    assert.match(section, /KV_MODE/);
    assert.match(section, /DELIMS/);
  });
});

describe('Default fields section (4 metadata / 5 other / 8 date_* fields)', () => {
  test('section exists with a nav link in the article hero', () => {
    assert.match(text, /id="field-extraction-defaults"/);
    const hero = text.match(/<h2 id="fieldExtractionReferenceTitle">[\s\S]*?<\/nav>/)[0];
    assert.match(hero, /href="#field-extraction-defaults"/);
  });
  test('exactly 4 metadata, 5 other and 8 date_* field rows', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    const tables = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/g) || [];
    assert.equal(tables.length, 3, 'expected exactly 3 tables in the default fields section');
    const rowCounts = tables.map(t => (t.match(/<tr>/g) || []).length - 1); // subtract header row
    assert.deepEqual(rowCounts, [4, 5, 8]);
  });
  test('all four metadata default fields and their override mechanisms are present', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    assert.match(section, /<code>host<\/code>/);
    assert.match(section, /<code>source<\/code>/);
    assert.match(section, /<code>sourcetype<\/code>/);
    assert.match(section, /<code>index<\/code>/);
    assert.match(section, /MetaData:Host/);
    assert.match(section, /MetaData:Source/);
    assert.match(section, /MetaData:Sourcetype/);
    assert.match(section, /_MetaData:Index/);
  });
  test('all eight date_* fields are present and DATETIME_CONFIG absence caveat is documented', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    for (const f of ['date_year', 'date_month', 'date_mday', 'date_wday', 'date_hour', 'date_minute', 'date_second', 'date_zone']) {
      assert.match(section, new RegExp(`<code>${f}<\\/code>`), `missing ${f}`);
    }
    assert.match(section, /DATETIME_CONFIG = CURRENT/);
    assert.match(section, /DATETIME_CONFIG = NONE/);
  });
  test('distinguishes default fields from underscore-prefixed internal fields', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    assert.match(section, /Not the same as internal fields/);
    assert.match(section, /<code>_raw<\/code>/);
    assert.match(section, /<code>_time<\/code>/);
    assert.match(section, /<code>_indextime<\/code>/);
  });
  test('tags.conf mechanism is documented next to eventtype', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    assert.match(section, /<strong>Tags\.<\/strong>/);
    assert.match(section, /tags\.conf/);
    assert.match(section, /tag::&lt;field&gt;=&lt;tagname&gt;/);
    assert.match(section, /\[eventtype=login_failure\]/);
  });
  test('ANNOTATE_PUNCT is documented on the punct row', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    const puntRow = section.match(/<tr><td><code>punct<\/code>[\s\S]*?<\/tr>/)[0];
    assert.match(puntRow, /<code>ANNOTATE_PUNCT<\/code>/);
    assert.match(puntRow, /ANNOTATE_PUNCT = false/);
  });
});

describe('Retention Policy reference article (bucket lifecycle, indexes.conf settings, secure deletion)', () => {
  test('article exists and is wired into detailConfig / setReferenceDetailVisibility / method-card', () => {
    assert.match(text, /id="retentionPolicyReferenceView"/);
    assert.match(text, /"retention-policy":\{hash:"#retention-policy-definition",view:"retentionPolicyReferenceView"\}/);
    assert.match(text, /if\(retentionPolicy\) retentionPolicy\.hidden=detailName!=="retention-policy"/);
    assert.match(text, /data-open-reference-detail="retention-policy"/);
  });
  test('exactly 5 bucket lifecycle stages, in order hot to thawed', () => {
    const section = text.match(/<section id="retention-policy-lifecycle"[\s\S]*?<\/section>/)[0];
    const stages = [...section.matchAll(/<tr><td>(Hot|Warm|Cold|Frozen|Thawed)<\/td>/g)].map(m => m[1]);
    assert.deepEqual(stages, ['Hot', 'Warm', 'Cold', 'Frozen', 'Thawed']);
  });
  test('exactly 8 indexes.conf settings rows', () => {
    const section = text.match(/<section id="retention-policy-settings"[\s\S]*?<\/section>/)[0];
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1; // subtract header row
    assert.equal(rows, 8);
  });
  test('exactly 5 secure deletion methods, including the delete-command caveat', () => {
    const section = text.match(/<section id="retention-policy-secure-deletion"[\s\S]*?<\/section>/)[0];
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1;
    assert.equal(rows, 5);
    assert.match(section, /remains physically present on disk/);
  });
  test('deleted-vs-archived-on-freeze distinction is documented', () => {
    const section = text.match(/<section id="retention-policy-settings"[\s\S]*?<\/section>/)[0];
    assert.match(section, /Deleted, not archived, by default/);
    assert.match(section, /coldToFrozenDir/);
    assert.match(section, /coldToFrozenScript/);
  });
});

describe('Access Control reference article (4 predefined roles, 8 authorize.conf settings, 3 auth methods)', () => {
  test('article exists and is wired into detailConfig / setReferenceDetailVisibility / method-card', () => {
    assert.match(text, /id="accessControlReferenceView"/);
    assert.match(text, /"access-control":\{hash:"#access-control-definition",view:"accessControlReferenceView"\}/);
    assert.match(text, /if\(accessControl\) accessControl\.hidden=detailName!=="access-control"/);
    assert.match(text, /data-open-reference-detail="access-control"/);
  });
  test('exactly 4 predefined roles: admin, power, user, can_delete', () => {
    const section = text.match(/<section id="access-control-roles"[\s\S]*?<\/section>/)[0];
    const roles = [...section.matchAll(/<tr><td><code>([a-z_]+)<\/code><\/td>/g)].map(m => m[1]);
    assert.deepEqual(roles, ['admin', 'power', 'user', 'can_delete']);
  });
  test('exactly 8 authorize.conf settings rows', () => {
    const section = text.match(/<section id="access-control-authorize"[\s\S]*?<\/section>/)[0];
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1;
    assert.equal(rows, 8);
  });
  test('all three authentication integration methods are covered, with the mapping-drift caveat', () => {
    const section = text.match(/<section id="access-control-authentication"[\s\S]*?<\/section>/)[0];
    assert.match(section, />Native<\/td>/);
    assert.match(section, />LDAP<\/td>/);
    assert.match(section, />SAML<\/td>/);
    assert.match(section, /authentication\.conf/);
    assert.match(section, /Mapping drift/);
  });
  test('capabilities-are-additive-only and importRoles best-practice guidance are present', () => {
    const section = text.match(/<section id="access-control-authorize"[\s\S]*?<\/section>/)[0];
    assert.match(section, /additive only/);
    assert.match(section, /<code>importRoles<\/code>/);
  });
});

describe('Line Break: EVENT_BREAKER / EVENT_BREAKER_ENABLE (Universal Forwarder event breaking)', () => {
  test('both settings are in the line-breaking settings table with a Scope column', () => {
    const section = text.match(/<section id="line-break-settings"[\s\S]*?<\/section>/)[0];
    assert.match(section, /<th>Setting<\/th><th>Scope<\/th><th>Definition<\/th>/);
    assert.match(section, /<code>EVENT_BREAKER_ENABLE<\/code>/);
    assert.match(section, /<code>EVENT_BREAKER<\/code>/);
    assert.match(section, /ChunkedLBProcessor/);
    assert.match(section, /Universal Forwarder only/);
  });
  test('exactly 4 settings rows (SHOULD_LINEMERGE, LINE_BREAKER, EVENT_BREAKER_ENABLE, EVENT_BREAKER)', () => {
    const section = text.match(/<section id="line-break-settings"[\s\S]*?<\/section>/)[0];
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1; // subtract header row
    assert.equal(rows, 4);
  });
  test('example shows the forwarder-side and indexer-side stanzas together', () => {
    const section = text.match(/<section id="line-break-examples"[\s\S]*?<\/section>/)[0];
    assert.match(section, /Universal Forwarder event breaking \(EVENT_BREAKER\)/);
    assert.match(section, /EVENT_BREAKER_ENABLE = true/);
  });
  test('validation notes flag the EVENT_BREAKER / LINE_BREAKER sync requirement', () => {
    const section = text.match(/<section id="line-break-validation"[\s\S]*?<\/section>/)[0];
    assert.match(section, /EVENT_BREAKER.*matches.*LINE_BREAKER/);
  });
});

describe('Line Length: TRUNCATE = 999999 alternative and recommended-value SPL search', () => {
  test('TRUNCATE = 999999 is documented as an alternative to TRUNCATE = 0', () => {
    const section = text.match(/<section id="line-length-props"[\s\S]*?<\/section>/)[0];
    assert.match(section, /<code>TRUNCATE = 999999<\/code>/);
    assert.match(section, /safer middle ground/);
  });
  test('the recommended-TRUNCATE-value SPL search is present with its 10% margin', () => {
    const section = text.match(/<section id="line-length-props"[\s\S]*?<\/section>/)[0];
    assert.match(section, /Finding your TRUNCATE value/);
    assert.match(section, /eval event_size=len\(_raw\)/);
    assert.match(section, /stats max\(event_size\) as max_event_size/);
    assert.match(section, /max_event_size \* 1\.10/);
  });
});

describe('Field Extraction: host_segment override mechanism', () => {
  test('host_segment is documented on the host row with a worked path example', () => {
    const section = text.match(/<section id="field-extraction-defaults"[\s\S]*?<\/section>/)[0];
    const hostRow = section.match(/<tr><td><code>host<\/code>[\s\S]*?<\/tr>/)[0];
    assert.match(hostRow, /<code>host_segment = &lt;N&gt;<\/code>/);
    assert.match(hostRow, /monitor:\/\//);
  });
});

describe('Field Normalisation reference article (22 CIM data models, 4 normalisation mechanisms)', () => {
  test('article exists and is wired into detailConfig / setReferenceDetailVisibility / method-card', () => {
    assert.match(text, /id="fieldNormalisationReferenceView"/);
    assert.match(text, /"field-normalisation":\{hash:"#field-norm-definition",view:"fieldNormalisationReferenceView"\}/);
    assert.match(text, /if\(fieldNormalisation\) fieldNormalisation\.hidden=detailName!=="field-normalisation"/);
    assert.match(text, /data-open-reference-detail="field-normalisation"/);
  });
  test('exactly 22 CIM data model rows', () => {
    const section = text.match(/<section id="field-norm-models"[\s\S]*?<\/section>/)[0];
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1;
    assert.equal(rows, 22);
  });
  test('exactly 4 normalisation mechanisms: field aliasing, calculated fields, automatic lookups, tags', () => {
    const section = text.match(/<section id="field-norm-mechanisms"[\s\S]*?<\/section>/)[0];
    assert.match(section, /FIELDALIAS-&lt;class&gt;/);
    assert.match(section, /EVAL-&lt;fieldname&gt;/);
    assert.match(section, /LOOKUP-&lt;class&gt;/);
    assert.match(section, /tags\.conf/);
    const table = section.match(/<table class="eccs-table">[\s\S]*?<\/table>/)[0];
    const rows = (table.match(/<tr>/g) || []).length - 1;
    assert.equal(rows, 4);
  });
  test('the 6-step CIM compliance workflow and CIM-vs-ECS distinction are present', () => {
    const section = text.match(/<section id="field-norm-workflow"[\s\S]*?<\/section>/)[0];
    const steps = (section.match(/<li>/g) || []).length;
    assert.equal(steps, 6);
    const validation = text.match(/<section id="field-norm-validation"[\s\S]*?<\/section>/)[0];
    assert.match(validation, /CIM Mapping \(TAX-04\.07\.04\)/);
    assert.match(validation, /ECS Mapping \(TAX-04\.07\.05\)/);
  });
});

describe('New AI prompts for the six reference articles added this session', () => {
  const newPrompts = [
    { id: 'promptBusinessImpactLevel', copyTarget: 'businessImpactLevelPrompt', section: 'bil-definition' },
    { id: 'promptUsernameFormat', copyTarget: 'usernameFormatPrompt', section: 'username-format-definition' },
    { id: 'promptFieldExtraction', copyTarget: 'fieldExtractionPrompt', section: 'field-extraction-definition' },
    { id: 'promptRetentionPolicy', copyTarget: 'retentionPolicyPrompt', section: 'retention-policy-definition' },
    { id: 'promptAccessControl', copyTarget: 'accessControlPrompt', section: 'access-control-definition' },
    { id: 'promptFieldNormalisation', copyTarget: 'fieldNormalisationPrompt', section: 'field-norm-definition' },
  ];
  for (const { id, copyTarget, section } of newPrompts) {
    test(`${id} exists as a prompt-card with a working copy button and submenu entry`, () => {
      assert.match(text, new RegExp(`<article id="${id}" class="prompt-card" data-prompt-panel hidden>`));
      assert.match(text, new RegExp(`data-copy-prompt="${copyTarget}"`));
      assert.match(text, new RegExp(`<pre id="${copyTarget}" class="prompt-body">`));
      assert.match(text, new RegExp(`data-prompt-target="${id}"`));
    });
    test(`${id}'s reference article Definition section links to it via Open AI prompt`, () => {
      const sec = text.match(new RegExp(`<section id="${section}"[\\s\\S]*?<\\/section>`))[0];
      assert.match(sec, new RegExp(`data-open-prompt-panel="${id}"`));
    });
  }
  test('all 6 new prompts are wired into the alphabetically-sorted submenu', () => {
    for (const { id } of newPrompts) {
      assert.match(text, new RegExp(`<button type="button" class="prompt-submenu-button" data-prompt-target="${id}"`));
    }
  });
});
