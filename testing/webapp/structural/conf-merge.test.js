'use strict';
// Configuration file reference: the effective-configuration explainer. The precedence logic
// runs here in a sandbox against small layered samples, checking Splunk's orders for global
// context (all app locals, then all app defaults, apps A-z) and app/user context (current app
// first, other apps z-A and only when exported), plus [default] inheritance and repeats.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();

function blockFrom(startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `${startMarker} not found`);
  const end = text.indexOf(endMarker, start);
  assert.ok(end !== -1, `${endMarker} not found after ${startMarker}`);
  return text.slice(start, end);
}

const sandbox = {};
vm.runInNewContext(blockFrom('const CONF_MERGE_TYPES = ', 'const confMergeState = ') +
  '\nthis.resolve = confMergeResolve; this.btool = confMergeBtool;', sandbox);

const layer = (type, body, extra = {}) => ({ type, app: '', user: '', exported: false, text: body, ...extra });
const resolve = (ctx, layers) => JSON.parse(JSON.stringify(sandbox.resolve('x.conf', ctx, layers), (k, v) => (v instanceof Map ? undefined : v)));
const value = (result, stanza, key) => {
  const s = result.stanzas.find(x => x.name === stanza);
  const setting = s && s.settings.find(x => x.key === key);
  return setting ? `${setting.value} <- ${setting.layer.name}` : undefined;
};

test('global context: system local, every app local (A-z), every app default, system default', () => {
  const r = resolve({ id: 'global' }, [
    layer('system-default', '[s]\na = sysdef\nb = sysdef\nc = sysdef\nd = sysdef'),
    layer('app-default', '[s]\na = zdef\nb = zdef\nc = zdef', { app: 'zeta' }),
    layer('app-local', '[s]\na = zlocal\nb = zlocal', { app: 'zeta' }),
    layer('app-local', '[s]\na = alocal', { app: 'Alpha' }),
    layer('system-local', '[t]\nx = 1'),
    layer('user-local', '[s]\na = user', { app: 'search', user: 'admin' }),
  ]);
  assert.deepEqual(r.active.map(p => p.name), ['System local', 'App local (Alpha)', 'App local (zeta)', 'App default (zeta)', 'System default']);
  assert.equal(value(r, 's', 'a'), 'alocal <- App local (Alpha)');
  assert.equal(value(r, 's', 'b'), 'zlocal <- App local (zeta)');
  assert.equal(value(r, 's', 'c'), 'zdef <- App default (zeta)');
  assert.equal(value(r, 's', 'd'), 'sysdef <- System default');
  assert.match(r.placed[5].ignored, /only in app\/user context/);
  const a = r.stanzas.find(x => x.name === 's').settings.find(x => x.key === 'a');
  assert.match(a.overridden[0].why, /ASCII order of directory name, so Alpha comes before zeta/);
});

test('indexer peer context puts peer-app local first and peer-app default after app local', () => {
  const r = resolve({ id: 'global-indexer-cluster-peer' }, [
    layer('peer-default', '[s]\na = peerdef\nb = peerdef', { app: 'p' }),
    layer('app-local', '[s]\nb = applocal', { app: 'p2' }),
    layer('peer-local', '[s]\na = peerlocal', { app: 'p' }),
    layer('system-local', '[s]\na = syslocal\nb = syslocal'),
  ]);
  assert.equal(value(r, 's', 'a'), 'peerlocal <- Indexer peer local (p)');
  assert.equal(value(r, 's', 'b'), 'syslocal <- System local');
  assert.match(resolve({ id: 'global' }, [layer('peer-local', '', { app: 'p' })]).placed[0].ignored, /indexer cluster peer/);
});

test('app/user context: user, current app, exported other apps z-A, then system', () => {
  const ctx = { id: 'app-user', app: 'search', user: 'admin' };
  const r = resolve(ctx, [
    layer('system-local', '[s]\na = syslocal\nb = syslocal\nc = syslocal\nd = syslocal'),
    layer('app-local', '[s]\nb = alpha', { app: 'alpha', exported: true }),
    layer('app-local', '[s]\nb = zeta\nc = zeta', { app: 'zeta', exported: true }),
    layer('app-default', '[s]\nc = search\nd = hidden', { app: 'search' }),
    layer('app-local', '[s]\nd = notexported', { app: 'beta' }),
    layer('user-local', '[s]\na = user', { app: 'search', user: 'admin' }),
    layer('user-local', '[s]\na = other', { app: 'search', user: 'bob' }),
  ]);
  assert.equal(value(r, 's', 'a'), 'user <- User local (admin, search)');
  assert.equal(value(r, 's', 'b'), 'zeta <- App local (zeta)');
  assert.equal(value(r, 's', 'c'), 'search <- App default (search)');
  assert.equal(value(r, 's', 'd'), 'hidden <- App default (search)');
  assert.match(r.placed[4].ignored, /^Not exported/);
  assert.match(r.placed[6].ignored, /current user's directory/);
});

test('[default] and settings above the first stanza are inherited; a repeated setting keeps its last value', () => {
  const r = resolve({ id: 'global' }, [layer('system-local', 'host = a\n[default]\nindex = main\n[s]\nx = 1\nx = 2\n# comment\n; comment\n[t]\nhost = b')]);
  assert.equal(value(r, 'default', 'host'), 'a <- System local');
  assert.equal(value(r, 's', 'x'), '2 <- System local');
  assert.deepEqual(r.stanzas.find(x => x.name === 's').inherits.map(x => x.key), ['host', 'index']);
  assert.deepEqual(r.stanzas.find(x => x.name === 't').inherits.map(x => x.key), ['index']);
  assert.equal(r.dups.length, 1);
  assert.equal(r.dups[0].first, 5);
});

test('the same directory twice is read once, and an app layer needs its directory name', () => {
  const r = resolve({ id: 'global' }, [layer('system-local', '[s]\na = 1'), layer('system-local', '[s]\na = 2'), layer('app-local', '[s]\na = 3')]);
  assert.equal(value(r, 's', 'a'), '1 <- System local');
  assert.match(r.placed[1].ignored, /Same location as layer 1/);
  assert.match(r.placed[2].ignored, /app's directory name/);
});

test('the btool view prefixes every line with the file its value came from', () => {
  const out = sandbox.btool(sandbox.resolve('inputs.conf', { id: 'global' }, [
    layer('system-default', '[default]\nindex = default'),
    layer('app-local', '[monitor:///x]\nsourcetype = y', { app: 'a' }),
  ]));
  assert.equal(out, [
    'etc/system/default/inputs.conf [default]',
    'etc/system/default/inputs.conf index = default',
    'etc/apps/a/local/inputs.conf   [monitor:///x]',
    'etc/system/default/inputs.conf index = default',
    'etc/apps/a/local/inputs.conf   sourcetype = y',
  ].join('\n'));
});

test('the view is wired into the Configuration file reference and the directory tree', () => {
  assert.match(text, /<button type="button" id="confFileViewMergeBtn" class="ports-view-btn" aria-pressed="false">Effective configuration<\/button>/);
  assert.match(text, /<div id="configFileMergeView" hidden>/);
  assert.match(text, /data-open-merge="' \+ escapeHtml\(file\.id\) \+ '"/);
  assert.match(text, /\ninitConfChecker\(\);\ninitConfMerge\(\);\n/);
  const render = blockFrom('function renderConfMergeResult(', 'function ordinalSuffix(');
  assert.doesNotMatch(render, /localStorage|sessionStorage|indexedDB/);
});
