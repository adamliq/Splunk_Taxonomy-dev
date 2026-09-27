"""Build CONF_SPEC_INDEX in index.html for the .conf checker, from Splunk's .conf.spec files.

Usage:
  python3 scripts/conf_check/build_conf_index.py <spec_files/10.4 folder> [--defaults <default .conf folder>] [--apply index.html]

For every spec file that has a Configuration file reference article, the index records the
spec's stanza names and, per stanza, its setting names. A setting is marked deprecated ("d")
or removed / no longer supported ("r") when the first lines of its own description say so,
with the replacement the spec names ("use 'X' instead"), if any. Stanza and setting names keep
the spec's <placeholders>; the checker turns them into patterns.

--defaults points at Splunk's shipped default .conf files (etc/system/default, e.g. the
jewnix/splunk-spec-files mirror). Anything those files use that the spec doesn't document is
recorded too ("x": stanza names and stanza -> settings; for authorize.conf, "c": capabilities
granted in role stanzas), so Splunk's own configuration never shows up as an error.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'spec'))
from parse_spec import parse  # noqa: E402

MARKER = 'const CONF_SPEC_INDEX = '
# sourcetypes.conf holds Splunk's machine-generated source type models, not hand-edited settings.
SKIP = {'sourcetypes.conf'}
# Only the spec's explicit statement forms, at the start of a description line -- conditional
# wording ("has no effect when mode is single", "the value X is no longer supported") isn't a
# statement about the setting itself.
REMOVED_RE = re.compile(r'^(REMOVED\b|UNSUPPORTED\b|No longer used|Support for this setting has been removed|'
                        r'This setting (has been removed|is no longer (supported|used)|has been deprecated and has no effect|no longer has any effect))')
DEPRECATED_RE = re.compile(r'^(DEPRECATED\b|MOVED\.|This setting (is|has been) (DEPRECATED|deprecated)\b)')
REPLACEMENT_RE = re.compile(r"(?:[Uu]se|[Ss]et|[Rr]eplaced by|in favor of|superseded by)\s+(?:the\s+)?'([\w.:<>/-]+)'")


def detail_name(spec_file):
    base = spec_file[:-len('.spec')]
    return base.replace('.conf', '').replace('_', '-').replace('.', '-') + '-conf', base


def spec_pattern(name):
    """Python twin of confSpecPattern() in index.html."""
    classed = re.match(r'^([A-Za-z_.]+)-<[^>]+>$', name)
    if classed:
        return re.compile('^' + re.escape(classed.group(1)) + '(?:-.+)?$')
    out, i = '', 0
    while i < len(name):
        ch = name[i]
        if ch == '<' and name.find('>', i) != -1:
            j = name.find('>', i)
            out += '.*' if re.search(r'\bany\b', name[i:j]) else '.+?'
            i = j + 1
            continue
        if name.startswith('...', i):
            out += '.*'; i += 3; continue
        out += {'[': '(?:', ']': ')?', '*': '.*', '|': '|'}.get(ch, re.escape(ch))
        i += 1
    try:
        return re.compile('^(?:' + out + ')$')
    except re.error:
        return re.compile('^' + re.escape(name) + '$')


def read_conf(path):
    stanza, pairs, continuing = None, [], False
    for raw in open(path, encoding='utf-8', errors='replace'):
        line = raw.strip()
        if continuing:
            continuing = line.endswith('\\')
            continue
        if not line or line[0] in '#;':
            continue
        m = re.match(r'^\[(.*)\]$', line)
        if m:
            stanza = m.group(1).strip()
            pairs.append((stanza, None))
            continue
        kv = re.match(r'^\s*([^=]+?)\s*=(.*)$', raw)
        if kv:
            pairs.append((stanza, kv.group(1).strip()))
            continuing = kv.group(2).rstrip().endswith('\\')
    return pairs


def undocumented(stanzas, pairs, conf):
    """What the shipped default uses that the spec (as the checker reads it) doesn't cover."""
    named = [(st[0], spec_pattern(st[0])) for st in stanzas if st[0] not in (None, 'default')]
    any_stanza = not named
    settings = {}
    for name, items in stanzas:
        settings[name] = [(n if isinstance(n, str) else n[0]) for n in items]
    def allowed(key, names, bare_placeholder=True):
        for nm in names:
            for s in settings.get(nm, []):
                if not bare_placeholder and re.fullmatch(r'<[^>]+>', s):
                    continue
                if s == key or (('<' in s or '*' in s) and spec_pattern(s).match(key)):
                    return True
        return False
    type_of = lambda n: re.split(r'://|:', n)[0]
    extra_stanzas, extra_keys, caps = set(), {}, set()
    cap_names = {st[0][12:] for st in stanzas if st[0] and st[0].startswith('capability::')}
    for stanza, key in pairs:
        if stanza in (None, 'default') or any_stanza:
            scope = [st[0] for st in stanzas]
        else:
            scope = [n for n, rx in named if rx.match(stanza)] or [n for n, _ in named if type_of(n) == type_of(stanza)]
            if not scope:
                extra_stanzas.add(stanza)
            scope = scope + [None, 'default']
        if key is None or key == 'disabled':
            continue
        if conf == 'authorize.conf' and (stanza in (None, 'default') or stanza.startswith('role_')) and not allowed(key, [n for n in scope if n is None or not n.startswith('capability::')], bare_placeholder=False):
            if key not in cap_names:
                caps.add(key)
            continue
        if not allowed(key, scope):
            extra_keys.setdefault(stanza if stanza is not None else '', set()).add(key)
    return sorted(extra_stanzas), {k: sorted(v) for k, v in sorted(extra_keys.items())}, sorted(caps)


