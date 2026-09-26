"""Set the header's release version in index.html: v<YYYY.MM.DD> · build <N>.

Run this immediately before the release commit, and make that commit next (other files can go in it too):

  python3 scripts/release/set_version.py
  git add index.html && git commit -m "Set version ..."

The build number is `git rev-list --count HEAD` + 1, i.e. the commit count of the commit
you are about to make. Anyone can check a released build with
`git rev-list --count <commit>`. The date is today's date in UTC.
"""
import datetime
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
INDEX = os.path.join(ROOT, 'index.html')
BADGE_RE = re.compile(r'(<span class="app-header-version" id="appVersion"[^>]*>)v[0-9.]+ &middot; build \d+(</span>)')


def main():
    count = int(subprocess.check_output(['git', 'rev-list', '--count', 'HEAD'], cwd=ROOT, text=True).strip())
    build = count + 1
    date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y.%m.%d')
    text = open(INDEX, encoding='utf-8').read()
    if len(BADGE_RE.findall(text)) != 1:
        sys.exit('Expected exactly one version badge (#appVersion) in index.html.')
    text = BADGE_RE.sub(lambda m: f'{m.group(1)}v{date} &middot; build {build}{m.group(2)}', text)
    open(INDEX, 'w', encoding='utf-8').write(text)
    print(f'index.html set to v{date} · build {build}. Commit it next so the build number matches that commit.')


if __name__ == '__main__':
    main()
