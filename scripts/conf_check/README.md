# .conf checker

The Configuration file reference page's **Check a .conf file** view takes a pasted `.conf` file and reports, line by line:

- **Unknown setting / Unknown stanza:** a name the spec doesn't define, with the nearest valid name when one is close (a typo).
- **Wrong case:** setting names are case-sensitive.
- **Wrong stanza:** a real setting placed in a stanza the spec doesn't allow it in, with where the spec does put it.
- **Deprecated / Removed:** the spec says so in the first lines of the setting's description, with the replacement it names.
- **Unknown capability:** an `authorize.conf` grant that isn't a capability in the spec or on the Roles page.
- **Duplicate:** the same setting twice in one stanza.

It runs entirely in the browser. Nothing pasted is stored or sent anywhere.

## Data

`CONF_SPEC_INDEX` in `index.html` is generated from the Splunk Enterprise 10.4 `.conf.spec` files (the same source as the settings tables, [splunk/vscode-extension-splunk](https://github.com/splunk/vscode-extension-splunk) `spec_files/10.4`). It covers the 50 spec files that have an article. It excludes `sourcetypes.conf`, which holds machine-written source type models rather than settings.

`--defaults` also reads Splunk's shipped default `.conf` files (Splunk Enterprise 10.4.2, from the [jewnix/splunk-spec-files](https://github.com/jewnix/splunk-spec-files) mirror). Names those files use that the spec doesn't document are recorded as valid, so Splunk's own configuration doesn't show up as errors. That applies to stanzas, settings and `authorize.conf` capabilities. Checked against those defaults, the only findings left are the 34 settings the spec marks deprecated or removed.

## Regenerating

```bash
git clone --depth 1 https://github.com/splunk/vscode-extension-splunk /tmp/vscode-extension-splunk
git clone --depth 1 https://github.com/jewnix/splunk-spec-files /tmp/splunk-spec-files
python3 scripts/conf_check/build_conf_index.py /tmp/vscode-extension-splunk/spec_files/10.4 \
  --defaults /tmp/splunk-spec-files --apply index.html
```

Re-run it after adding a `.conf` article; only files with an article are included.
