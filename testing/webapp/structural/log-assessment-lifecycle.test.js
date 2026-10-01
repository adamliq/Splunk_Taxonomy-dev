'use strict';
// Reference > Log assessment lifecycle: the page is wired like every other reference page,
// and its data hangs together -- every output item names real domains, every stage-table row
// belongs to a pyramid layer, and the Log Assessment Framework article links to it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();
const start = text.indexOf('const LAL_LENS = ');
const end = text.indexOf('function lalRefTitle(', start);
const data = {};
vm.runInNewContext(`${text.slice(start, end)}\nthis.d = { LAL_LENS, LAL_LAYERS, LAL_ROWS, LAL_DOMAINS, LAL_OUTPUTS, LAL_STEPS, LAL_REFS, LAL_LAYER_REFS, LAL_DOMAIN_SECTIONS, LAL_LAYER_JOURNEY, LAL_DOMAIN_ICONS };`, data);
const { LAL_LENS, LAL_LAYERS, LAL_ROWS, LAL_DOMAINS, LAL_OUTPUTS, LAL_STEPS, LAL_REFS, LAL_LAYER_REFS, LAL_DOMAIN_SECTIONS, LAL_LAYER_JOURNEY, LAL_DOMAIN_ICONS } = data.d;

test('the page is a Reference page with its own hash', () => {
  assert.match(text, /<button id="showLogAssessmentLifecyclePage" class="page-tab" type="button" role="tab" aria-selected="false" aria-controls="logAssessmentLifecyclePage">Log assessment lifecycle<\/button>/);
  assert.match(text, /<section id="logAssessmentLifecyclePage" class="page-view reference-page" role="tabpanel" aria-labelledby="showLogAssessmentLifecyclePage" hidden>/);
  for (const pattern of [
    /refLogAssessmentLifecycle: document\.getElementById\("showLogAssessmentLifecyclePage"\)/,
    /refLogAssessmentLifecycle: document\.getElementById\("logAssessmentLifecyclePage"\)/,
    /refLogAssessmentLifecycle: "reference"/,
    /refLogAssessmentLifecycle: "Log assessment lifecycle"/,
    /"refSplunkTimezone", "refLogAssessmentLifecycle", "refQuestions"/,
    /selected === "refLogAssessmentLifecycle"\n\s+\? "#log-assessment-lifecycle"/,
    /\^#log-assessment-lifecycle\(\\\?\|\$\)\/\.test\(location\.hash\)\) return "refLogAssessmentLifecycle"/,
    /\{ key: "refLogAssessmentLifecycle", label: "Log assessment lifecycle" \}/,
    /\ninitLogAssessmentLifecycle\(\);\n/,
  ]) assert.match(text, pattern);
  const article = text.slice(text.indexOf('<article id="logAssessmentFrameworkReferenceView"'), text.indexOf('<section id="log-af-definition"'));
  assert.match(article, /<button type="button" class="xref-chip" data-open-lal>/);
});

test('layers, rows, domains, outputs and steps reference each other consistently', () => {
  assert.equal(LAL_LAYERS.length, 5);
  assert.equal(LAL_ROWS.length, 6);
  assert.equal(LAL_DOMAINS.length, 10);
  assert.equal(LAL_OUTPUTS.length, 4);
  assert.equal(LAL_STEPS.length, 5);
  const layerIds = new Set(LAL_LAYERS.map(l => l.id));
  const domainIds = new Set(LAL_DOMAINS.map(d => d.n));
  for (const l of LAL_LAYERS) assert.ok(LAL_LENS[l.lens], `${l.id}: unknown lens ${l.lens}`);
  for (const r of LAL_ROWS) assert.ok(layerIds.has(r.layer), `row ${r.stage}: unknown layer ${r.layer}`);
  for (const o of LAL_OUTPUTS) {
    assert.ok(layerIds.has(o.layer), `${o.id}: unknown layer`);
    for (const [item, from] of o.items) for (const n of from) assert.ok(domainIds.has(n), `${o.id} ${item}: unknown domain ${n}`);
  }
  for (const s of LAL_STEPS) {
    for (const id of s.light.layers || []) assert.ok(layerIds.has(id));
    for (const n of s.light.domains || []) assert.ok(domainIds.has(n));
  }
  assert.equal(LAL_DOMAINS.filter(d => d.unnumbered).map(d => d.name).join(), 'Line Analysis');
});

test('every reference link opens a real article, and every domain section exists in the article', () => {
  const articles = new Set([...text.matchAll(/<article id="(\w+)ReferenceView"/g)].map(m => m[1]));
  const view = name => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const names = [...Object.values(LAL_REFS), ...Object.values(LAL_LAYER_REFS).flat()];
  for (const name of names) assert.ok(articles.has(view(name)), `no article for ${name}`);
  const pageTerms = new Set([...LAL_ROWS.flatMap(r => r.terms), ...LAL_DOMAINS.flatMap(d => d.checks), ...LAL_OUTPUTS.flatMap(o => o.items.map(([t]) => t))]);
  for (const term of Object.keys(LAL_REFS)) assert.ok(pageTerms.has(term), `LAL_REFS term "${term}" is not on the page`);
  const article = text.slice(text.indexOf('<article id="logAssessmentFrameworkReferenceView"'), text.indexOf('</article>', text.indexOf('<article id="logAssessmentFrameworkReferenceView"')));
  for (const [n, section] of Object.entries(LAL_DOMAIN_SECTIONS)) {
    assert.ok(LAL_DOMAINS.some(d => d.n === +n), `section for unknown domain ${n}`);
    assert.match(article, new RegExp(`<section id="${section}"`), `domain ${n}: no section ${section}`);
  }
});

test('every layer links to real log source journey stages, and every domain has an icon', () => {
  const flowStart = text.indexOf('<div class="onboarding-flow" data-journey="onboarding">');
  const flow = text.slice(flowStart, text.indexOf('<div class="onboarding-flow" data-journey="detection">'));
  for (const l of LAL_LAYERS) {
    assert.ok((LAL_LAYER_JOURNEY[l.id] || []).length, `${l.id} has no journey stages`);
    for (const id of LAL_LAYER_JOURNEY[l.id]) assert.match(flow, new RegExp(`<div class="onboarding-stage" id="${id}"`), `${l.id}: no stage ${id}`);
  }
  for (const d of LAL_DOMAINS) assert.ok(LAL_DOMAIN_ICONS[d.n], `domain ${d.name} has no icon`);
});
