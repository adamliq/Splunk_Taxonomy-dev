# Spec-generated settings sections

The Settings sections of four Configuration file reference articles in `index.html` are generated from Splunk's `.conf.spec` files, not written by hand:

| Article | Spec file | Settings | Stanzas |
|---|---|---|---|
| Server Configuration | `server.conf.spec` | 755 | 87 |
| Search Limits Configuration | `limits.conf.spec` | 645 | 110 |
| REST Endpoints Configuration | `restmap.conf.spec` | 66 | 15 |
| Health Report Configuration | `health.conf.spec` | 35 | 7 |

## Source

Splunk Enterprise 10.4.2 spec files, from the `spec_files/10.4/` folder of Splunk's official VS Code extension repo ([splunk/vscode-extension-splunk](https://github.com/splunk/vscode-extension-splunk)). That repo's own update report says its spec files are downloaded from the [jewnix/splunk-spec-files](https://github.com/jewnix/splunk-spec-files) mirror, which extracts them from Splunk releases (`$SPLUNK_HOME/etc/system/README/*.conf.spec`).

## Regenerating

```bash
git clone --depth 1 https://github.com/splunk/vscode-extension-splunk /tmp/vscode-extension-splunk
S=/tmp/vscode-extension-splunk/spec_files/10.4
for f in server limits restmap health; do
  python3 scripts/spec/gen_spec_html.py $S/$f.conf.spec $f.conf $f-conf 10.4.2 --apply index.html
done
```

Change the folder and version string to move to a newer Splunk release. Only the `<section id="<file>-conf-settings">` block is replaced; each article's Definition, File locations, Example and Validation sections are hand-written and should be re-checked against the new spec.

## What the generator does

- `parse_spec.py` reads stanza headers, `setting = <type>` lines and their `*` bullet descriptions. Consecutive setting lines with no bullets between them share the description that follows. `NOTE:` prose introduces the settings after it, so it's attached to the stanza.
- `gen_spec_html.py` writes one table per stanza (Setting, Description, Default). The first bullet shows and the rest sit behind a "More" toggle, all in the spec's own wording. The Default column is filled only from the spec's `Default:` (or `Default (<condition>):` / `No default.`) lines.
