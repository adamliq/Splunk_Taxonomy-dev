'use strict';
// Regression suite for the anchor-nav bug found and fixed while adding the
// Datetime Format / Username Format reference catalogues: a jump-link with
// no click handler does a native browser anchor-jump that resets the whole
// SPA to the Info tab instead of scrolling within the open reference
// article. Covers every reference article's nav links statically (dangling
// hrefs, cross-article targets, unhandled classes); see browser/reference-
// navigation.spec.js for the live click-through equivalent.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  readIndexHtml,
  parseReferenceArticles,
  parseNavBlocks,
  allIds,
} = require('../lib/parse-index');

const text = readIndexHtml();
const ids = allIds(text);
const articles = parseReferenceArticles(text);

describe('reference article discovery', () => {
  test('finds all reference articles (update this count if one is added/removed)', () => {
    assert.equal(articles.length, 30);
  });
});

describe('anchor-nav links resolve to a real element', () => {
  for (const { id, body } of articles) {
    const navs = parseNavBlocks(body);
    for (const nav of navs) {
      for (const link of nav.links) {
        test(`${id}: ${nav.cls} link "${link.text}" (${link.href}) has a matching id`, () => {
          assert.ok(ids.has(link.href.slice(1)), `no element with id="${link.href.slice(1)}"`);
        });
      }
    }
  }
});

describe('anchor-nav links stay within their own article (regression: cross-article targets)', () => {
  for (const { id, body } of articles) {
    const idsInArticle = new Set((body.match(/\bid="([^"]+)"/g) || []).map(s => s.match(/"([^"]+)"/)[1]));
    const navs = parseNavBlocks(body);
    for (const nav of navs) {
      for (const link of nav.links) {
        test(`${id}: ${nav.cls} link ${link.href} targets an id inside this same article`, () => {
          assert.ok(idsInArticle.has(link.href.slice(1)),
            `${link.href} exists elsewhere in the document but not inside article #${id} -- ` +
            `it would silently fail to scroll if that article is the one currently open`);
        });
      }
    }
  }
});

describe('every nav class used has a click handler wired up (regression: .eccs-subsection-nav)', () => {
  test('the smooth-scroll click-handler selector covers every nav class actually used in Reference articles', () => {
    // Discover every nav class actually present in a reference article...
    const usedClasses = new Set();
    for (const { body } of articles) {
      for (const nav of parseNavBlocks(body)) usedClasses.add(nav.cls);
    }
    assert.ok(usedClasses.size > 0, 'expected to find at least one nav class in use');

    // ...and confirm the listener registration line selects all of them.
    const m = text.match(/document\.querySelectorAll\("([^"]*eccs-anchor-nav[^"]*)"\)\.forEach\(link=>link\.addEventListener\("click"/);
    assert.ok(m, 'could not find the anchor-nav click-handler registration in the script');
    const selector = m[1];
    for (const cls of usedClasses) {
      assert.ok(selector.includes(`.${cls} a`), `click-handler selector "${selector}" does not include ".${cls} a"`);
    }
  });
});

describe('showReferenceDetail routing completeness', () => {
  test('every *ReferenceView article id has a matching key in detailConfig', () => {
    const m = text.match(/const detailConfig=\{([\s\S]*?)\};/);
    assert.ok(m, 'detailConfig object not found');
    const body = m[1];
    const configuredViews = new Set((body.match(/view:"([a-zA-Z]+)"/g) || []).map(s => s.match(/"([^"]+)"/)[1]));
    for (const { id } of articles) {
      assert.ok(configuredViews.has(id), `article #${id} has no entry in showReferenceDetail's detailConfig`);
    }
  });

  test('every *ReferenceView article id has a matching hidden-toggle line in setReferenceDetailVisibility', () => {
    const m = text.match(/function setReferenceDetailVisibility\(detailName\)\{([\s\S]*?)\n\}/);
    assert.ok(m, 'setReferenceDetailVisibility function not found');
    const body = m[1];
    for (const { id } of articles) {
      const varMatch = body.match(new RegExp(`getElementById\\("${id}"\\)`));
      assert.ok(varMatch, `setReferenceDetailVisibility does not call getElementById("${id}")`);
    }
  });
});
