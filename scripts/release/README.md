# Release version

The app header shows a version badge next to "LATCH": `v<YYYY.MM.DD> · build <N>`.

- **Date:** the release date (UTC).
- **Build:** the commit count of the dev-branch commit that set the version, so `git rev-list --count <commit>` on that commit returns the same number.

## Before each merge to `main`

```bash
python3 scripts/release/set_version.py
git add index.html
git commit -m "Set version v<date> · build <N>"
```

Commit straight after running the script, with nothing else in between, so the build number matches the commit. Then merge and copy as usual.
