'use strict';
// Onboarding journey map: it is drawn from the stage and gate detail markup, so the loop-backs
// have to be declared there. Every branch that sends work back ("back to ...", "re-submit")
// carries data-to naming a real stage, and the old hand-kept copy of the gates is gone.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();
const start = text.indexOf('<div class="onboarding-flow">');
const flow = text.slice(start, text.indexOf('</section>', start));
const stageIds = new Set([...flow.matchAll(/<div class="onboarding-stage" id="([\w-]+)"/g)].map(m => m[1]));

test('the detail has the stages and gates the map is built from', () => {
  assert.equal(stageIds.size, 19);
  assert.equal((flow.match(/<div class="onboarding-gate">/g) || []).length, 13);
});

test('every loop-back branch names a real stage with data-to', () => {
  const branches = [...flow.matchAll(/<div class="onboarding-branch"( data-to="([\w-]+)")?><span class="flow-badge (\w+)">[^<]*<\/span>([^\n]*?)<\/div>/g)];
  assert.ok(branches.length >= 30, `expected 30+ branches, found ${branches.length}`);
  for (const [, , to, tone, body] of branches) {
    if (to) assert.ok(stageIds.has(to), `data-to="${to}" is not a stage`);
    if (/back to|re-submit/.test(body)) assert.ok(to, `loop-back without data-to: ${tone} ${body}`);
  }
  assert.equal(branches.filter(b => b[2]).length, 10);
  assert.match(flow, /<div class="onboarding-loopback" data-from="ob-sustainment" data-to="ob-governance">/);
});

test('the map is the journey view, with no separate copy of the gates', () => {
  assert.doesNotMatch(text, /ONBOARDING_MAP_GATES|ONBOARDING_MAP_ROWS|ONBOARDING_MAP_BRANCH/);
  assert.match(text, /<div class="onboarding-flow-map ob-journey" id="onboardingJourney"/);
  for (const id of ['objStats', 'objSearch', 'objStepper', 'onboardingFlowMapWrap', 'objInspector']) assert.match(text, new RegExp(`id="${id}"`));
  assert.match(text, /function onboardingJourneyModel\(flow\)/);
});
