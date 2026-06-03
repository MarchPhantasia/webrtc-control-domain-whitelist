# WebRTC Control Domain Whitelist Design

## Goal

Implement a Manifest V3 browser extension that controls WebRTC leak protection and supports a domain whitelist. Domains on the whitelist are allowed to use WebRTC; other pages receive WebRTC protection.

## Reference

The extension follows the main behavior of `dlinbernard/webrtc-control`: a background service worker manages extension state and Chrome WebRTC privacy settings, while a content script injects page-context scripts at `document_start` to disable WebRTC APIs.

## Whitelist Behavior

- Store whitelist entries in `chrome.storage.local`.
- Normalize entries to lowercase hostnames, stripping protocol, path, port, query, hash, and a leading `www.`.
- Match an entry against the current page hostname exactly or as a subdomain. For example, `example.com` matches `example.com`, `www.example.com`, and `call.example.com`, but not `badexample.com`.
- Ignore unsupported schemes such as `chrome:`, `about:`, and `file:`.

## Extension Behavior

- Default protection is enabled.
- Non-whitelisted pages get WebRTC leak protection:
  - Set `chrome.privacy.network.webRTCIPHandlingPolicy` to `disable_non_proxied_udp`.
  - Inject page-context scripts that block configured WebRTC API surfaces.
- Whitelisted pages are allowed to use WebRTC:
  - Set the active tab policy to `default` when the active tab is whitelisted.
  - Skip page-context WebRTC blocking scripts for matching pages.
- Clicking the toolbar action toggles the current active tab domain in the whitelist.

## User Interface

The options page provides:

- Current protection status.
- A domain input with an Add button.
- A list of whitelisted domains with Remove buttons.
- Existing WebRTC controls for IP handling policy and optional API blocking.

## Components

- `manifest.json`: Manifest V3 extension metadata and permissions.
- `background.js`: storage defaults, whitelist mutation, active-tab policy updates, action toggle, and message handling.
- `content/inject.js`: asks the background page whether the current URL is whitelisted and injects blocking scripts only when protection applies.
- `content/page/*.js`: page-context WebRTC API blockers.
- `options/*`: whitelist and settings UI.
- `src/domain.js`: testable domain normalization and matching helpers.
- `tests/domain.test.js`: Node-based behavior tests for whitelist logic and injection decisions.

## Testing

Use a small Node test command to verify:

- Domain normalization.
- Exact and subdomain whitelist matching.
- Invalid or unsupported URL handling.
- Injection decision for whitelisted versus non-whitelisted pages.

