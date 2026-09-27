"""Generate a conf-file reference article's Settings section from a Splunk .conf.spec file.

Usage:
  python3 scripts/spec/gen_spec_html.py <spec path> <conf file name> <section prefix> <splunk version> [--title TEXT] [--banner-sections [--banner-min N]] [--source TEXT] [--apply index.html]

Example (regenerates the server.conf article's Settings section in place):
  python3 scripts/spec/gen_spec_html.py spec_files/10.4/server.conf.spec server.conf server-conf 10.4.2 --apply index.html

Without --apply the section HTML is printed. With --apply, the existing
<section id="<prefix>-settings"> in the given file is replaced. --title sets the section
heading (default "Settings"; articles that keep hand-written, topic-grouped settings
sections use "All settings"). --banner-sections is for specs with no stanza lines
(indexes.conf): settings are grouped under the spec's comment-banner headings instead; --banner-min
sets the shortest banner line (default 20). --source replaces "Splunk Enterprise <version>" in the
section's source note, for specs that don't come from a Splunk Enterprise release.
"""
import os
import re
import sys
from html import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_spec import parse  # noqa: E402

DEFAULT_RE = re.compile(r'^Defaults?\s*(?:is|:)\s*(.*)$', re.I)
QUALIFIED_DEFAULT_RE = re.compile(r'^Defaults?\s*(\([^)]*\))\s*:\s*(.*)$', re.I)


def section_title(value):
    """A banner-section heading as shown: the spec's ALL-CAPS headings in sentence case."""
    return value.capitalize().replace('hadoop', 'Hadoop') if value.isupper() else value


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


def generate(spec_path, file_name, prefix, version, title='Settings', banner_sections=False, banner_min=20, source=None):
    stanzas = parse(spec_path, banner_sections=banner_sections, banner_min=banner_min)
    total = sum(len(s['settings']) for s in stanzas)
    named = [s for s in stanzas if s['name'] is not None or s.get('section')]
    unit = ('section' if banner_sections else 'stanza') + ('' if len(named) == 1 else 's')
    label = lambda s: section_title(s['section']) if s.get('section') else ('[' + s['name'] + ']' if s['name'] else 'Global')
    used, anchors = set(), []
    for s in stanzas:
        base = f'{prefix}-stanza-{slug(s.get("section") or s["name"] or "global")}'
        anchor, n = base, 2
        while anchor in used:
            anchor, n = f'{base}-{n}', n + 1
        used.add(anchor)
        anchors.append(anchor)

    out = [f'      <section id="{prefix}-settings" class="eccs-detail-section">',
           f'        <h3>{escape(title)}</h3>',
           f'        <p class="spec-source">Every stanza and setting in <code>{escape(file_name)}.spec</code> from {escape(source or ("Splunk Enterprise " + version))}: '
           f'{total} settings {"in" if banner_sections else "across"} {len(named)} {unit}. Descriptions use the spec\'s own wording -- the first line shows here and <em>More</em> '
           'opens the rest. The Default column is filled only where the spec gives a <code>Default:</code> line.</p>',
           f'        <nav class="eccs-subsection-nav spec-stanza-nav" aria-label="{escape(file_name)} {unit}">'
           + ''.join(f'<a href="#{a}">{escape(label(s))}</a>' for s, a in zip(stanzas, anchors))
           + '</nav>']
    for s, anchor in zip(stanzas, anchors):
        heading = (escape(section_title(s['section'])) if s.get('section')
                   else f'<code>[{escape(s["name"])}]</code>' if s['name'] else 'Settings outside any stanza')
        out.append(f'        <h4 id="{anchor}" class="spec-stanza">{heading}</h4>')
        if s['bullets']:
            out.append(f'        <ul class="spec-stanza-desc">{bullets_html(s["bullets"])}</ul>')
        if s['settings']:
            rows = ''.join(setting_row(s['name'], st) for st in s['settings'])
            aria = escape(f'{label(s)} settings' if (s['name'] or s.get('section')) else 'Settings outside any stanza')
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
    title = 'Settings'
    banner_sections = '--banner-sections' in args
    args = [a for a in args if a != '--banner-sections']
    banner_min, source = 20, None
    if '--banner-min' in args:
        i = args.index('--banner-min')
        banner_min = int(args[i + 1])
        args = args[:i] + args[i + 2:]
    if '--source' in args:
        i = args.index('--source')
        source = args[i + 1]
        args = args[:i] + args[i + 2:]
    if '--title' in args:
        i = args.index('--title')
        title = args[i + 1]
        args = args[:i] + args[i + 2:]
    if '--apply' in args:
        i = args.index('--apply')
        target = args[i + 1]
        args = args[:i] + args[i + 2:]
    if len(args) != 4:
        sys.exit(__doc__)
    html, total, count = generate(*args, title=title, banner_sections=banner_sections, banner_min=banner_min, source=source)
    if target:
        apply(target, args[2], html)
        print(f'{args[1]}: {total} settings, {count} {"sections" if banner_sections else "stanzas"}, written to {target}')
    else:
        print(html)
