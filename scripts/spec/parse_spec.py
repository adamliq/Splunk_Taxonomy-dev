"""Parse a Splunk .conf.spec file into stanzas -> settings (name, type, bullets, default)."""
import re
import sys
import json

SETTING_RE = re.compile(r'^([^\s#*=\[][^=]*?)\s*=\s*(.*)$')
STANZA_RE = re.compile(r'^\[(.+)\]\s*$')
BANNER_RE = re.compile(r'^#[*#]{19,}\s*$')
SUBHEADING_RE = re.compile(r'^#{5}\s+(\S.*?)\s*$')


def parse(path, banner_sections=False):
    """banner_sections: for specs with no stanza lines (indexes.conf), start a new section at
    each comment-banner heading ("#****" then "# PER INDEX OPTIONS", or "##### S3 specific
    settings"). Sections have name None and a 'section' title; the heading's prose (up to
    the next blank comment line) becomes the section's description."""
    lines = open(path, encoding='utf-8').read().split('\n')
    stanzas = []           # [{name, desc_bullets, settings:[...]}]
    current = {'name': None, 'bullets': [], 'settings': []}   # settings before first stanza = global
    stanzas.append(current)
    target = None          # the bullets list currently being appended to
    in_example = False
    after_banner = False   # banner_sections: the previous line was a banner
    just_headed = False    # banner_sections: the previous line was a heading (banner/HEADING/banner/prose)
    section_prose = None   # banner_sections: collecting a section heading's prose
    for raw in lines:
        line = raw.rstrip()
        if not line:
            after_banner = just_headed = False
            section_prose = None
            continue
        if line.startswith('#'):
            # Comment banners/prose between blocks end the current bullet list.
            target = None
            if banner_sections:
                text = line.lstrip('#').strip()
                if BANNER_RE.match(line):
                    # A banner closing a heading keeps collecting that heading's prose.
                    if just_headed:
                        just_headed = False
                    else:
                        after_banner, section_prose = True, None
                    continue
                just_headed = False
                sub = SUBHEADING_RE.match(line)
                heading, rest = None, ''
                if sub:
                    heading = sub.group(1)
                elif after_banner and text:
                    heading, _, rest = text.partition('. ')
                    heading = heading.rstrip('.')
                after_banner = False
                if heading and heading.upper() == 'OVERVIEW':
                    just_headed, section_prose = True, None
                    continue
                if heading:
                    current = {'name': None, 'section': heading, 'bullets': [], 'settings': []}
                    stanzas.append(current)
                    section_prose = current['bullets']
                    just_headed = True
                    if rest.strip():
                        section_prose.append({'text': rest.strip(), 'level': 0})
                    continue
                if section_prose is not None:
                    if not text or text.startswith('[') or '=' in text:
                        # A blank comment line, or the start of an example config, ends the prose.
                        if section_prose and section_prose[-1]['text'].endswith('For example:'):
                            section_prose[-1]['text'] = section_prose[-1]['text'][:-len('For example:')].rstrip()
                        section_prose = None
                    elif text.startswith('* '):
                        section_prose.append({'text': text[2:].strip(), 'level': 1})
                    elif section_prose and text[:1].islower():
                        prev = section_prose[-1]['text']
                        section_prose[-1]['text'] = prev + text if prev.endswith('-') else prev + ' ' + text
                    else:
                        section_prose.append({'text': text, 'level': 0})
            continue
        after_banner = just_headed = False
        section_prose = None
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
