// Run with Playwright available in NODE_PATH. Fixture is the public /gt/shell response saved locally.
// All networking is intercepted; these tests never join a live account or game.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const shell = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const game = fs.readFileSync(process.argv[2], 'utf8');
const APP = 'https://app.goldentickettrades.com';
const ARENA = 'https://arena.goldentickettrades.com';
const CODE = '0DTE-TEST-SAVE-0001';
const OTHER = '0DTE-TEST-SAVE-0002';
async function install(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === APP) return route.fulfill({ contentType: 'text/html', body: `<iframe src="${ARENA}/" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style="width:100%;height:800px"></iframe>` });
    if (url.origin === ARENA && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: shell });
    if (url.origin === ARENA && url.pathname === '/indicators-v1.js') return route.fulfill({ contentType: 'text/javascript', path: path.join(__dirname, '../indicators-v1.js') });
    if (url.origin === 'https://regal-wolf-424.higgsfield.app' && url.pathname === '/gt/shell') return route.fulfill({ contentType: 'text/plain', headers: { 'access-control-allow-origin': ARENA }, body: game });
    return route.abort();
  });
  await context.addInitScript(() => {
    window.WebSocket = class {
      static OPEN = 1;
      constructor() { this.readyState = 0; }
      send() {} close() { this.readyState = 3; } addEventListener() {} removeEventListener() {}
    };
    // UI preferences only: do not seed or replace account/name on reload.
    try { localStorage.setItem('snd', '0'); localStorage.setItem('lite', '1'); localStorage.setItem('0dte-onboarded', '1'); localStorage.setItem('0dte-tour', '1'); } catch {}
  });
}
async function open(context, embedded) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(embedded ? APP + '/app/arena' : ARENA + '/');
  const frame = embedded ? page.frames().find(f => f.url().startsWith(ARENA)) : page.mainFrame();
  await frame.waitForFunction(() => typeof _gtReturningAccount !== 'undefined');
  return { page, frame, errors };
}
async function profile(frame, handle) {
  await frame.evaluate(handle => {
    profile = { handle, coins: 0, cash: 10000, positions: [], owned: {}, stats: {}, theme: 'default' };
    onProfile();
  }, handle);
}
module.exports = { install, open, profile };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const width of [390, 1440]) {
      let context = await browser.newContext({ viewport: { width, height: 900 } });
      await install(context);
      let session = await open(context, true);
      assert.equal(await session.frame.evaluate(() => viewMode), 'boot', 'new players still see setup');
      // Use the real restore dialog and handler from the downloaded live client.
      await session.frame.evaluate(() => promptRestore());
      await session.frame.locator('#restoreInput').fill(CODE);
      await session.frame.locator('#restoreGo').click();
      assert.equal(await session.frame.evaluate(() => myName), '', 'old name not sent to restored account');
      await profile(session.frame, 'Returning Trader');
      assert.equal(await session.frame.evaluate(() => localStorage.getItem('0dte-name')), 'Returning Trader');
      assert.equal(await session.frame.evaluate(() => playerId), CODE);
      // Leaving and re-entering the paid app remounts the frame.
      await session.page.close();
      session = await open(context, true);
      assert.deepEqual(await session.frame.evaluate(() => [playerId, viewMode, myName]), [CODE, 'hub', 'Returning Trader']);
      // Recreate a browser context with persisted storage to model a browser restart.
      const state = await context.storageState();
      await context.close();
      context = await browser.newContext({ viewport: { width, height: 900 }, storageState: state });
      await install(context);
      session = await open(context, true);
      assert.deepEqual(await session.frame.evaluate(() => [playerId, viewMode]), [CODE, 'hub']);
      // Full screen uses the same save as the frame.
      const direct = await open(context, false);
      assert.deepEqual(await direct.frame.evaluate(() => [playerId, viewMode]), [CODE, 'hub']);
      await direct.page.close();
      // Repair accounts restored with the old client, where only the code was saved.
      await session.frame.evaluate(() => localStorage.removeItem('0dte-name'));
      await session.page.reload();
      session.frame = session.page.frames().find(f => f.url().startsWith(ARENA));
      await session.frame.waitForFunction(() => typeof _gtReturningAccount !== 'undefined');
      await profile(session.frame, 'Recovered Name');
      assert.deepEqual(await session.frame.evaluate(() => [viewMode, myName, localStorage.getItem('0dte-name')]), ['hub', 'Recovered Name', 'Recovered Name']);
      // Failed writes cannot silently replace the active identity.
      await session.frame.evaluate(other => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) { if (k === '0dte-acct') throw new DOMException('Blocked', 'SecurityError'); return original.call(this, k, v); };
        _doRestore(other);
      }, OTHER);
      assert.deepEqual(await session.frame.evaluate(() => [playerId, localStorage.getItem('0dte-acct')]), [CODE, CODE]);
      assert.equal(session.errors.length, 0, JSON.stringify(session.errors));
      assert.equal(direct.errors.length, 0, JSON.stringify(direct.errors));
      await context.close();
      console.log(`PASS ${width}px: restore, frame reopen, browser-context restart, fullscreen, legacy missing-name repair, blocked writes`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
