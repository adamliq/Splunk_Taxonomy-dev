'use strict';
// Shared parsing helpers for testing/webapp -- everything reads index.html
// as text and extracts structured data from it. No external dependencies:
// the whole point is these tests run against the shipped static file, not
// a rebuilt/transpiled copy of it.

const fs = require('fs');
const path = require('path');

const INDEX_HTML_PATH = path.resolve(__dirname, '..', '..', '..', 'index.html');

function readIndexHtml() {
  return fs.readFileSync(INDEX_HTML_PATH, 'utf8');
}

// Extracts a balanced [...] array literal starting at `startIdx` (the index
// of the opening '['), honouring quoted strings so brackets inside string
// values don't throw off the depth count. Returns the raw source text.
function extractBalancedArray(text, startIdx) {
  let depth = 0;
  let inStr = false;
  let strChar = '';
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === strChar) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strChar = c; }
      else if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) return text.slice(startIdx, i + 1);
      }
    }
  }
  throw new Error('extractBalancedArray: unterminated array starting at ' + startIdx);
}

// Parses the app's full taxonomy node list: the initial `const nodes = [...]`
// literal plus every `nodes.push(...[...])` call that appends more nodes.
function parseTaxonomyNodes(text) {
  const declStart = text.indexOf('const nodes = [');
  if (declStart === -1) throw new Error('const nodes = [ not found in index.html');
  const arrStart = declStart + 'const nodes = '.length;
  const nodes = JSON.parse(extractBalancedArray(text, arrStart));

  const pushRe = /nodes\.push\(\.\.\.\[/g;
  let m;
  while ((m = pushRe.exec(text))) {
    const bracketStart = text.indexOf('[', m.index);
    const arr = JSON.parse(extractBalancedArray(text, bracketStart));
    nodes.push(...arr);
  }
  return nodes;
}

// Parses the 59-entry glossary array (`const frameworkConcepts = [...]`).
function parseFrameworkConcepts(text) {
  const declStart = text.indexOf('const frameworkConcepts = [');
  if (declStart === -1) throw new Error('const frameworkConcepts = [ not found');
  const end = text.indexOf('\n];', declStart);
  const block = text.slice(declStart, end);
  const entries = block.match(/\{(?:[^{}]|\{[^{}]*\})*\}/g) || [];
  const getField = (entry, key) => {
    const m = entry.match(new RegExp(key + ':"((?:[^"\\\\]|\\\\.)*)"'));
    return m ? m[1].replace(/\\"/g, '"') : null;
  };
  return entries.map(e => ({
    term: getField(e, 'term'),
    category: getField(e, 'category'),
    definition: getField(e, 'definition'),
    example: getField(e, 'example'),
    detailView: getField(e, 'detailView'),
  }));
}

// Returns every `<article id="..." class="eccs-reference" ...>...</article>`
// block in the document as {id, body} pairs.
function parseReferenceArticles(text) {
  const articleRe = /<article id="([a-zA-Z0-9]+)" class="eccs-reference"[^>]*>([\s\S]*?)<\/article>/g;
  const out = [];
  let m;
  while ((m = articleRe.exec(text))) {
    out.push({ id: m[1], body: m[2] });
  }
  return out;
}

// Extracts every `<nav class="eccs-anchor-nav|eccs-subsection-nav" ...>...</nav>`
// block within a given HTML fragment, each as {cls, links:[{href,text}]}.
function parseNavBlocks(html) {
  const navRe = /<nav class="(eccs-anchor-nav|eccs-subsection-nav)"[^>]*>([\s\S]*?)<\/nav>/g;
  const out = [];
  let m;
  while ((m = navRe.exec(html))) {
    const [cls, body] = [m[1], m[2]];
    const linkRe = /<a href="#([^"]+)">([^<]*)<\/a>/g;
    const links = [];
    let lm;
    while ((lm = linkRe.exec(body))) links.push({ href: '#' + lm[1], text: lm[2] });
    out.push({ cls, links });
  }
  return out;
}

// All static `id="..."` attribute values in the document (deduped).
function allIds(text) {
  const ids = new Set();
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(text))) ids.add(m[1]);
  return ids;
}

module.exports = {
  INDEX_HTML_PATH,
  readIndexHtml,
  extractBalancedArray,
  parseTaxonomyNodes,
  parseFrameworkConcepts,
  parseReferenceArticles,
  parseNavBlocks,
  allIds,
};
