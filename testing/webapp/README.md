# Webapp regression suite

Regression tests for `index.html` -- the LATCH SIEM onboarding & assurance
app. This is a single static HTML file with an embedded `<script>` and no
build step, so the suite tests the shipped file directly rather than a
rebuilt copy of it: `structural/` parses `index.html` as text (fast, no
browser), `browser/` drives it in real headless Chromium via Playwright
(slower, but the only way to prove interactive behaviour actually works).

This suite exists because most of the bugs found and fixed in this app
during development were never going to show up from reading the code --
they only appeared once someone actually clicked through it in a browser:
an entry-count badge silently wrong by 1,180, a taxonomy code pointing at a
node that didn't exist, Quick Actions card text bleeding past its own
border, and a whole class of anchor-nav links that "worked" in the sense
of not throwing, but silently reset the entire app to the Info tab instead
of scrolling to the intended section. Each of those has a permanent test
here now, plus broader checks so the same *class* of bug (not just that
exact instance) gets caught next time.

## Running it

```bash
cd testing/webapp
npm install              # only needed once, for Playwright, its browser and axe-core
./run-all.sh             # structural + browser (a few minutes, mostly the browser suite)
./run-all.sh --structural  # fast path: no browser needed, runs in under a second
./run-all.sh --browser     # just the Playwright suite
```

Playwright needs its browser binaries downloaded once
(`npx playwright install chromium` if `npm install` didn't already fetch
them for your platform). The structural suite has zero dependencies beyond
Node (uses the built-in `node:test` runner, Node 18.17+ / 20+ / 22+) and
never launches a browser, so it's safe to run on every save.

## What's covered

**`structural/taxonomy-integrity.test.js`** -- the 2,522-node taxonomy tree
embedded in `index.html`'s `nodes` array: no duplicate codes, no orphaned
parents, no numbering gaps under any parent, exactly 7 top-level domains,
and -- the specific bug this was built to catch a regression of -- every
taxonomy node's `entryCount` (which drives the Taxonomy Explorer's "N
current" badge) matches the actual number of instance records under its
`CUR::` group. Also checks the `systemApprovalFieldTaxonomy` lookup
resolves to a real node, and that every `TAX-XX`-shaped string anywhere in
the file is either a real node, or one of a short, reviewed list of
intentional historical exceptions (documented inline).

**`structural/reference-nav-integrity.test.js`** -- static proof, across
all 29 reference articles and ~200 anchor-nav links, that every link
resolves to a real element, that element lives inside the *same* article
as the link (a link pointing at a real id in a currently-hidden sibling
article fails silently), and that every nav class actually used in the
markup is covered by the click-handler's selector. That last check is a
direct regression test for the bug found while adding the Datetime Format
and Username Format catalogues: a new `.eccs-subsection-nav` class was
introduced without adding it to the existing `.eccs-anchor-nav a` click
listener, so clicking those links did a native browser anchor-jump that
reset the whole single-page app to the Info tab.

**`structural/content-presence.test.js`** -- pins the exact row/category
counts for content added this session (Datetime Format: 78 formats / 15
categories; Username / Principal Format: 37 formats / 13 categories, plus
its 37-row detector precedence table; Key-value pair styles: 6 style
rows) so a future edit that accidentally truncates a table or drops a
category is caught immediately, plus the 59-term glossary's shape.

**`structural/known-bug-regressions.test.js`** -- one test per narrowly-
scoped fix that doesn't fit the categories above: `.info-action-card` has
`white-space: normal` (Quick Actions text-overflow fix), the hero-only
`.eccs-anchor-nav` styling stays scoped and isn't reused for light-
background sections, and the embedded `<script>` block stays syntactically
valid (`node --check`).

**`browser/reference-navigation.spec.js`** -- the live equivalent of the
nav-integrity structural test: opens all 29 reference articles via the
real `showReferenceDetail()` routing and clicks every single anchor-nav
link in each one, polling until the smooth-scroll settles, and asserts the
target both updated the URL hash and actually ended up on screen. This is
the test that would have caught the `.eccs-subsection-nav` bug outright
(the structural check catches it too, but only because it happens to
check the click-handler selector string; this proves the real behaviour).

**`browser/quick-actions-layout.spec.js`** -- measures every Quick Actions
card's `scrollWidth` against its `offsetWidth` and fails if text overflows
the card, which is what `white-space: nowrap` (the button-default that
caused the original bug) looks like when measured rather than eyeballed.