def status_of(bullets):
    head = [b['text'] for b in bullets[:2]]
    status = ''
    if any(REMOVED_RE.search(t) for t in head):
        status = 'r'
    elif any(DEPRECATED_RE.search(t) for t in head):
        status = 'd'
    if not status:
        return '', ''
    for b in bullets:
        m = REPLACEMENT_RE.search(b['text'])
        if m:
            return status, m.group(1)
    return status, ''


def build(spec_dir, index_html, defaults_dir=None):
    html = open(index_html, encoding='utf-8').read()
    index = {}
    for spec_file in sorted(os.listdir(spec_dir)):
        if not spec_file.endswith('.conf.spec'):
            continue
        detail, conf = detail_name(spec_file)
        view = re.sub(r'-([a-z0-9])', lambda m: m.group(1).upper(), detail) + 'ReferenceView'
        if f'<article id="{view}"' not in html or conf in SKIP:
            continue
        stanzas = []
        for st in parse(os.path.join(spec_dir, spec_file)):
            settings = []
            for s in st['settings']:
                status, repl = status_of(s['bullets'])
                settings.append([s['name'], status, repl] if status else s['name'])
            stanzas.append([st['name'], settings])
        index[conf] = {'d': detail, 's': stanzas}
        default_file = os.path.join(defaults_dir, conf) if defaults_dir else None
        if default_file and os.path.exists(default_file):
            extra_stanzas, extra_keys, caps = undocumented(stanzas, read_conf(default_file), conf)
            if extra_stanzas or extra_keys:
                index[conf]['x'] = {'stanzas': extra_stanzas, 'keys': extra_keys}
            if caps:
                index[conf]['c'] = caps
    return index


def apply(index_html, index):
    text = open(index_html, encoding='utf-8').read()
    if text.count(MARKER) != 1:
        sys.exit(f'Expected exactly one "{MARKER}" in {index_html}.')
    start = text.index(MARKER)
    end = text.index('\n', start)
    body = MARKER + json.dumps(index, separators=(',', ':'), ensure_ascii=False) + ';'
    open(index_html, 'w', encoding='utf-8').write(text[:start] + body + text[end:])


if __name__ == '__main__':
    args = sys.argv[1:]
    target = None
    defaults_dir = None
    if '--defaults' in args:
        i = args.index('--defaults')
        defaults_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
    if '--apply' in args:
        i = args.index('--apply')
        target = args[i + 1]
        args = args[:i] + args[i + 2:]
    if len(args) != 1:
        sys.exit(__doc__)
    index = build(args[0], target or 'index.html', defaults_dir)
    if target:
        apply(target, index)
    n_set = sum(len(s[1]) for v in index.values() for s in v['s'])
    flagged = sum(1 for v in index.values() for s in v['s'] for x in s[1] if isinstance(x, list))
    extra = sum(len(v.get('x', {}).get('stanzas', [])) + sum(len(k) for k in v.get('x', {}).get('keys', {}).values()) + len(v.get('c', [])) for v in index.values())
    print(f'{len(index)} files, {n_set} settings ({flagged} deprecated/removed), {extra} undocumented names from shipped defaults, {len(json.dumps(index, separators=(",", ":"))) // 1024} KB')
