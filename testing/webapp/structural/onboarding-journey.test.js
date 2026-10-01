'use strict';
// Onboarding journey map: it is drawn from the stage and gate detail markup, so the loop-backs
// have to be declared there. Every branch that sends work back ("back to ...", "re-submit")
// carries data-to naming a real stage, and the old hand-kept copy of the gates is gone.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();
const flowOf = key => {
  const start = text.indexOf(`<div class="onboarding-flow" data-journey="${key}">`);
  assert.ok(start !== -1, `${key} flow not found`);
  const next = text.indexOf('<div class="onboarding-flow" data-journey=', start + 10);
  return text.slice(start, next !== -1 ? next : text.indexOf('</section>', start));
};
const flow = flowOf('onboarding');
const detection = flowOf('detection');
const idsIn = html => new Set([...html.matchAll(/<div class="onboarding-stage" id="([\w-]+)"/g)].map(m => m[1]));
const stageIds = idsIn(flow);

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
  assert.match(text, /function onboardingJourneyModel\(flow, route\)/);
});

test('the detection lifecycle route loops within itself and links to real log source steps', () => {
  const ids = idsIn(detection);
  assert.equal(ids.size, 14);
  assert.equal((detection.match(/<div class="onboarding-gate">/g) || []).length, 5);
  for (const [, to] of detection.matchAll(/data-to="([\w-]+)"/g)) assert.ok(ids.has(to), `data-to="${to}" is not a detection stage`);
  const links = [...detection.matchAll(/<div class="onboarding-feed onboarding-link" data-link="([\w-]+)" data-dir="(in|out)">/g)];
  assert.equal(links.length, 6);
  for (const [, to] of links) assert.ok(stageIds.has(to.replace(/^gate-/, '')), `data-link="${to}" is not a log source step`);
  for (const state of ['PROPOSED', 'DEVELOPMENT', 'TESTING', 'PEER REVIEW', 'PRODUCTION', 'MONITORING', 'TUNING', 'REVALIDATION', 'DEPRECATED', 'RETIRED']) {
    assert.match(detection, new RegExp(`<span class="flow-badge state">${state}</span>`), `lifecycle state ${state} (TAX-05.03.02) missing`);
  }
  assert.equal((detection.match(/<ul class="onboarding-checklist" data-tier="standard">/g) || []).length, 1);
  assert.match(text, /<button type="button" data-route="detection" aria-pressed="false">Detection lifecycle<\/button>/);
});

test('the journey tracker stays in this browser and offers the taxonomy lifecycle states', () => {
  const start = text.indexOf('// --- Journey tracker ---');
  assert.ok(start !== -1, 'tracker code not found');
  const code = text.slice(start, text.indexOf('function initOnboardingFlowMap()', start));
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.match(code, /const JOURNEY_TRACKER_KEY = "latchJourneyTracker\.v1";/);
  assert.match(code, /onboarding: \["PLANNED", "ONBOARDING", "ACTIVE", "DEGRADED", "EXPIRED", "RETIRED", "EXCEPTION"\]/);
  assert.match(code, /detection: \["PROPOSED", "DEVELOPMENT", "TESTING", "PEER REVIEW", "PRODUCTION", "MONITORING", "TUNING", "REVALIDATION", "DEPRECATED", "RETIRED"\]/);
  assert.match(text, /Saved only in this browser &mdash; nothing is sent anywhere\./);
  assert.match(text, /\ninitOnboardingFlowMap\(\);\ninitJourneyTracker\(\);\n/);
});
