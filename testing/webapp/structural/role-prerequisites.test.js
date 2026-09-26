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
const descriptions = new Map();
rolesTableData.forEach(row => {
  if (!descriptions.has(row.Capability)) descriptions.set(row.Capability, []);
  descriptions.get(row.Capability).push(row['What it lets you do'] || '');
});

test('every prerequisite rule refers to capabilities that exist in the roles matrix', () => {
  assert.ok(prerequisites.length > 0);
  for (const rule of prerequisites) {
    assert.ok(descriptions.has(rule.capability), `${rule.capability} is not in rolesTableData`);
    for (const required of rule.requires) {
      assert.ok(descriptions.has(required), `${rule.capability} requires ${required}, which is not in rolesTableData`);
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
