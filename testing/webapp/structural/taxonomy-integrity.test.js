'use strict';
// Structural integrity of the taxonomy tree embedded in index.html's
// `nodes` array. Covers the full audit performed when fixing the broken
// TAX-02.03.02.01 reference and the 20 stale entryCount badges: orphaned
// parents, duplicate codes, numbering gaps, and entryCount vs actual
// current-entries-group instance counts.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml, parseTaxonomyNodes } = require('../lib/parse-index');

const text = readIndexHtml();
const nodes = parseTaxonomyNodes(text);
const taxNodes = nodes.filter(n => n.nodeType === 'taxonomy');
const groupNodes = nodes.filter(n => n.nodeType === 'group');
const instanceNodes = nodes.filter(n => n.nodeType === 'instance');

describe('taxonomy node counts', () => {
  test('total node count is stable (update this if nodes were intentionally added/removed)', () => {
    assert.equal(nodes.length, 2522);
  });
  test('taxonomy/group/instance split is stable', () => {
    assert.equal(taxNodes.length, 468);
    assert.equal(groupNodes.length, 44);
    assert.equal(instanceNodes.length, 2010);
  });
});

describe('no duplicate codes', () => {
  test('every node code is unique', () => {
    const seen = new Map();
    for (const n of nodes) {
      seen.set(n.code, (seen.get(n.code) || 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, c]) => c > 1);
    assert.deepEqual(dupes, [], `duplicate codes found: ${JSON.stringify(dupes)}`);
  });
});

describe('taxonomy tree shape', () => {
  test('exactly 7 top-level domains, TAX-01 through TAX-07', () => {
    const roots = taxNodes.filter(n => !n.parentCode).map(n => n.code).sort();
    assert.deepEqual(roots, ['TAX-01', 'TAX-02', 'TAX-03', 'TAX-04', 'TAX-05', 'TAX-06', 'TAX-07']);
  });

  test('no orphaned taxonomy-node parents', () => {
    const taxCodes = new Set(taxNodes.map(n => n.code));
    const orphans = taxNodes.filter(n => n.parentCode && !taxCodes.has(n.parentCode));
    assert.deepEqual(orphans.map(n => n.code), [], `orphaned parents: ${orphans.map(n => `${n.code}->${n.parentCode}`).join(', ')}`);
  });

  test('no numbering gaps among a taxonomy node\'s direct children', () => {
    const children = new Map();
    for (const n of taxNodes) {
      if (!n.parentCode) continue;
      if (!children.has(n.parentCode)) children.set(n.parentCode, []);
      children.get(n.parentCode).push(n.code);
    }
    const gaps = [];
    for (const [parent, kids] of children) {
      const nums = kids
        .map(k => k.match(/\.(\d+)$/))
        .filter(Boolean)
        .map(m => parseInt(m[1], 10))
        .sort((a, b) => a - b);
      if (nums.length === 0) continue;
      const expected = Array.from({ length: nums[nums.length - 1] }, (_, i) => i + 1);
      const missing = expected.filter(e => !nums.includes(e));
      if (missing.length) gaps.push(`${parent}: has ${nums.join(',')}, missing ${missing.join(',')}`);
    }
    assert.deepEqual(gaps, []);
  });
});

describe('entryCount badge accuracy (regression: 20 stale badges fixed)', () => {
  test('every taxonomy node\'s entryCount matches its current-entries group\'s actual instance count', () => {
    const instByParent = new Map();
    for (const n of instanceNodes) {
      instByParent.set(n.parentCode, (instByParent.get(n.parentCode) || 0) + 1);
    }
    const groupByParentTaxCode = new Map();
    for (const g of groupNodes) groupByParentTaxCode.set(g.parentCode, g);

    const mismatches = [];
    for (const t of taxNodes) {
      const declared = t.entryCount || 0;
      const grp = groupByParentTaxCode.get(t.code);
      const actual = grp ? (instByParent.get(grp.code) || 0) : 0;
      if (declared !== actual) {
        mismatches.push(`${t.code} (${t.term}): declared=${declared} actual=${actual}`);
      }
    }
    assert.deepEqual(mismatches, [], `entryCount mismatches:\n${mismatches.join('\n')}`);
  });

  test('the specific worst-case regression case: Required SIEM Event Type shows 1180', () => {
    const node = taxNodes.find(n => n.code === 'TAX-03.01.01.01');
    assert.ok(node, 'TAX-03.01.01.01 should exist');
    assert.equal(node.entryCount, 1180);
  });

  test('the specific overstated case: Sourcetype Identity (TAX-04.11) shows 0, not 25', () => {
    const node = taxNodes.find(n => n.code === 'TAX-04.11');
    assert.ok(node, 'TAX-04.11 should exist');
    assert.equal(node.entryCount, 0);
  });
});

describe('dangling TAX-XX code references (regression: TAX-02.03.02.01)', () => {
  test('systemApprovalFieldTaxonomy["System Approval"] resolves to a real taxonomy node', () => {
    const m = text.match(/"System Approval":\s*"([^"]+)"/);
    assert.ok(m, 'systemApprovalFieldTaxonomy entry for "System Approval" should exist');
    const code = m[1];
    const taxCodes = new Set(taxNodes.map(n => n.code));
    assert.ok(taxCodes.has(code), `"${code}" should be a real taxonomy node code`);
    assert.equal(code, 'TAX-02.03.01');
  });

  test('every TAX-XX-shaped string in the file is either a real taxonomy node, ' +
       'a documented historical rename, or a kept-for-display old code', () => {
    const allRefs = new Set((text.match(/\bTAX-\d{2}(?:\.\d{2}){0,4}\b/g)) || []);
    const taxCodes = new Set(taxNodes.map(n => n.code));
    const missing = [...allRefs].filter(r => !taxCodes.has(r)).sort();

    // Known, reviewed exceptions -- see docs/glossary.md and the TAX-02.10 /
    // TAX-07.06 renumbering notes in the taxonomy `notes` fields for why
    // these are intentional rather than broken references.
    const knownExceptions = new Set([
      'TAX-02.10', // consolidated into TAX-01, kept in "notes" as history
      'TAX-04.09.03.01', 'TAX-04.09.03.02', 'TAX-04.09.03.03', 'TAX-04.09.03.04',
      'TAX-04.09.03.05', 'TAX-04.09.03.06', 'TAX-04.09.03.07', 'TAX-04.09.03.08',
      'TAX-04.09.03.09', 'TAX-04.09.03.10', 'TAX-04.09.03.11', 'TAX-04.09.03.12',
    ]);
    const unexplained = missing.filter(r => !knownExceptions.has(r));
    assert.deepEqual(unexplained, [], `unexplained dangling TAX-XX references: ${unexplained.join(', ')}`);
  });
});
