'use strict';
// Cross-links between the Roles, Splunk API and Configuration file reference pages.
// RESTMAP_CAPABILITY_RULES is generated from Splunk's default restmap.conf
// (scripts/xref/restmap_capabilities.py); these checks catch it drifting from the pages it
// links: every path must be on the Splunk API page and every capability on the Roles page,
// so no cross-link points at nothing.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndexHtml, extractBalancedArray } = require('../lib/parse-index');

const text = readIndexHtml();
const arrayAfter = marker => {
  const start = text.indexOf(marker);
  assert.ok(start !== -1, `${marker} not found`);
  return vm.runInNewContext(extractBalancedArray(text, text.indexOf('[', start)));
};
const rules = arrayAfter('const RESTMAP_CAPABILITY_RULES =');
const roles = arrayAfter('const rolesTableData =');
const unassigned = arrayAfter('const ROLE_UNASSIGNED_CAPABILITIES =');
const atlasStart = text.indexOf('const splunkApiAtlas = ') + 'const splunkApiAtlas = '.length;
const atlas = JSON.parse(text.slice(atlasStart, text.indexOf('\n', atlasStart)).replace(/;$/, ''));

test('restmap.conf rules exist and point at Splunk API page paths', () => {
  assert.ok(rules.length > 0, 'RESTMAP_CAPABILITY_RULES is empty -- run scripts/xref/restmap_capabilities.py');
  const paths = new Set(atlas.endpoints.flatMap(e => e.paths || []));
  for (const rule of rules) assert.ok(paths.has(rule.path), `${rule.path} is not a path on the Splunk API page`);
});

test('every capability a restmap.conf rule names is on the Roles page', () => {
  const known = new Set([...roles.map(r => r.Capability), ...unassigned.map(u => u.capability)]);
  for (const rule of rules) {
    for (const r of rule.rules) {
      for (const cap of r.requires.match(/[a-z][a-z0-9_]*/g).filter(t => t !== 'and' && t !== 'or')) {
        assert.ok(known.has(cap), `${rule.path} requires ${cap}, which the Roles page doesn't list`);
      }
    }
  }
});

test('the authorize.conf article links to the Roles page', () => {
  const start = text.indexOf('<section id="authorize-conf-global"');
  assert.match(text.slice(start, text.indexOf('</section>', start)), /<a href="#roles">Roles page<\/a>/);
});
