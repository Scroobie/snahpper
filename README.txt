Snahpper v1.4.0 — Base64 link opener

Install:
1. Extract the ZIP into a permanent folder.
2. Open chrome://extensions and enable Developer mode.
3. Click Load unpacked and select the Snahpper folder.
4. Open Details > Extension options.
5. Enter allowed domains (one per line) and click Save websites.

On an allowed website, highlight encoded text or right-click a hyperlink and choose Decode & Open Link. Only complete HTTPS destinations open, after up to five Base64 passes.

Leaving the domain list empty disables the context menu on every website. Domains include subdomains. No content scripts, remote decoding, or persistent background process.

Version 1.3: Cute fish icon from the original mockup; default allowlist fora.snahp.eu. Existing custom settings are preserved.

Version 1.4: Serialize context-menu registration to avoid duplicate-ID errors during startup/install.