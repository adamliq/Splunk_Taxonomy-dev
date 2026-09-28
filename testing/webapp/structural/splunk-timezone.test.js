'use strict';
// Reference > Splunk timezone: the page is in the sidebar, reachable by #splunk-timezone,
// registered everywhere a page must be, and keeps the four precedence steps in order.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readIndexHtml } = require('../lib/parse-index');

const text = readIndexHtml();

test('Splunk timezone is a Reference page with its own hash', () => {
  assert.match(text, /<button id="showSplunkTimezonePage" class="page-tab" type="button" role="tab" aria-selected="false" aria-controls="splunkTimezoneSection">Splunk timezone<\/button>/);
  assert.match(text, /<section id="splunkTimezoneSection" class="page-view reference-page" role="tabpanel" aria-labelledby="showSplunkTimezonePage" hidden>/);
  for (const pattern of [
    /refSplunkTimezone: document\.getElementById\("showSplunkTimezonePage"\)/,
    /refSplunkTimezone: document\.getElementById\("splunkTimezoneSection"\)/,
    /refSplunkTimezone: "reference"/,
    /refSplunkTimezone: "Splunk timezone"/,
    /"refSplunkBin", "refSplunkTimezone", "refQuestions"/,
    /selected === "refSplunkTimezone"\n\s+\? "#splunk-timezone"/,
    /location\.hash === "#splunk-timezone"\) return "refSplunkTimezone"/,
    /\{ key: "refSplunkTimezone", label: "Splunk timezone" \}/,
  ]) assert.match(text, pattern);
});

test('the precedence steps are listed highest first', () => {
  const section = text.slice(text.indexOf('<section id="splunkTimezoneSection"'), text.indexOf('<section id="questionsSection"'));
  const titles = [...section.matchAll(/<li class="tz-step">[\s\S]*?<h3>([\s\S]*?)<\/h3>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
  assert.deepEqual(titles, [
    'Time zone specified in the raw event data (if present)',
    'TZ attribute in props.conf',
    'Time zone provided by the forwarder',
    'Time zone of the host that indexes the event',
  ]);
  assert.match(section, /data-xref-conf="props-conf"/);
  assert.match(section, /href="https:\/\/help\.splunk\.com\/en\/\?resourceId=Splunk_Data_Applytimezoneoffsetstotimestamps" target="_blank" rel="noopener noreferrer"/);
});
