# Pixel-fidelity harness (Android compose)

Proves the SDK's compose flavour renders **identically** to the FarmerChat app, screen by
screen, by putting both on one emulator and diffing what they actually paint.

Source of truth: `/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic` (read-only).

## Why rendered screens and not a source diff

A source diff answers "did we port the commit". It cannot answer "does it look the same",
because the SDK carries **pre-existing** divergences that no commit ever touched — a 6dp
spacer where the app has 8, a `Box` where the app has a `Surface`. Those only show up as
pixels. Every mismatch found on the Language screen was of that kind.

## Setup, once

```bash
# the app: dev flavour points at the same mobile-app-dev backend the SDK sample uses,
# so both resolve the same served labels
cd /Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic
./gradlew :app:assembleDevDebug
adb install -r -g app/build/outputs/apk/dev/debug/app-dev-debug.apk   # org.digitalgreen.farmer.chat

cd <suite>/versions/v2/android
./gradlew :sample-compose:assembleDebug
adb install -r -g sample-compose/build/outputs/apk/debug/sample-compose-debug.apk
```

The two package ids differ, so both stay installed and you alternate with `am start`.

## Capturing a pair

```bash
export ANDROID_SERIAL=emulator-5554
APP=org.digitalgreen.farmer.chat/org.digitalgreen.farmer.chatbot.MainActivity
SDK=org.digitalgreen.farmerchat.sample.compose/.MainActivity

adb shell am force-stop ${APP%%/*}; adb shell am start -n $APP
sleep 20; adb exec-out screencap -p > NN-screen-app.png

adb shell am force-stop ${SDK%%/*}
adb shell am start -n $SDK --es profile agentic; sleep 4   # profile is read AFTER init,
adb shell input tap 539 1286                               # so force-stop + relaunch first
sleep 18; adb exec-out screencap -p > NN-screen-sdk.png

python3 tools/fidelity/banddiff.py NN-screen-app.png NN-screen-sdk.png
```

## Two rules, both learned by producing false diffs

1. **Relaunch both before capturing.** On a fresh install the app resolves its language
   *after* first paint, so its per-script typography is a frame behind — Kannada
   `titleLarge` is 22/32 against Latin's 22/28, and every multi-line text lands elsewhere.
   The first Language pair showed a 10px tagline delta that was pure capture artefact.
2. **Same language on both sides.** A Kannada/English pair cannot be band-diffed. Both auto
   select the backend's first language (Kannada on dev), so the default fresh state is
   already comparable — just let it settle.

## Reading a result

`banddiff` prints one line per band with `dy` (top/bottom) and `dx` (left/right) deltas.
`max deviation 0 px` means the screen matches. Anything else: find the element, then trace
the number to a value in the app source rather than nudging the SDK until it lines up. Every
fix on the Language screen came out of `fc-compose-agentic`'s own layout code.

When `banddiff` reports a **band-count** mismatch, one side is painting something the other
is not — read both PNGs rather than chasing offsets.

## Two tools

| | Use it for | How it reads |
|---|---|---|
| `banddiff.py` | light screens with discrete text lines (Language, Settings, Help) | per-band `dy`/`dx` in px and dp — tells you *which element* moved and by how much |
| `pixdiff.py` | anything with a full-bleed coloured area (Home, Chat, the drawer) | max channel delta + differing row ranges; band detection saturates on these |

`pixdiff` takes `--tolerance` (default 28) because Home's sunbeams animate and never match
frame to frame. A clean screen lands far under it: Home measured a peak delta of 25 with
**zero** pixels flagged, and the drawer panel measured a peak of **0**.

## A third rule: rebuild the app before you trust a number

