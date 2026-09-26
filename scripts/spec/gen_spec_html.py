"""Generate a conf-file reference article's Settings section from a Splunk .conf.spec file.

Usage:
  python3 scripts/spec/gen_spec_html.py <spec path> <conf file name> <section prefix> <splunk version> [--apply index.html]

Example (regenerates the server.conf article's Settings section in place):
  python3 scripts/spec/gen_spec_html.py spec_files/10.4/server.conf.spec server.conf server-conf 10.4.2 --apply index.html

Without --apply the section HTML is printed. With --apply, the existing
<section id="<prefix>-settings"> in the given file is replaced.
"""
import os
import re
import sys
from html import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_spec import parse  # noqa: E402

DEFAULT_RE = re.compile(r'^Defaults?\s*(?:is|:)\s*(.*)$', re.I)
QUALIFIED_DEFAULT_RE = re.compile(r'^Defaults?\s*(\([^)]*\))\s*:\s*(.*)$', re.I)


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-') or 'global'


def bullets_html(bullets):
    items = []
    for b in bullets:
        cls = ' class="spec-nested"' if b['level'] else ''
        items.append(f'<li{cls}>{escape(b["text"])}</li>')
    return ''.join(items)


def setting_row(stanza_name, setting):
    body, defaults = [], []
    for b in setting['bullets']:
        text = b['text']
        plain, qualified = DEFAULT_RE.match(text), QUALIFIED_DEFAULT_RE.match(text)
        if b['level'] == 0 and plain:
            defaults.append(plain.group(1).strip())
        elif b['level'] == 0 and qualified:
            defaults.append(f'{qualified.group(2).strip()} {qualified.group(1)}')
        elif b['level'] == 0 and re.match(r'^No default\.?$', text, re.I):
            defaults.append('No default')
        else:
            body.append(b)
    stanza_code = f'<code>[{escape(stanza_name)}]</code> ' if stanza_name else ''
    type_html = f'<code class="spec-type">{escape(setting["type"])}</code>' if setting['type'] else ''
    if body:
        first = f'<span class="spec-first">{escape(body[0]["text"])}</span>'
        more = f'<details class="spec-more"><summary>More</summary><ul>{bullets_html(body[1:])}</ul></details>' if len(body) > 1 else ''
    else:
        first, more = '<span class="spec-first spec-muted">No description in the spec.</span>', ''
    return (f'<tr><td>{stanza_code}<code>{escape(setting["name"])}</code></td>'
            f'<td>{type_html}{first}{more}</td><td>{escape("; ".join(defaults))}</td></tr>')


def generate(spec_path, file_name, prefix, version):
    stanzas = parse(spec_path)
    total = sum(len(s['settings']) for s in stanzas)
    named = [s for s in stanzas if s['name'] is not None]
    used, anchors = set(), []
    for s in stanzas:
        base = f'{prefix}-stanza-{slug(s["name"] or "global")}'
        anchor, n = base, 2
        while anchor in used:
            anchor, n = f'{base}-{n}', n + 1
        used.add(anchor)
        anchors.append(anchor)

    out = [f'      <section id="{prefix}-settings" class="eccs-detail-section">',
           '        <h3>Settings</h3>',
           f'        <p class="spec-source">Every stanza and setting in <code>{escape(file_name)}.spec</code> from Splunk Enterprise {escape(version)}: '
           f'{total} settings across {len(named)} stanzas. Descriptions use the spec\'s own wording -- the first line shows here and <em>More</em> '
           'opens the rest. The Default column is filled only where the spec gives a <code>Default:</code> line.</p>',
           f'        <nav class="eccs-subsection-nav spec-stanza-nav" aria-label="{escape(file_name)} stanzas">'
           + ''.join(f'<a href="#{a}">{escape("[" + s["name"] + "]" if s["name"] else "Global")}</a>' for s, a in zip(stanzas, anchors))
           + '</nav>']
    for s, anchor in zip(stanzas, anchors):
        title = f'<code>[{escape(s["name"])}]</code>' if s['name'] else 'Settings outside any stanza'
        out.append(f'        <h4 id="{anchor}" class="spec-stanza">{title}</h4>')
        if s['bullets']:
            out.append(f'        <ul class="spec-stanza-desc">{bullets_html(s["bullets"])}</ul>')
        if s['settings']:
            rows = ''.join(setting_row(s['name'], st) for st in s['settings'])
            aria = escape(f'[{s["name"]}] settings' if s['name'] else 'Settings outside any stanza')
            out.append(f'        <div class="eccs-table-wrap" role="region" aria-label="{aria}" tabindex="0"><table class="eccs-table spec-table">'
                       f'<thead><tr><th>Setting</th><th>Description</th><th>Default</th></tr></thead><tbody>{rows}</tbody></table></div>')
    out.append('      </section>')
    return '\n'.join(out), total, len(named)


def apply(target, prefix, html):
    text = open(target, encoding='utf-8').read()
    opening = f'      <section id="{prefix}-settings" class="eccs-detail-section">'
    if text.count(opening) != 1:
        sys.exit(f'Expected exactly one {prefix}-settings section in {target}, found {text.count(opening)}.')
    start = text.index(opening)
    end = text.index('</section>', start) + len('</section>')
    open(target, 'w', encoding='utf-8').write(text[:start] + html + text[end:])


if __name__ == '__main__':
    args = sys.argv[1:]
    target = None
    if '--apply' in args:
        i = args.index('--apply')
        target = args[i + 1]
        args = args[:i] + args[i + 2:]
    if len(args) != 4:
        sys.exit(__doc__)
    html, total, count = generate(*args)
    if target:
        apply(target, args[2], html)
        print(f'{args[1]}: {total} settings across {count} stanzas written to {target}')
    else:
        print(html)
