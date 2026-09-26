"""Parse a Splunk .conf.spec file into stanzas -> settings (name, type, bullets, default)."""
import re
import sys
import json

SETTING_RE = re.compile(r'^([^\s#*=\[][^=]*?)\s*=\s*(.*)$')
STANZA_RE = re.compile(r'^\[(.+)\]\s*$')


def parse(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    stanzas = []           # [{name, desc_bullets, settings:[...]}]
    current = {'name': None, 'bullets': [], 'settings': []}   # settings before first stanza = global
    stanzas.append(current)
    target = None          # the bullets list currently being appended to
    in_example = False
    for raw in lines:
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith('#'):
            # Comment banners/prose between blocks end the current bullet list.
            target = None
            continue
        m = STANZA_RE.match(line)
        if m:
            current = {'name': m.group(1).strip(), 'bullets': [], 'settings': []}
            stanzas.append(current)
            target = current['bullets']
            continue
        if line.startswith('*'):
            if target is not None:
                target.append({'text': line[1:].strip(), 'level': 0})
            continue
        if line[0].isspace():
            stripped = line.strip()
            if target is None:
                continue
            if stripped.startswith('* '):
                target.append({'text': stripped[2:].strip(), 'level': 1})
            elif target:
                target[-1]['text'] += ' ' + stripped
            continue
        m = SETTING_RE.match(line)
        if m:
            # Consecutive setting lines with no bullets between them share the following description.
            prev = current['settings'][-1] if current['settings'] else None
            shared = prev is not None and target is prev['bullets'] and not prev['bullets']
            setting = {'name': m.group(1).strip(), 'type': m.group(2).strip(), 'bullets': prev['bullets'] if shared else []}
            current['settings'].append(setting)
            target = setting['bullets']
            continue
        stripped = line.strip()
        # "NOTE:" prose introduces the settings that follow, so it belongs to the stanza.
        if stripped.startswith('NOTE:'):
            target = current['bullets']
            target.append({'text': stripped, 'level': 0})
            continue
        if target is None:
            continue
        # An unindented lowercase line is a wrapped continuation of the previous bullet;
        # other bare prose (e.g. "REMOVED. This setting has no effect.") is its own line.
        if target and stripped[:1].islower():
            target[-1]['text'] += ' ' + stripped
        else:
            target.append({'text': stripped, 'level': 0})
    return [s for s in stanzas if s['settings'] or s['bullets']]


def default_of(bullets):
    for b in bullets:
        m = re.match(r'^Defaults?\s*(?:is|:)\s*(.*)$', b['text'], re.I)
        if m:
            return m.group(1).strip().rstrip('.')
    return ''


if __name__ == '__main__':
    result = parse(sys.argv[1])
    total = sum(len(s['settings']) for s in result)
    print(json.dumps({'stanzas': len(result), 'settings': total}))
