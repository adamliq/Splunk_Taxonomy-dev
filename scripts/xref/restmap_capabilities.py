"""Build RESTMAP_CAPABILITY_RULES in index.html from Splunk's default restmap.conf.

Usage:
  python3 scripts/xref/restmap_capabilities.py <path to default restmap.conf> [--apply index.html]

restmap.conf declares the capability a REST handler requires ('capability' for every method,
or 'capability.get' / '.post' / '.put' / '.delete'). Only some handlers declare one there --
most admin endpoints check capabilities inside splunkd -- so this is a partial mapping.

A handler is linked to a Splunk API page path only when the path equals the handler's
'match' path, or is that path plus one or more {parameter} segments. Prefix matches (e.g.
'/search' against 'search/jobs') are skipped: which handler Splunk picks for a longer path
isn't recorded in the file.
"""
import json
import re
import sys

ROOT_INDEX = 'index.html'
MARKER = 'const RESTMAP_CAPABILITY_RULES = '


def parse_restmap(path):
    stanzas, cur = [], None
    for raw in open(path, encoding='utf-8'):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^\[(.+)\]$', line)
        if m:
            cur = {'stanza': m.group(1)}
            stanzas.append(cur)
        elif cur is not None and '=' in line:
            key, value = (x.strip() for x in line.split('=', 1))
            cur[key] = value
    return stanzas


def normalise_match(match):
    # '/properties($|/)' -> 'properties'; '/apps/remote/?' -> 'apps/remote'
    return re.sub(r'\(\$\|/\)|\$|/\?$|\?$', '', match).strip('/')


def atlas_paths(index_html):
    text = open(index_html, encoding='utf-8').read()
    start = text.index('const splunkApiAtlas = ') + len('const splunkApiAtlas = ')
    atlas = json.loads(text[start:text.index('\n', start)].rstrip(';'))
    return sorted({p for e in atlas['endpoints'] if e['component'] in ('core', 'ds', 'hec') for p in e.get('paths', [])})


def build(restmap_path, index_html):
    paths = atlas_paths(index_html)
    rules = []
    for st in parse_restmap(restmap_path):
        if 'match' not in st:
            continue
        caps = {k: v for k, v in st.items() if k == 'capability' or k.startswith('capability.')}
        if not caps:
            continue
        base = normalise_match(st['match'])
        if not base or re.search(r'[\\(|*]', base):
            continue
        param_child = re.compile('^' + re.escape(base) + r'(/\{[^}/]+\})+$')
        matched = [p for p in paths if p == base or param_child.match(p)]
        if not matched:
            continue
        by_method = []
        if 'capability' in caps:
            by_method.append({'methods': ['ALL'], 'requires': caps['capability']})
        grouped = {}
        for key, expr in caps.items():
            if key.startswith('capability.'):
                grouped.setdefault(expr, []).append(key.split('.', 1)[1].upper())
        by_method += [{'methods': sorted(m), 'requires': expr} for expr, m in grouped.items()]
        for path in matched:
            rules.append({'path': path, 'handler': st['stanza'], 'rules': by_method})
    rules.sort(key=lambda r: r['path'])
    return rules


def apply(index_html, rules):
    text = open(index_html, encoding='utf-8').read()
    body = MARKER + '[\n' + ',\n'.join('  ' + json.dumps(r) for r in rules) + '\n];'
    if text.count(MARKER) != 1:
        sys.exit(f'Expected exactly one "{MARKER}" in {index_html}.')
    start = text.index(MARKER)
    end = text.index('\n];', start) + 3
    open(index_html, 'w', encoding='utf-8').write(text[:start] + body + text[end:])


if __name__ == '__main__':
    args = sys.argv[1:]
    target = None
    if '--apply' in args:
        i = args.index('--apply')
        target = args[i + 1]
        args = args[:i] + args[i + 2:]
    if len(args) != 1:
        sys.exit(__doc__)
    rules = build(args[0], target or ROOT_INDEX)
    if target:
        apply(target, rules)
        print(f'{len(rules)} path rules written to {target}')
    else:
        print(json.dumps(rules, indent=1))
