'use strict';
// CAPABILITY_PREREQUISITES is hand-checked against the capability descriptions in
// rolesTableData. These tests fail if a description stops naming a listed prerequisite,
// or if a listed capability disappears from the matrix, so the warnings can't drift from
// the data they're based on.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndexHtml, extractBalancedArray } = require('../lib/parse-index');

const text = readIndexHtml();

function evalArrayAfter(marker) {
  const start = text.indexOf(marker);
  assert.ok(start !== -1, `${marker} not found in index.html`);
  return vm.runInNewContext(extractBalancedArray(text, text.indexOf('[', start)));
}

const prerequisites = evalArrayAfter('const CAPABILITY_PREREQUISITES =');
const rolesTableData = evalArrayAfter('const rolesTableData =');
// Capabilities no built-in role holds by default: listed separately, but prerequisites can
// involve them (e.g. edit_saved_search needs list_saved_searches).
const unassigned = evalArrayAfter('const ROLE_UNASSIGNED_CAPABILITIES =');
const descriptions = new Map();
rolesTableData.forEach(row => {
  if (!descriptions.has(row.Capability)) descriptions.set(row.Capability, []);
  descriptions.get(row.Capability).push(row['What it lets you do'] || '');
});
unassigned.forEach(item => {
  if (!descriptions.has(item.capability)) descriptions.set(item.capability, []);
  descriptions.get(item.capability).push(item.description || '');
});

test('capabilities listed as held by no built-in role have no rows in the roles matrix', () => {
  const inMatrix = new Set(rolesTableData.map(row => row.Capability));
  for (const item of unassigned) {
    assert.ok(!inMatrix.has(item.capability), `${item.capability} is in both rolesTableData and ROLE_UNASSIGNED_CAPABILITIES`);
    assert.ok(item.description, `${item.capability} has no description`);
  }
});

test('every prerequisite rule refers to known capabilities', () => {
  assert.ok(prerequisites.length > 0);
  for (const rule of prerequisites) {
    assert.ok(descriptions.has(rule.capability), `${rule.capability} is not a known capability`);
    for (const required of rule.requires) {
      assert.ok(descriptions.has(required), `${rule.capability} requires ${required}, which is not a known capability`);
    }
  }
});

test("each prerequisite is named in the dependent capability's own description", () => {
  for (const rule of prerequisites) {
    for (const required of rule.requires) {
      const named = descriptions.get(rule.capability).some(desc => new RegExp(`\\b${required}\\b`).test(desc));
      assert.ok(named, `no description of ${rule.capability} mentions ${required}`);
    }
  }
});
