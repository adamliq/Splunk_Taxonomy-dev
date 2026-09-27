# Spec-generated settings sections

Twenty-two Configuration file reference articles in `index.html` have a settings section generated from Splunk's `.conf.spec` files, not written by hand.

For these four, the generated **Settings** section is the article's only settings listing:

| Article | Spec file | Settings | Stanzas |
|---|---|---|---|
| Server Configuration | `server.conf.spec` | 755 | 87 |
| Search Limits Configuration | `limits.conf.spec` | 645 | 110 |
| REST Endpoints Configuration | `restmap.conf.spec` | 66 | 15 |
| Health Report Configuration | `health.conf.spec` | 35 | 7 |

These twelve are articles whose settings listing is only the generated **Settings** section, alongside a short hand-written Definition and File locations:

| Article | Spec file | Settings | Stanzas |
|---|---|---|---|
| WMI Inputs Configuration | `wmi.conf.spec` | 25 | 2 |
| Transaction Types Configuration | `transactiontypes.conf.spec` | 14 | 1 |
| Field Filters Configuration | `field_filters.conf.spec` | 5 | 1 |
| Workload Pools Configuration | `workload_pools.conf.spec` | 12 | 3 |
| Workload Rules Configuration | `workload_rules.conf.spec` | 25 | 4 |
| Workload Policy Configuration | `workload_policy.conf.spec` | 1 | 1 |
| Splunk Launch Configuration | `splunk-launch.conf.spec` | 14 | 0 (no stanzas) |
| User Seed Configuration | `user-seed.conf.spec` | 3 | 1 |
| Multikv Configuration | `multikv.conf.spec` | 12 | 1 |
| Segmenters Configuration | `segmenters.conf.spec` | 9 | 1 |
| Metric Alerts Configuration | `metric_alerts.conf.spec` | 19 | 1 |
| Metric Rollups Configuration | `metric_rollups.conf.spec` | 8 | 1 |

(`default.meta.spec` is an annotated example rather than a stanza reference, so the Metadata Permissions article is written by hand from it.)

These six keep their hand-written, topic-grouped settings sections (e.g. inputs.conf's "Network inputs", "Windows inputs"), and the generated section, titled **All settings**, sits after them, before Example:

| Article | Spec file | Settings | Stanzas |
|---|---|---|---|
| Data Inputs Configuration | `inputs.conf.spec` | 500 | 35 (plus global settings) |
| Forwarder Outputs Configuration | `outputs.conf.spec` | 260 | 12 |
| Indexes Configuration | `indexes.conf.spec` | 336 | 12 sections (see below) |
| Splunk Web Configuration | `web.conf.spec` | 194 | 7 |
| Saved Searches Configuration | `savedsearches.conf.spec` | 275 | 1 |
| Web Feature Flag Configuration | `web-features.conf.spec` | 75 | 28 |

## Source

Splunk Enterprise 10.4.2 spec files, from the `spec_files/10.4/` folder of Splunk's official VS Code extension repo ([splunk/vscode-extension-splunk](https://github.com/splunk/vscode-extension-splunk)). That repo's own update report says its spec files are downloaded from the [jewnix/splunk-spec-files](https://github.com/jewnix/splunk-spec-files) mirror, which extracts them from Splunk releases (`$SPLUNK_HOME/etc/system/README/*.conf.spec`).

## Regenerating

```bash
git clone --depth 1 https://github.com/splunk/vscode-extension-splunk /tmp/vscode-extension-splunk
S=/tmp/vscode-extension-splunk/spec_files/10.4
for f in server limits restmap health; do
  python3 scripts/spec/gen_spec_html.py $S/$f.conf.spec $f.conf $f-conf 10.4.2 --apply index.html
done
for f in inputs outputs web savedsearches web-features; do
  python3 scripts/spec/gen_spec_html.py $S/$f.conf.spec $f.conf $f-conf 10.4.2 --title "All settings" --apply index.html
done
python3 scripts/spec/gen_spec_html.py $S/indexes.conf.spec indexes.conf indexes-conf 10.4.2 --title "All settings" --banner-sections --apply index.html
for f in wmi transactiontypes field_filters workload_pools workload_rules workload_policy splunk-launch user-seed multikv segmenters metric_alerts metric_rollups; do
  python3 scripts/spec/gen_spec_html.py $S/$f.conf.spec $f.conf $(echo $f | tr '_' '-')-conf 10.4.2 --apply index.html
done
```

Change the folder and version string to move to a newer Splunk release. Only the `<section id="<file>-conf-settings">` block is replaced; each article's Definition, File locations, Example and Validation sections -- and, for the six above, the topic-grouped settings sections -- are hand-written and should be re-checked against the new spec.

## What the generator does

- `parse_spec.py` reads stanza headers, `setting = <type>` lines and their `*` bullet descriptions. Consecutive setting lines with no bullets between them share the description that follows. `NOTE:` prose introduces the settings after it, so it's attached to the stanza.
- `indexes.conf.spec` has no stanza lines: it separates global, per-index, provider, virtual-index and volume options with comment banners (`#****` / `# PER INDEX OPTIONS` / `#****`, and `##### S3 specific settings`). `--banner-sections` groups settings under those headings instead, with each heading's prose as the section description. It's opt-in, so the other files parse exactly as before.
- `gen_spec_html.py` writes one table per stanza (Setting, Description, Default). The first bullet shows and the rest sit behind a "More" toggle, all in the spec's own wording. The Default column is filled only from the spec's `Default:` (or `Default (<condition>):` / `No default.`) lines.