**`browser/taxonomy-badges.spec.js`** -- searches the live Taxonomy
Explorer and asserts the exact rendered badge text for the specific nodes
involved in the entryCount fix: `TAX-03.01.01.01` shows "1180 current"
(was blank), `TAX-03.01.01` shows "39 current" (was the stale "18"), and
`TAX-04.11` shows no badge at all while its child `TAX-04.11.01` correctly
keeps its own "25 current".

**`browser/console-errors.spec.js`** -- broad smoke test: click through
every primary tab and a sample of Reference entry-point buttons (the real
`<button data-open-reference-detail>` click path, not just calling the
underlying JS function) and assert nothing throws. Shallow on purpose --
it exists to catch the class of mistake none of the narrower tests would.

**`browser/accessibility-pages.spec.js`**,
**`browser/accessibility-articles.spec.js`** and their **`-phone`** twins --
run axe-core's WCAG 2.1 A/AA rules against the sidebar and header (and, at
phone width, the open menu drawer), every page (plus the journey map's
detection route) and all 101 reference articles, at 1400px and at 393px, in
each view's default state. One page load covers every view: other page views
are detached while each is checked (`lib/axe-audit.js`). The four files run
in parallel, about 2-3 minutes each. Any violation fails with the rule and the
first few elements it found.

**`browser/deferred-renders.spec.js`** -- the large tables on pages that start
hidden are built when the page first opens; checks they are absent at load and
complete when opened by navigation or a direct link.

**`browser/journey-tracker.spec.js`** -- the Onboarding flow tracker: add,
save across a reload, map badge and its layer toggle, Advance and Edit from
the inspector, remove, and CSV export/import (quoting, the formula guard, and
skipped rows), and ticking a gate's go / no-go checklist for a tracked item
(progress in the list and inspector, saved, and carried in the CSV).

**`browser/journey-detail-folds.spec.js`** -- the stage and gate detail below
the journey map folds under a heading per phase: closed at load, opened by its
heading, Expand all or the inspector's "Open full stage detail", and shown in
full when printed; plus the phone header (no stepper, nothing wider than the
card).

**`browser/journey-inspector-pinned.spec.js`** -- the desktop inspector stays
pinned beside the map: the selected station and the inspector title are both on
screen, including at the last gate and after "Show on map".

**`browser/info-page.spec.js`** -- the Info page: the release line matches
the header badge, the at-a-glance counts equal the app's own data, every card,
step and tile opens its page (two land on a section), and each grid fills its
rows at 1400, 1100, 900 and 393px without changing Companion tools, which
shares the card classes.

**`browser/taxonomy-explorer.spec.js`** -- Onboard taxonomy: the per-term link
(#taxonomy?code=...) on load and back/forward, a term chosen from elsewhere
scrolled into view in the tree and the table, search counts and highlights
(with an axe check of that state, and typed markup escaped), and the bottom
sheet for the detail at phone width.

**`browser/object-taxonomy.spec.js`** -- Splunk Object Taxonomy: all 14
domains counted and filterable, per-object and per-node links, dependency names
resolved to objects (short forms such as "Universal Forwarder" -> "Universal
Forwarder (UF)"; unknown names unlinked) with a "Used by" list, the
"Not yet recorded" summary, class-count and lifecycle filters across both
views (with axe checks of the filtered tree and the table view), search
highlights and the phone bottom sheet.

**`browser/splunk-bin.spec.js`** -- the Splunk bin CLI reference: shown
open and growing with the page (no inner scroll box, phone cards), Copy buttons
that copy the exact command, no option split across lines, search with count
and highlights (plus an axe check), A-Z and per-command links, global search
clearing the filter, and caution badges only where a command's own examples
say it removes something.

**`browser/lifecycle-phone-layout.spec.js`** -- the Log assessment lifecycle at
phone width: stage cards instead of a scroll box, no domain name split mid-word,
a readable pyramid, and the redraw when crossing the breakpoint.

## Regenerating after a change to index.html

If you add a new reference article, taxonomy node family, or catalogue
section, some of the pinned counts in `content-presence.test.js` and the
`DETAIL_KEYS` list in `reference-navigation.spec.js` will need updating by
hand -- that's intentional; a count that silently adjusts itself to
whatever the file currently contains can't catch the file accidentally
losing content. Run `--structural` first after any edit (it's near-
instant) and only run the full browser suite before committing.
