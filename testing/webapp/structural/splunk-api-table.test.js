'use strict';
// Splunk API page table: sortable column headers and search-match highlighting.
// apiHighlight renders atlas text and the user's search into innerHTML, so it must escape
// both and add nothing but <mark> wrappers.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();

function functionSource(name) {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} not found`);
  const end = text.indexOf('\n}\n', start);
  return text.slice(start, end + 2);
}

const sandbox = {};
vm.runInNewContext(`${functionSource('escapeHtml')}\n${functionSource('apiHighlight')}\nthis.apiHighlight = apiHighlight;`, sandbox);
const { apiHighlight } = sandbox;

test('every Splunk API column header is a sort button with aria-sort', () => {
  const head = text.match(/<thead id="apiTableHead">([\s\S]*?)<\/thead>/);
  assert.ok(head, '#apiTableHead not found');
  const cells = head[1].match(/<th scope="col" aria-sort="none"><button type="button" class="api-sort" data-sort="([a-z]+)">/g) || [];
  assert.equal(cells.length, 5, 'expected 5 sortable column headers');
  for (const key of ['endpoint', 'methods', 'description', 'product', 'availability']) {
    assert.match(head[1], new RegExp(`data-sort="${key}"`), `missing sort button for ${key}`);
    assert.match(text, new RegExp(`\\n  ${key}: \\(a, b\\) =>`), `API_SORT_COMPARE has no comparator for ${key}`);
  }
});

test('apiHighlight marks every case-insensitive match', () => {
  assert.equal(apiHighlight('data/indexes/Index', 'index'), 'data/<mark>index</mark>es/<mark>Index</mark>');
  assert.equal(apiHighlight('auth/login', ''), 'auth/login');
  assert.equal(apiHighlight('auth/login', 'zzz'), 'auth/login');
});

test('apiHighlight escapes the text and the matched part', () => {
  assert.equal(apiHighlight('<b>x</b> & <b>', '<b>'), '<mark>&lt;b&gt;</mark>x&lt;/b&gt; &amp; <mark>&lt;b&gt;</mark>');
  assert.equal(apiHighlight('a"b', 'q'), 'a&quot;b');
});
