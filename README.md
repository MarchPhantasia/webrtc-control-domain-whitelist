# WebRTC Control

A Manifest V3 browser extension for controlling WebRTC leak protection with a domain whitelist.

## Behavior

- Protection is enabled by default.
- Non-whitelisted pages use the configured WebRTC IP handling policy.
- Whitelisted domains use the browser default WebRTC policy and skip page API blockers.
- The toolbar action toggles the active tab domain in the whitelist.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this directory.

## Test

Run:

```text
npm run test
```
