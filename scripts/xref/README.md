# Cross-links

The Roles, Splunk API and Configuration file reference pages link to each other. Every link has a source:

- **Capability ↔ REST endpoint:** `RESTMAP_CAPABILITY_RULES` in `index.html`, generated from Splunk's default `restmap.conf` (Splunk Enterprise 10.4.2, from the [jewnix/splunk-spec-files](https://github.com/jewnix/splunk-spec-files) mirror), plus endpoints a capability's own description names.
- **Capability or endpoint → `.conf` article:** a `.conf` file named in the description, or a `configs/conf-<file>` path. Only files with an article are linked.

`restmap.conf` declares a capability for only some handlers -- most admin endpoints check theirs inside splunkd -- so the endpoint links are partial. A handler is linked only where its `match` path equals a Splunk API page path (or that path plus `{parameter}` segments); prefix matches are skipped.

## Regenerating

```bash
git clone --depth 1 https://github.com/jewnix/splunk-spec-files /tmp/splunk-spec-files
python3 scripts/xref/restmap_capabilities.py /tmp/splunk-spec-files/restmap.conf --apply index.html
```

Re-run it after changing the Splunk API atlas, since matches depend on its paths.
