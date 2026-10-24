# Golden Ticket Arena shell

GitHub Pages publishes `main` at `https://arena.goldentickettrades.com/`.
The paid app embeds this same origin; full-screen play must stay here too so both use the same save.

## Returning-player compatibility repair

The live game's legacy `_doRestore` persists the recovery code but not the handle. Startup checks the handle
to choose between the lobby and setup. `repairReturningAccount` repairs that client while loading it:

- Remember whether an account code existed before startup generates a new one.
- Recover the handle from the private account response and resume the lobby for returning players.
- Verify recovery-code persistence before switching the active account; report blocked storage.
- Clear the previous handle on a switch so it cannot rename the restored account in the hello message.

The repair requires unique, exact matches for all three legacy anchors and otherwise leaves the game unchanged.
Remove this compatibility repair when the upstream client includes the same behavior. Do not publish a frozen
copy of the game here, persist credentials in URLs, or add parent-domain cookies. Browser storage deletion or
an app using an ephemeral webview still requires recovery; this patch cannot recover a code the browser erased.

## Regression check

Save the public game response from `/gt/shell` to a local fixture outside this repository. With Playwright installed:

```sh
node tests/returning-account.cjs /path/to/game-shell.html
```

Set `CHROME_PATH` if using a system Chrome instead of Playwright Chromium. Tests intercept all networking and
use synthetic accounts. They cover new-player setup, restore, frame reopening, persisted browser-context
restart, full screen, missing-name repair, and blocked writes at phone and desktop widths. They do not prove
persistence of a particular native app's webview; confirm a cold restart on the device after publishing.

## Chart indicators

`indicators-v1.js` upgrades the recognized live chart client when the shell loads it. RSI uses a 14-change
simple-average seed followed by Wilder smoothing, with a neutral 50 for a fully flat window and nulls during
warm-up. A responsive pane separates its title, 30/50/70 guides, curve, optional 14-value SMA, and axis badge.
The curve stays aligned with candle centers. Cursor inspection samples an actual candle; the right-hand empty
space never invents a value. Touch inspection does not modify price scales or drawings. Additional history
stabilizes RSI/EMA seeds. Moving averages have clearer strokes; Bollinger bands have a subtle fill and dashed
center line. Visible-range VWAP is labeled according to its existing calculation; session VWAP is separate.

RSI reference: https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/

```sh
node tests/indicators.cjs /path/to/game-shell.html
node tests/indicator-browser.cjs /path/to/game-shell.html
```

The latter uses the same offline fixture harness and checks four viewport/DPR combinations. Set `SHOT_DIR`
to save preview screenshots. The compatibility module leaves unrecognized future game renderers unchanged;
port these changes upstream before removing the shell adaptation. Bump the script filename when changing a
published version to avoid a cached older module.
