# CalvyBots Dashboard PWA Handoff

## Files created

- `manifest.json`
- `icons/icon.svg`
- `icons/README.md`
- `sw.js`

## PWA install behavior

The dashboard now exposes a manifest with `standalone` display mode and a registered service worker. Users can install it from supported browsers via the install prompt or Add to Home Screen action, and it will launch as a standalone app without browser UI chrome.  

`sw.js` is configured as a cache-first worker for core shell assets and an offline fallback to `/index.html` for navigation.

## Notes

- For full iOS support, PNG exports are still needed (`icon-192.png` and `icon-512.png`). Use `icons/icon.svg` as the canonical source and generate PNGs with Inkscape or an online converter.
- `sw.js` must be served from the root path; nginx now includes `location = /sw.js` with `Service-Worker-Allowed "/"`.