The reference APK is only a reference at the commit it was built from. Three "0 px" results taken
against a `1b0553d2` build were void the moment the app moved to `919e5b2f`, because two of those
commits moved Home (the bar 64→52dp and the header's 2dp top padding). Rebuild
`:app:assembleDevDebug` and reinstall whenever the app's HEAD changes, then re-measure.

## A fourth rule: confirm which app is in the foreground before you tap

`am start` is not proof. The reference app can silently drop back to onboarding between sessions
(an expired guest token, cleared data), and a notification-permission dialog can sit in front of a
screen that is otherwise correct — in both cases the taps recorded for a screen land somewhere
else and `banddiff` reports a band-count mismatch that looks like drift. Cheap guard:

```bash
adb shell dumpsys activity activities | grep -m1 topResumedActivity
```

Run it after the launch and again after any tap that should have changed screens. A capture whose
band count differs is a navigation failure until proven otherwise — read the PNG before reading
the numbers.

## When the feed will not load, check the emulator's DNS before the SDK

The AVD inherits a resolver at launch (`netsimd --host-dns=…`). If the host has since changed
networks that resolver is gone, every request fails `UnknownHostException`, and Home renders
"Can't load right now" — which looks exactly like an SDK regression. `adb shell ping <api host>`
and a `logcat | grep UnknownHost` settle it in seconds. A reboot does **not** fix it; relaunch the
AVD instead:

```bash
adb emu kill
~/Library/Android/sdk/emulator/emulator -avd rs_qa -dns-server 8.8.8.8,1.1.1.1 \
  -no-snapshot-load -no-boot-anim &
```

## Measuring when the two feeds show different cards

The Home feed is dynamic, so a whole-screen `pixdiff` is meaningless there — the app and the SDK
get different cards. What IS comparable is the geometry: probe the centre column for the location
pill's dark run and for the first row where the card's white surface begins, and compare those
numbers. That is how the 8dp first-card offset was found and confirmed fixed. Compare inter-card
gaps only between the **same pair of card types** on both sides.

## Status — android compose vs the app

| Screen | Tool | Result |
|---|---|---|
| Language (onboarding) | banddiff | ✅ **0 px** across all 13 bands |
| Home (agentic), at rest | geometry probe | ✅ pill y 508..612 and first card top y=655 — identical |
| Home, scrolled | visual + banded diff | ✅ header fixed, same dissolve, same fade edge |
| Home, after Chat → back | geometry probe | ✅ unchanged — `rememberSaveable` verified |
| Multi-select options | region diff | ✅ scroll is internal; header + card above 0 px changed |
| Drawer | pixdiff, panel region | ✅ 188 px in two corner slivers, peak 54 — see note |
| Help | banddiff | ✅ **2 px** across 12 bands (the version string's own width) — re-measured after the `caption` switch |
| Settings | banddiff | ✅ **1 px** across 11 bands — re-measured after the `caption` switch |
| LanguageChooser | banddiff | ✅ **0 px** across all 6 bands |
| SettingsName | banddiff, above the keyboard | ✅ **0 px** across 4 bands |
| LegalContent | banddiff | ✅ **0 px** across 25 bands (a WebView — matched untouched) |
| Chat | visual, structural | ◐ answer-card **structure** confirmed against the app; chrome not band-diffed (different feeds ⇒ different questions) |

## Status — android VIEWS vs the app (started 2026-09-21)

Views had **zero** pixel coverage before this; the harness above is compose-only. Run views on the
**`agentic`** profile — its bugs differ per profile, and the sample defaults to `dev`.

| Screen | Tool | Result |
|---|---|---|
| Drawer | pixdiff, panel region + named pixels | ✅ panel/footer/CTA match exactly; **5.59%** residual is a 1px wordmark shift + glyph rasterisation |
| Help | banddiff | ✅ max \|dy\| **33px**, footer -4px (was 146px accumulated) |
| Settings | banddiff | ✅ account rows match x-extents exactly; max \|dy\| **18px** (was 71px + wrong structure) |
| LanguageChooser | banddiff | ✅ max \|dy\| **3px**; save button matches the app exactly |
| Language (onboarding) | banddiff | ✅ logo **exact**, rows within 1px (x) / 5px (y); footer legal wraps long |
| Home (agentic header) | geometry probe | ◐ logo + one-line title ported; **location pill still absent** (accounts for the 74px first-card offset) |
| EnterName, Chat | visual only | ◐ render correctly; not band-diffed |
| SettingsName | banddiff, above the keyboard | ✅ max \|dy\| **8px**; label, field and button x-extents all exact |
| Auth (phone step) | banddiff | ◐ app bar + hint + icons fixed; body still ~31px high |
| LegalContent | banddiff | ✅ **0 px** across all 25 bands |
| Error, ChatHistory, Account* | — | **blocked** — Error needs the routing decision (app offline → Error, SDK → AccountBenefits); the rest need a real OTP |

**Read `banddiff`'s max deviation with care on views.** It is the max of |dy| AND |dx|, and the
two sides legitimately render different STRINGS in places (the chooser's "English" vs
"English (India)"; different ellipsis points on Help). A 141px "deviation" there is a content
difference, not a layout error. Split them:

```python
pat = re.compile(r'dy\s*([+-]?\d+)/\s*([+-]?\d+)\s*dx\s*([+-]?\d+)/\s*([+-]?\d+)')
```

and report max |dy| as the layout number.

Nine defects in the first three screens. Two recur and are worth checking first on any views
screen not yet compared:

1. **The palette member names collide.** `surfaceSecondary` is `#FFFFFF` in the neutral palette and
   `#08361B` in the brand one. Any views surface painted with a `fc_brand_*` background needs
   `fc_brand_foreground_*` text and `fc_bg_primary_button_on_brand` for a PrimaryButton — the
   defaults are built for the light reading surface and vanish on brand green.
2. **Rows are a fixed height, not padding.** Compose uses `height(48.dp)` (`Lists.kt:88`);
   views used `wrap_content` + 16dp. Each row runs ~8dp tall and the error ACCUMULATES — it was
   146px by the bottom of Help.
3. **`includeFontPadding` is the systemic vertical drift.** Compose 1.6+ defaults it to FALSE; a
   TextView defaults it to TRUE and adds ~3dp of leading per line. Now set once in the theme
   (`themes.xml` → `FcTextView`). Halved Settings' drift and took LanguageChooser to 3px. If you
   add a TextView that bypasses the theme style, set it explicitly.
4. **A translucent token may be applied TWICE in compose.** `RadioButton` puts `surfaceActive` on
   both the `Surface` and the inner Row (`Form.kt:271,277`), so the rendered colour is the double
   composite (`#A6E1C0`), not the single one (`#C6E6D5`). A views `<shape>` can only state the
   result. Measure the app AND compose at the same pixel before porting any alpha-based token.
| Auth (phone entry) | banddiff | ✅ **0 px** across all 19 bands — the **OtpEntry** step shares this container but needs a real OTP, so it is unmeasured |

The drawer measured a peak of **0** last session and now measures 188 px, confined to two ~13px
slivers at the rounded corners of the sign-up pill. Nothing in the drawer changed on either side;
what changed is that the app is now built on Compose BOM 2026.09.00 (it was 2026.08.00) while the
SDK pins 2026.05.00. Treat sub-100-px corner-only deltas as toolchain antialiasing, not drift —
but check that the differing pixels really are only at corners before filing it that way.

Not yet compared: EnterName, Chat (answer, tips, follow-ups, markdown tables), ChatHistory,
AccountBenefits, AccountSuccess, Error, LocationPrompt — see "Not reachable as a pair" below.

### Not reachable as a pair (on this backend / this guest)

* **ChatHistory** — the drawer has no Recent Chats row for an unauthenticated guest on either
  side, so the screen cannot be opened without a real OTP.
* **AccountSuccess** — needs a completed OTP verification.
* **EnterName** — the app skips it for this guest (`is_user_name_added = true`, and
  `PrefOnboardingStore.KEY_NAME_DONE` aliases `is_location_screen_done`); already recorded below.
* **AccountBenefits / Error** — these two turn out to be a ROUTING divergence rather than a
  layout one, and the pair cannot be captured on the same screen at all. Online, the app's
  drawer Sign-up goes straight to **Auth** (the backend returns `bypass_interstitial`), skipping
  AccountBenefits. Offline, the app checks `NetworkUtils.isOnline()` at the drawer and routes to
  its full-screen **Error** ("FarmerChat needs the internet"), while the SDK shows
  **AccountBenefits** and only checks the network on the NEXT tap. So: app offline → Error,
  SDK offline → AccountBenefits. Needs a routing decision before either screen can be paired.
* **Views chat** — previously "never seen rendering an answer" across three attempts. **That is
  retracted**: on 2026-09-21 it rendered a full Kannada answer, CTA, action row and follow-up chip.
  The earlier failure was the emulator's DNS outage, not a views defect.
* **Chat** — non-deterministic by nature, and the two feeds serve different cards so the two
  sides can never be asked the same question without typing Kannada through `adb` (which
  `input text` cannot do). **Partially resolved anyway:** both sides were driven to an answer and
  the backend *did* return a card-shaped table on each, which confirms `MarkdownAnswerCard`
  renders the app's structure — a title bar, then label / bold value / grey description triples
  separated by dividers, stacked in a Column rather than the old 0.4/0.6 Row. Chrome geometry
  (app bar, composer) was never band-diffed; what the attempt actually produced was the
  label-resolution bug below.

### What Help, Settings and LanguageChooser cost

All three were off by the same root cause — **the SDK used a flat 16dp content padding where the
app uses 20dp sides / 32dp ends, and grouped nothing into sections**. The app's pattern is
consistent across all three: an outer Column at `spacedBy(24-28.dp)` between SECTIONS, and each
section a Column at `spacedBy(10.dp)` holding its own title + card. Flattening that put every
title 16dp high and every title-to-card gap 6-18dp wrong. Worth checking first on any screen not
yet compared.

On top of that, per screen:

* **Help** (576 px → 2 px) — `ListItem` had `weight(1f)` on the LABEL instead of the value, so the
  chevron was pushed to the far edge where the app tucks it after the text, and a long value was
  squeezed instead of the label; the chevron glyph was `KeyboardArrowRight`, not `ChevronRight`;
  Terms/Privacy read the #legal payload's own English `title` instead of the served label, so both
  rows rendered in English on a Kannada device; the version line used a served label (Kannada
  script) where the app hardcodes a Latin literal.
* **Settings** (325 px → 1 px) — the appearance tile marked selection by filling with
  `surfaceActive` and tinting its icon green, where the app keeps one surface and adds a 2dp
  `borderActive` ring; tile radius MD not LG, icon 26dp not 18dp, fixed 76dp height instead of
  content height; the hint used `bodySmall` (15/22) where the app's `caption` is 13/18, which
  wrapped it onto a second line; the name row passed `null` instead of the app's `"—"` placeholder.
* **LanguageChooser** (97 px → 0 px) — the "All languages" chip was a `surfaceSecondary` Box with
  dark text where the app uses a FILLED `buttonPrimarySurface` Surface with light text (inverted);
  the footer had no `surfaceSecondary` background; the save button was `Default` not `Chevron`.

`caption` (13sp/18sp @400) maps to no Material3 slot — `labelSmall` is the right metrics at
weight 600, `bodySmall` is 15/22 — but the SDK **already has the token**: `theme/Type.kt`'s
`val caption`, ported from the app and left with zero readers until this pass wired it up. Use it;
do not hand-roll `labelSmall.copy(...)` and do not retune `labelSmall` (16 readers).

Worth generalising: when a value looks missing from the theme, grep the theme for it before
adding a workaround. A faithful port can leave a correct token sitting unused.

### One non-pixel divergence found

After Language, the **app goes straight to Home** while the **SDK shows EnterName**. Not a
layout difference — a routing one. The app treats the profile as done when its
`is_location_screen_done` pref is set (`PrefOnboardingStore.KEY_NAME_DONE` is literally that
string), and the backend had already returned a profile name (`user_name = "N/A"`,
`is_user_name_added = true`) for this guest. The SDK gates on its own name-seen flag and
shows the screen anyway. Recorded, not yet changed — it needs a decision about whether the
SDK should adopt the app's pref aliasing or keep its own rule.

Fixes it took, all in `versions/v2/android/.../screens/LanguageScreen.kt`:
bottom-bar radius XL→XXL; padding 20/20/16/12→24/24/28/16; `spacedBy` 12→20; legal link
colour `foregroundPrimary`→`foregroundSecondary`; legal weight 600→400 (locally, not on the
`labelSmall` token — it has 16 readers here against the app's 4 `caption` sites);
title→subtitle spacer 6→8; and the "All languages" chip moved out of the list column and
rebuilt as a Material3 `Surface(onClick=)`, whose `minimumInteractiveComponentSize()` is
what put the app's chip 5px lower than a bare `Box`.

## What a pixel pass catches that a diff cannot: wrong label KEYS

The Chat attempt never produced a chrome measurement, but it did surface a bug no source diff
would: the SDK's Chat composer rendered its placeholder in **English** on a Kannada device while
the app rendered Kannada — and the SDK's own Home composer was correct. Cause: `InputComposer`
defaulted `placeholder` to a raw literal, and only `HomeScreen` passed the label explicitly.

Pulling that thread found that **iOS and web pass ~198 label keys the backend has never served**,
so both render English in every language. Details and counts in docs/04 "Label-key resolution
audit". The generalisable part:

* Every served key is `fc_v2_*`-prefixed (287 on DEV). Anything shorter cannot resolve.
* Test keys against the dump, never against the source catalogue — a key can be in `Labels.kt`
  and still not be served, and a key can be passed by the UI and be in no catalogue at all.
* **Run at least one fidelity pass in a non-English language.** An English fallback is
  indistinguishable from a correct render, which is exactly how this survived.

## Contrast is measurable — check it, don't eyeball it

The Home greeting shipped as white-on-light-grey and read as "a blank band" at a glance. Sampling
the two most common colours inside the band and computing the WCAG ratio turned that into
**1.18:1 vs the 3.0:1 AA needs** — a number, in a commit message, that nobody can argue with, and
which made the fix verifiable (it is now 4.95:1).

```python
def lum(c):
    f = lambda v: (v/255)/12.92 if v/255 <= 0.03928 else (((v/255)+0.055)/1.055)**2.4
    r, g, b = [f(x) for x in c]; return 0.2126*r + 0.7152*g + 0.0722*b
ratio = (max(lum(fg), lum(bg)) + 0.05) / (min(lum(fg), lum(bg)) + 0.05)
```

Worth running on any band where a foreground token meets a surface it was not designed for.

## The sample profile is not applied on the first launch

`pm clear` then one `am start --es profile agentic` leaves you on **dev**: the sample reads the
extra *after* `Application.onCreate`. Force-stop, relaunch, then confirm before trusting the UI:

```bash
adb shell run-as org.digitalgreen.farmerchat.sample.compose cat shared_prefs/fc_sample.xml
```

A whole pass was run against the legacy Home this way. It happened to be productive — both Home
bugs live in that branch — but it was luck, not design.

## Sampling named pixels beats a whole-screen diff on dark UI

`pixdiff` MISSED the drawer's missing selected-row state: the row was `(8,54,27)` against the
app's `(3,46,21)`, a per-channel delta of 5/8/6 — under the default tolerance of 28. The drawer
read as "nothing is selected" to the eye while the tool reported no difference in that band.

On dark-on-dark UI, a low pixdiff is **necessary, not sufficient**. Pick the pixels that carry
the semantics (panel, card, CTA fill, selected row) and compare them by value.

## A token's nominal value is not always the right port

`labelMedium` is weight 600, so `textFontWeight=600` on the views drawer rows looked correct —
and rendered visibly LIGHTER than the app (ink to x=496 vs the app's x=513). Compose synthesises
600 against the system family and lands heavier than a `TextView` does at the same nominal weight.
`bold` matches. Port the **measurement**, and say in the comment that it contradicts the token.

## An inset that is NOT the compose number

Compose's onboarding Language list pads `top = topInset + 32.dp`. Copying 32dp into views
overshot by **63px**. Views' container is `fitsSystemWindows="true"`, so the parent has already
consumed the status-bar inset compose adds by hand. The measured delta was **8dp**.

Generalises: any compose padding written as `someInset + N.dp` cannot be ported as `N.dp` into a
views layout that consumes insets itself. Measure the delta; do not copy the constant.

## `valdiff.py` — for screens you cannot capture

A ToS bottom sheet needs a version bump, a permission dialog needs two denials, ChatHistory needs
an OTP, Splash lives ~200ms. Pixels are unavailable; the app source is not.

```bash
python3 tools/fidelity/valdiff.py <app-file> <sdk-file> <ComposableName>
```

It extracts the ordered design constants a composable uses (`dp`/`sp`, `colors.*`, typography
slots, `Radius.*`, weights) from both bodies and diffs the multisets. It found the Splash logo at
72dp against the app's 100dp, and the ChatHistory list at a flat 16dp against the app's 20/8.

**It is a screening tool.** It ignores WHERE a value is used, so read every hit in context before
calling it a defect. Two traps it taught:

* A delta shaped `app x0 / sdk x1` is usually **additive** — the SDK naming a token the app leaves
  to a component default. Not a defect.
* The tool once reported "0 distinct app values" for three screens. That was a bug in the tool, not
  a finding: it grabbed a **default-argument lambda** (`onOpenUrl: (…) -> Unit = { _, _ -> }`) as
  the function body. Fixed, but the lesson stands — an implausible result is the tool's fault until
  proven otherwise.

**Where a screen has BOTH a rendered measurement and a source delta, the measurement wins.**
Help/Settings/LanguageChooser each measure 0-2px on device and still show source deltas; those are
implementation differences with identical output.

## The guards, and the trap in writing them

`ViewsAppParityTest` (13) and `ComposeAppParityTest` (8) pin the values this harness measured.
They assert CAUSES — resource and source values — because a golden-image suite cannot run in CI
(it needs the reference APK, an AVD, network and a matching served-label set).

**The trap:** a test that reads files off the filesystem is not re-run by Gradle when those files
change, because they are not declared task inputs. The first version of these suites passed while
three of four deliberate mutations went undetected. Both modules now declare their input dirs.

Every guard is mutation-verified — proven to fail when its invariant is broken, not merely to pass.
If you add one, break it on purpose first.
