'use strict';
// Guards the reference content added this session against silent loss or
// truncation (e.g. a future edit that clips a table or drops a category).
// Each count is pinned to the exact figure verified against the source
// reference documents when the content was added.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml, parseFrameworkConcepts, parseTaxonomyNodes } = require('../lib/parse-index');

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

describe('Punct Field Calculation prompt', () => {
  test('exists as a prompt-card with a working copy button and submenu entry', () => {
    assert.match(text, /<article id="promptPunctField" class="prompt-card" data-prompt-panel hidden>/);
    assert.match(text, /data-copy-prompt="punctFieldPrompt"/);
    assert.match(text, /<pre id="punctFieldPrompt" class="prompt-body">/);
    assert.match(text, /<button type="button" class="prompt-submenu-button" data-prompt-target="promptPunctField"/);
  });
  test('grounds the algorithm in the documented "first thirty punctuation characters in the first line" rule', () => {
    const section = text.match(/<pre id="punctFieldPrompt" class="prompt-body">[\s\S]*?<\/pre>/)[0];
    assert.match(section, /first thirty punctuation characters in the first line/);
    assert.match(section, /truncat/i);
    assert.match(section, /space \(converted to _\)/);
    assert.match(section, /tab \(converted to t\)/);
    assert.match(section, /dash-after-alphanumeric/);
    assert.match(section, /community-observed, not part of Splunk's formal field reference/);
  });
});

describe('Exploratory Data Analysis & Field Correlation Playbook reference article (all 14 phases + 3 appendices)', () => {
  test('article exists and is wired into detailConfig / setReferenceDetailVisibility / method-card', () => {
    assert.match(text, /id="edaPlaybookReferenceView"/);
    assert.match(text, /"eda-playbook":\{hash:"#eda-definition",view:"edaPlaybookReferenceView"\}/);
    assert.match(text, /if\(edaPlaybook\) edaPlaybook\.hidden=detailName!=="eda-playbook"/);
    assert.match(text, /data-open-reference-detail="eda-playbook"/);
    assert.match(text, /\/\^#eda-\/\.test\(location\.hash\) \? "eda-playbook"/);
  });
  test('anchor-nav has all 18 sections: definition, 13 phases (0-12), 3 appendices, relationship', () => {
    const hero = text.match(/<h2 id="edaPlaybookReferenceTitle">[\s\S]*?<\/nav>/)[0];
    const hrefs = [...hero.matchAll(/href="#([a-z0-9-]+)"/g)].map(m => m[1]);
    const expected = ['eda-definition', ...Array.from({ length: 13 }, (_, i) => `eda-phase${i}`),
      'eda-quickref', 'eda-template', 'eda-checklist', 'eda-relationship'];
    assert.deepEqual(hrefs, expected);
  });
  test('placeholder-conventions table documents the literal <<FIELD>> foreach token as distinct from substitutable placeholders', () => {
    const section = text.match(/<section id="eda-definition"[\s\S]*?<\/section>/)[0];
    assert.match(section, /&lt;index&gt;/);
    assert.match(section, /&lt;known_value&gt;/);
    assert.match(section, /&lt;&lt;FIELD&gt;&gt;/);
    assert.match(section, /not a placeholder/);
  });
  test('Phase 0 (Parse-Time Health) covers structure fingerprinting, event clustering, format detection, timestamp lag and truncation, and cross-references Log Assessment Framework/Line Length/Timestamp Quality', () => {
    const section = text.match(/<section id="eda-phase0"[\s\S]*?<\/section>/)[0];
    assert.match(section, /stats count by punct/);
    assert.match(section, /cluster showcount=true t=0\.8/);
    assert.match(section, /lag_sec=_indextime-_time/);
    assert.match(section, /near_truncate_events/);
    assert.match(section, /data-open-reference-detail="log-assessment-framework"/);
    assert.match(section, /data-open-reference-detail="line-length"/);
    assert.match(section, /data-open-reference-detail="timestamp-quality"/);
  });
  test('Phase 1 (Data Source Profiling) covers volume trends, event diversity and field discovery', () => {
    const section = text.match(/<section id="eda-phase1"[\s\S]*?<\/section>/)[0];
    assert.match(section, /tstats count where index=&lt;index&gt; by _time span=1h/);
    assert.match(section, /metadata type=sourcetypes index=&lt;index&gt;/);
    assert.match(section, /fieldsummary/);
  });
  test('Phase 2 (Data Quality Analysis) covers all 14 checks and cross-references Data Quality Score', () => {
    const section = text.match(/<section id="eda-phase2"[\s\S]*?<\/section>/)[0];
    for (const heading of [
      'Critical field population', 'Null analysis', 'CIM alignment', 'Data type identification',
      'Field completeness assessment', 'Placeholder &amp; junk value detection', 'Format validity checks',
      'Value consistency checks', 'Duplicate event detection', 'Cross-field logical consistency',
      'Multivalue field anomalies', 'Numeric sanity checks', 'Quality drift over time', 'Data quality scorecard',
    ]) {
      assert.match(section, new RegExp(`<h4>${heading}</h4>`), `missing "${heading}"`);
    }
    assert.match(section, /dq_score=round\(\(completeness\*0\.4\)\+\(validity\*0\.2\)\+\(uniqueness\*0\.2\)\+\(timeliness\*0\.2\),1\)/);
    assert.match(section, /data-open-reference-detail="data-quality-score"/);
  });
  test('Phase 3 (Temporal Analysis) covers hourly/day-of-week activity, frequency, gaps and seasonality', () => {
    const section = text.match(/<section id="eda-phase3"[\s\S]*?<\/section>/)[0];
    assert.match(section, /chart count over hour by day/);
    assert.match(section, /timewrap 1w/);
  });
  test('Phase 4 (Correlation Analysis) gives the full dc\\(\\)\\/values\\(\\) template plus a table of other entity pairs', () => {
    const section = text.match(/<section id="eda-phase4"[\s\S]*?<\/section>/)[0];
    assert.match(section, /dc\(&lt;host_field&gt;\) as host_count dc\(&lt;ip_field&gt;\) as ip_count/);
    assert.match(section, /Host &harr; IP relationships/);
    assert.match(section, /events_per_user=round\(count\/users,1\)/);
  });
  test('Phase 5 (Outlier Analysis) covers rare/high-volume/statistical anomaly detection', () => {
    const section = text.match(/<section id="eda-phase5"[\s\S]*?<\/section>/)[0];
    assert.match(section, /rare limit=25 &lt;field&gt;/);
    assert.match(section, /Rare-entity variants/);
    assert.match(section, /anomalydetection action=annotate/);
  });
  test('Phase 6 (Field Correlation & Entity Discovery) covers candidate fields, classification and discovery, and cross-references Field Extraction', () => {
    const section = text.match(/<section id="eda-phase6"[\s\S]*?<\/section>/)[0];
    assert.match(section, /entity_hint=case/);
    assert.match(section, /Entity value signatures/);
    assert.match(section, /found_user/);
    assert.match(section, /data-open-reference-detail="field-extraction"/);
  });
  test('Phase 7 (Field Relationship Analysis) covers comparison, similarity, alias detection and CIM mapping candidates, and cross-references Field Normalisation', () => {
    const section = text.match(/<section id="eda-phase7"[\s\S]*?<\/section>/)[0];
    assert.match(section, /similarity_pct=round\(matches\/both_present\*100,2\)/);
    assert.match(section, /cim_candidate=case/);
    assert.match(section, /data-open-reference-detail="field-normalisation"/);
  });
  test('Phase 8 (Field Value Correlation Matrix) gives the user matrix in full plus a table of other matrices', () => {
    const section = text.match(/<section id="eda-phase8"[\s\S]*?<\/section>/)[0];
    assert.match(section, /contingency maxcols=25 maxrows=25 &lt;user_field&gt; &lt;host_field&gt;/);
    assert.match(section, /Other correlation matrices/);
  });
  test('Blind Correlation phase (12) covers all 8 techniques plus the workflow summary', () => {
    const section = text.match(/<section id="eda-phase12"[\s\S]*?<\/section>/)[0];
    for (const heading of [
      'Find which field holds a known value',
      'Indexed-term pivot',
      'Read the lexicon directly',
      'Wide &rarr; long transformation',
      'Cross-sourcetype join-key discovery',
      'Value-shape field profiling',
      'Raw-token intersection',
      'Time-proximity correlation',
      'Blind-source workflow',
    ]) {
      assert.match(section, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing "${heading}"`);
    }
    assert.match(section, /TERM\(&lt;known_value&gt;\)/);
    assert.match(section, /walklex index=&lt;index&gt; type=field/);
    assert.match(section, /field_pair=mvjoin\(mvsort\(locations\)/);
  });
  test('CIM Assessment phase (9) covers all 6 checks', () => {
    const section = text.match(/<section id="eda-phase9"[\s\S]*?<\/section>/)[0];
    for (const heading of [
      'CIM compliance assessment', 'Required CIM fields', 'Optional CIM fields',
      'Missing CIM fields', 'Data model mapping', 'CIM coverage score',
    ]) {
      assert.match(section, new RegExp(heading), `missing "${heading}"`);
    }
    assert.match(section, /cim_coverage_pct=round\(\(\(req_score\*0\.7\)\+\(rec_score\*0\.3\)\)\*100,1\)/);
    assert.match(section, /\| datamodel Authentication Authentication search/);
  });
  test('Phase 10 (Sensitive Data & Secrets Discovery) counts/locates secrets and cross-references Access Control/Retention Policy', () => {
    const section = text.match(/<section id="eda-phase10"[\s\S]*?<\/section>/)[0];
    assert.match(section, /aws_access_key=if\(match\(_raw,"\\bAKIA\[0-9A-Z\]\{16\}\\b"\)/);
    assert.match(section, /never table the matched values themselves/);
    assert.match(section, /data-open-reference-detail="access-control"/);
    assert.match(section, /data-open-reference-detail="retention-policy"/);
  });
  test('Phase 11 (Enrichment & Context Validation) covers lookup inventory and asset/identity match rate, and cross-references Access Control', () => {
    const section = text.match(/<section id="eda-phase11"[\s\S]*?<\/section>/)[0];
    assert.match(section, /rest \/services\/data\/transforms\/lookups splunk_server=local/);
    assert.match(section, /known_asset","unknown_asset"/);
    assert.match(section, /data-open-reference-detail="access-control"/);
  });
  test('Quick Reference appendix has all 8 categories', () => {
    const section = text.match(/<section id="eda-quickref"[\s\S]*?<\/section>/)[0];
    for (const heading of [
      'Parse health &amp; exposure', 'Profiling &amp; inventory', 'Quality', 'Temporal',
      'Correlation &amp; outliers', 'Entity discovery', 'Relationships &amp; CIM',
      'Blind correlation \\(no trusted field names\\)',
    ]) {
      assert.match(section, new RegExp(`<h4>${heading}</h4>`), `missing "${heading}"`);
    }
  });
  test('Onboarding Documentation Template appendix is a fill-in skeleton covering all phases', () => {
    const section = text.match(/<section id="eda-template"[\s\S]*?<\/section>/)[0];
    assert.match(section, /# Source Onboarding: &lt;index&gt; \/ &lt;sourcetype&gt;/);
    assert.match(section, /## Sign-off/);
  });
  test('Detection-Readiness Checklist appendix has all 14 gate items and ties to the pre-ingest cyber-value gate', () => {
    const section = text.match(/<section id="eda-checklist"[\s\S]*?<\/section>/)[0];
    const items = (section.match(/<li>/g) || []).length;
    assert.equal(items, 14);
    assert.match(section, /Pre-ingest cyber-value gate \(TAX-06\.05\.02\)/);
  });
  test('relationship section is a full-pass summary cross-referencing 6 other reference articles', () => {
    const section = text.match(/<section id="eda-relationship"[\s\S]*?<\/section>/)[0];
    assert.match(section, /full pass over its source document/);
    for (const key of ['field-extraction', 'field-normalisation', 'log-assessment-framework', 'data-quality-score', 'access-control', 'retention-policy']) {
      assert.match(section, new RegExp(`data-open-reference-detail="${key}"`));
    }
  });
});

describe('Health Checks Table: Splunk platform security/upgrade-readiness + operational checks (Health Assistant + Alerts for Splunk Admins)', () => {
  const nodes = parseTaxonomyNodes(text);
  const health = nodes.filter(n => n.nodeType === 'instance' && n.parentCode === 'CUR::TAX-04.10.01');

  test('561 total health-check instance nodes under CUR::TAX-04.10.01 (390 original + 171 new)', () => {
    assert.equal(health.length, 561);
  });

  test('entryCount on both the taxonomy node and its current-entries group matches 561', () => {
    const taxNode = nodes.find(n => n.code === 'TAX-04.10.01');
    const groupNode = nodes.find(n => n.code === 'CUR::TAX-04.10.01');
    assert.equal(taxNode.entryCount, 561);
    assert.equal(groupNode.entryCount, 561);
    assert.equal(groupNode.fields['Record count'], 561);
    assert.match(groupNode.term, /Current entries \(561\)/);
  });

  test('every health-check Test ID is unique across all 561 rows', () => {
    const ids = health.map(n => n.fields['Test ID']);
    const seen = new Set();
    const dupes = ids.filter(id => (seen.has(id) ? true : (seen.add(id), false)));
    assert.deepEqual(dupes, []);
  });

  test('9 new Input Types are present with the expected row counts', () => {
    const counts = {};
    for (const n of health) {
      const it = n.fields['Input Type'];
      counts[it] = (counts[it] || 0) + 1;
    }
    const expected = {
      'Splunk Platform Security / Upgrade Readiness': 26,
      'Search Head': 43,
      'Indexer / Indexer Cluster': 34,
      'Forwarder Platform': 20,
      'Splunk Platform (All Roles)': 35,
      'Deployment Server': 5,
      'License Master': 1,
      'Cluster Master': 2,
      'Monitoring Console': 5,
    };
    for (const [inputType, count] of Object.entries(expected)) {
      assert.equal(counts[inputType], count, `expected ${count} rows for "${inputType}", found ${counts[inputType]}`);
    }
  });

  test('Priority values roll up to 299 Critical / 215 High / 47 Medium across all 561 rows', () => {
    const counts = { Critical: 0, High: 0, Medium: 0 };
    for (const n of health) {
      const p = n.fields['Priority'];
      assert.ok(p in counts, `unexpected Priority value "${p}" on ${n.fields['Test ID']}`);
      counts[p]++;
    }
    assert.deepEqual(counts, { Critical: 299, High: 215, Medium: 47 });
  });

  test('every new health-check row has a non-empty Test Description, Pass Criteria and SPL preview', () => {
    const newRows = health.filter(n => [
      'Splunk Platform Security / Upgrade Readiness', 'Search Head', 'Indexer / Indexer Cluster',
      'Forwarder Platform', 'Splunk Platform (All Roles)', 'Deployment Server', 'License Master',
      'Cluster Master', 'Monitoring Console',
    ].includes(n.fields['Input Type']));
    assert.equal(newRows.length, 171);
    for (const n of newRows) {
      assert.ok(n.fields['Test Description'], `${n.fields['Test ID']} missing Test Description`);
      assert.ok(n.fields['Pass Criteria'], `${n.fields['Test ID']} missing Pass Criteria`);
      assert.ok(n.fields['Definition: SPL Query (truncated)'], `${n.fields['Test ID']} missing SPL preview`);
    }
  });

  test('a few specific real checks exist, grounded in the source apps', () => {
    const byId = Object.fromEntries(health.map(n => [n.fields['Test ID'], n.fields]));
    assert.equal(byId['TC-SEC-002']['Test Name'], 'Deprecated TLS Protocol Versions in Splunk Configuration');
    assert.equal(byId['TC-SEC-002']['Priority'], 'Critical');
    assert.equal(byId['TC-SHL-001']['Test Name'], 'Accelerated DataModels with All Time Searching Enabled');
    assert.equal(byId['TC-IDX-001'] === undefined ? undefined : byId['TC-IDX-001']['Input Type'], 'Indexer / Indexer Cluster');
    assert.equal(byId['TC-LIC-001']['Test Name'], 'Duplicated License Situation');
  });

  test('hero text and stat badges reflect the new totals', () => {
    assert.match(text, /Review all 561 reusable health-check templates/);
    assert.match(text, /<strong id="healthVisibleCount">561<\/strong>/);
    assert.match(text, /<strong id="healthCriticalCount">299<\/strong>/);
    assert.match(text, /<strong id="healthAutomatedCount">561<\/strong>/);
    assert.match(text, /<strong id="healthInputTypeCount">55<\/strong>/);
  });
});
