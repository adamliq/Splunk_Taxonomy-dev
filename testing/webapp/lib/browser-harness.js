'use strict';
// Shared setup for the Playwright-based browser tests: serves the repo root
// over plain HTTP (index.html uses relative-free absolute content, but a
// real HTTP origin avoids file:// quirks) and launches headless Chromium.
//
// Requires the `playwright` package to be resolvable (npm install playwright,
// or available on NODE_PATH) and its browsers already downloaded -- this
// repo's dev environment pre-installs Chromium and sets
// PLAYWRIGHT_BROWSERS_PATH, so a bare `chromium.launch()` resolves it with
// no explicit executablePath.

const http = require('http');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(REPO_ROOT, reqPath === '/' ? '/index.html' : reqPath);
      if (!filePath.startsWith(REPO_ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function withServerAndPage(fn) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    throw new Error(
      'The `playwright` package is not resolvable. Install it (npm install playwright inside ' +
      'testing/webapp, or make sure it is on NODE_PATH) before running the browser test suite. ' +
      'The structural/ tests do not need it and can run on their own.'
    );
  }
  const { chromium } = playwright;

  const port = 34000 + Math.floor(Math.random() * 4000);
  const server = await startServer(port);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await fn({ page, baseUrl: `http://127.0.0.1:${port}`, pageErrors });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

module.exports = { REPO_ROOT, startServer, withServerAndPage };
