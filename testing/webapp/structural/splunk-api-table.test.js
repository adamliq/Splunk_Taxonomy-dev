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

// --- Copy request builder ---
// apiRequestSnippet is pure: it turns the chosen method, URL, auth and body into a curl,
// Python or PowerShell command. Values are quoted for each language so a stray quote in
// the atlas data can't break out of the string.
function blockFrom(startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `${startMarker} not found`);
  const end = text.indexOf(endMarker, start);
  assert.ok(end !== -1, `${endMarker} not found after ${startMarker}`);
  return text.slice(start, end);
}
const req = {};
vm.runInNewContext(
  `const splunkApiAtlas = { components: { x: { auth: ["Basic", "Authorization: Splunk <session_key>", "Authorization: Bearer <JWT> (sc_admin)", "ph-auth-token: <token>"] } } };\n` +
  functionSource('apiAuthOptions') + '\n' + functionSource('apiRequestUrl') + '\n' +
  blockFrom('const apiShellQuote', 'function renderApiRequest(') +
  '\nthis.apiAuthOptions = apiAuthOptions; this.apiRequestUrl = apiRequestUrl; this.apiRequestSnippet = apiRequestSnippet;',
  req);

test('apiAuthOptions reads Basic, header auth and a role hint from the atlas', () => {
  const opts = JSON.parse(JSON.stringify(req.apiAuthOptions('x')));
  assert.deepEqual(opts.map(o => o.type), ['basic', 'header', 'header', 'header']);
  assert.deepEqual(opts[2], { type: 'header', name: 'Authorization', value: 'Bearer <JWT>', hint: 'sc_admin', label: 'Authorization: Bearer <JWT>' });
  assert.equal(opts[3].name, 'ph-auth-token');
});

test('apiRequestUrl turns {param} into <param> and appends output_mode correctly', () => {
  assert.equal(req.apiRequestUrl('https://h:8089/services/', 'saved/searches/{name}', true), 'https://h:8089/services/saved/searches/<name>?output_mode=json');
  assert.equal(req.apiRequestUrl('https://s/', 'rest/download_attachment?vault_id=', true), 'https://s/rest/download_attachment?vault_id=&output_mode=json');
  assert.equal(req.apiRequestUrl('https://s/', 'rest/container', false), 'https://s/rest/container');
});

test('curl: GET has no -X, POST sends a form body, JSON sets Content-Type', () => {
  const auth = { type: 'header', name: 'Authorization', value: 'Bearer <JWT>' };
  assert.equal(req.apiRequestSnippet({ format: 'curl', method: 'GET', url: 'https://h/x', auth, body: null }),
    "curl 'https://h/x' \\\n  -H 'Authorization: Bearer <JWT>'");
  assert.match(req.apiRequestSnippet({ format: 'curl', method: 'POST', url: 'https://h/x', auth, body: { kind: 'form', field: '<field>', value: '<value>' } }),
    /^curl -X POST 'https:\/\/h\/x' \\\n  -H 'Authorization: Bearer <JWT>' \\\n  -d '<field>=<value>'$/);
  assert.match(req.apiRequestSnippet({ format: 'curl', method: 'PUT', url: 'https://h/x', auth: { type: 'basic' }, body: { kind: 'json', text: '{"a": "b"}' } }),
    /-u '<username>:<password>' \\\n  -H 'Content-Type: application\/json' -d '\{"a": "b"\}'$/);
});

test('Python and PowerShell use the right call, auth and body forms', () => {
  const py = req.apiRequestSnippet({ format: 'python', method: 'DELETE', url: 'https://h/x', auth: { type: 'basic' }, body: null });
  assert.match(py, /response = requests\.delete\(url, auth=\("<username>", "<password>"\)\)/);
  const pyJson = req.apiRequestSnippet({ format: 'python', method: 'POST', url: 'https://h/x', auth: { type: 'header', name: 'ph-auth-token', value: '<token>' }, body: { kind: 'json', text: '{"<field>": "<value>"}' } });
  assert.match(pyJson, /headers = \{"ph-auth-token": "<token>"\}/);
  assert.match(pyJson, /requests\.post\(url, headers=headers, json=\{"<field>": "<value>"\}\)/);
  const ps = req.apiRequestSnippet({ format: 'powershell', method: 'PATCH', url: 'https://h/x', auth: { type: 'header', name: 'Authorization', value: 'Splunk <HEC_token>' }, body: { kind: 'raw', text: '<raw event text>' } });
  assert.match(ps, /^\$headers = @\{ 'Authorization' = 'Splunk <HEC_token>' \}\n\$response = Invoke-RestMethod -Method Patch -Uri 'https:\/\/h\/x' `\n  -Headers \$headers `\n  -Body '<raw event text>'\n/);
});

test('single quotes in values are escaped for each language', () => {
  const auth = { type: 'header', name: 'X-Test', value: "it's" };
  const body = { kind: 'form', field: 'q', value: "a'b" };
  assert.match(req.apiRequestSnippet({ format: 'curl', method: 'POST', url: "https://h/o'x", auth, body }),
    /curl -X POST 'https:\/\/h\/o'\\''x' \\\n  -H 'X-Test: it'\\''s' \\\n  -d 'q=a'\\''b'/);
  assert.match(req.apiRequestSnippet({ format: 'powershell', method: 'POST', url: "https://h/o'x", auth, body }),
    /'X-Test' = 'it''s'[\s\S]*-Uri 'https:\/\/h\/o''x'[\s\S]*'q' = 'a''b'/);
  assert.match(req.apiRequestSnippet({ format: 'python', method: 'POST', url: 'https://h/"x', auth, body }),
    /url = "https:\/\/h\/\\"x"/);
});

test('every row with paths gets a Copy request button; operation-ID rows do not', () => {
  assert.match(text, /const build = e\.paths \? `<button type="button" class="api-req-open"/);
  assert.match(text, /<div id="apiRequestModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="apiRequestTitle" aria-hidden="true">/);
  assert.match(text, /\ninitSplunkApiPage\(\);\ninitApiRequestBuilder\(\);\n/);
});
