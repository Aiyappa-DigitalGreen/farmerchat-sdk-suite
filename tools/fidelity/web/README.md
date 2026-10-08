# Web ↔ Android pixel harness

Compares the v2 **web** SDK against the v2 **Android compose** SDK (itself verified against the
app — see `../README.md`) on the same backend, in the same device-pixel frame.

## Setup

```bash
# 1. real stage backend for the browser (its CORS preflight rejects the SDK headers)
FC_GUEST_API_KEY=<the android DEFAULT_GUEST_USER_API_KEY> node versions/v2/web/widget/demo/stage-proxy.mjs   # :8898
# 2. serve the widget folder (fidelity.html loads ../dist/farmerchat-widget.iife.js)
(cd versions/v2/web/widget && npm run build && python3 -m http.server 5182)
# 3. Android: rs_qa (1080x2400 @420dpi = 411x914dp), LastCheckSDKCompose → "Full FarmerChat"
#    (appstage backend, agentic on). ANDROID_SERIAL=emulator-5554 always.
# 4. tooling, in a scratch dir:  npm i puppeteer-core@23.11.1 ; Pillow for sbs.py
```

`demo/fidelity.html` mounts the SDK inline at 411×914 CSS px, padded by Android's status bar
(128px = 48.76dp) and nav bar (63px = 24dp), with `appearance: day` and India pinned
(`defaultCountryCode: IN`), so both sides get the same languages, labels and feed.

## Capture a pair

```bash
./cap.sh 01-language                     # android/01-language.{png,txt} (uiautomator bounds)
node shot.mjs 01-language [--fresh] [--wait ms] [--js "<code>"]   # web/01-language.{png,txt}
python3 pair.py 01-language              # per-text dx/dy in dp, flags > 1.5dp
python3 sbs.py 01-language               # android | web | 50% overlay
```

`--fresh` clears the headless profile (localStorage), i.e. a first install. `click.js` defines
`__clickText(text, selector)`, which waits for in-flight row spinners before clicking.

## Things that produce false diffs

- **Same language on both sides.** Indic scripts render with Noto on Android and with system
  fonts in Chrome; compare in English, spot-check scripts after.
- **Compose trims line height** (`LineHeightStyle` Trim.Both): a text box is
  `natural + (n-1)·lineHeight`. The web stylesheet emulates it; a regression shows up as every
  text element drifting a few dp per line.
- `pair.py` pairs by text prefix; the web dump has one row per text node, so a paragraph with
  inline links splits into several rows. Read the overlay for those.
