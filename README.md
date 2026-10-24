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
