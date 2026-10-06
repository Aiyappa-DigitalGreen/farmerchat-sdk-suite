import { test, expect } from "@playwright/test"

/* End-to-end coverage of the Theme Studio's real user flows, driven against the
 * production build in system Chrome. Screen/view/appearance deep-link params are
 * used where clicking a shadcn overlay would be flaky. */

test.describe("Theme Studio E2E", () => {
  test("loads with its two top-level tabs, Gallery reachable only by route", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Theme Studio")).toBeVisible()
    await expect(page.getByRole("tab", { name: "Studio" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Get SDK" })).toBeVisible()
    // The Gallery TRIGGER was removed from the header; the route is untouched, which the
    // "gallery renders the component sections" test below pins. Asserting the trigger's absence
    // keeps the two facts from drifting apart.
    await expect(page.getByRole("tab", { name: "Gallery" })).toHaveCount(0)
  })

  test("selecting a preset re-themes the exported config", async ({ page }) => {
    await page.goto("/")
    // Default preset is FarmerChat Green.
    await expect(page.locator("pre")).toContainText("#008236")
    // Switch preset → export code updates to Ocean Blue's brand primary.
    await page.getByRole("button", { name: "Ocean Blue" }).click()
    await expect(page.locator("pre")).toContainText("#1565C0")
    await expect(page.locator("pre")).not.toContainText("#008236")
  })

  test("switching export platform regenerates platform-specific code", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("pre")).toContainText("FarmerChat.initialize({") // web/JS
    await page.getByRole("tab", { name: "Android" }).click()
    await expect(page.locator("pre")).toContainText("FarmerChatConfig.builder(FarmerChatEnvironment.PROD)")
    await page.getByRole("tab", { name: "iOS" }).click()
    await expect(page.locator("pre")).toContainText("FarmerChatConfig(")
  })

  test("every platform export states the analytics default", async ({ page }) => {
    // enableAnalytics defaults to FALSE in 2.0.0. If the generated config omits it, a host wires
    // everything up, sees nothing reach their analytics listener, and has nothing in their own
    // code to explain why — so the flag is printed with its default rather than left out.
    //
    // This used to assert the flag was ANDROID-ONLY. That was wrong: it is a real field on all
    // four platforms — iOS `config.enableAnalytics` (FarmerChat.swift:117), and
    // `enableAnalytics?: boolean` in both the web and react-native `core/config.ts`. Emitting it
    // everywhere is parity, not fabrication.
    await page.goto("/")
    await page.getByRole("tab", { name: "Android" }).click()
    await expect(page.locator("pre")).toContainText(".enableAnalytics(false)")
    await page.getByRole("tab", { name: "iOS" }).click()
    await expect(page.locator("pre")).toContainText("enableAnalytics: false")
    await page.getByRole("tab", { name: "Web" }).click()
    await expect(page.locator("pre")).toContainText("enableAnalytics: false")
  })

  test("phone preview navigates between app screens", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("tab", { name: "Chat" }).click()
    // The SERVED label, not the compose fallback: `fc_v2_app_label_related_questions` is
    // "You can also ask" on DEV, and the preview renders what the backend sends.
    await expect(page.getByText("You can also ask")).toBeVisible()
    await expect(page.getByText("How do I control armyworm in maize?")).toBeVisible()
    await page.getByRole("tab", { name: "Settings" }).click()
    // Scoped to `.phone`, not the page: `exact: true` alone used to be enough to keep these off
    // control-panel copy, but the new config panels added an "Appearance" knob whose <label> is
    // an exact match too, so a page-wide locator hits two elements and trips strict mode. These
    // assert phone-preview SECTION labels, so the phone is the right scope.
    const settings = page.locator(".phone")
    await expect(settings.getByText("Appearance", { exact: true })).toBeVisible()
    await expect(settings.getByText("Account details", { exact: true })).toBeVisible()
  })

  test("chat: typing a question appends a user message", async ({ page }) => {
    await page.goto("/?screen=chat")
    // 2.0.0: the composer is always on screen, so there is no "Type" button to
    // open first — that tile row belonged to the legacy (non-agentic) UI.
    const input = page.getByPlaceholder("Ask about your farm…")
    await expect(input).toBeVisible()
    await input.fill("How do I test end to end?")
    await input.press("Enter")
    await expect(page.getByText("How do I test end to end?")).toBeVisible()
  })

  test("chat: the agentic answer footer has no Save, and carries the accuracy note", async ({ page }) => {
    await page.goto("/?screen=chat")
    const phone = page.locator(".phone")
    await expect(phone.getByText("Local conditions may vary.", { exact: false })).toBeVisible()
    await expect(phone.getByRole("button", { name: "Share", exact: true })).toBeVisible()
    await expect(phone.getByRole("button", { name: "Listen", exact: true })).toBeVisible()
    // Save is a LEGACY-only action. The android defect that started this whole
    // audit was an agentic answer rendering the legacy row, so pin its absence.
    //
    // `exact: true` is load-bearing: getByRole's `name` matches a SUBSTRING by
    // default, and the alignment chip "Yes, save maize" contains "save".
    await expect(phone.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
  })

  test("chat: an agentic answer offers numbered alignment chips", async ({ page }) => {
    await page.goto("/?screen=chat")
    const phone = page.locator(".phone")
    await expect(phone.getByText("Do you grow maize on your farm?")).toBeVisible()
    await expect(phone.getByRole("button", { name: /Yes, save maize/ })).toBeVisible()
    await expect(phone.getByRole("button", { name: /Not now/ })).toBeVisible()
  })

  test("chat: asking a question shows the tips carousel for the wait, then settles", async ({ page }) => {
    await page.goto("/?screen=chat")
    const phone = page.locator(".phone")
    await phone.getByPlaceholder("Ask about your farm…").fill("Which fertiliser for tomatoes?")
    await phone.getByPlaceholder("Ask about your farm…").press("Enter")
    // The wait: a shimmering stream status and a tip card.
    await expect(phone.locator(".fc-shimmer")).toBeVisible()
    await expect(phone.getByText("You can ask follow-up questions to get more details")).toBeVisible()
    // ...and both are gone once the answer lands.
    await expect(phone.locator(".fc-shimmer")).toHaveCount(0, { timeout: 15000 })
  })

  test("home: the agentic composer replaces the Photo/Speak/Type row", async ({ page }) => {
    await page.goto("/?screen=home")
    const phone = page.locator(".phone")
    await expect(phone.getByPlaceholder("Ask about your farm…")).toBeVisible()
    // The legacy tiles were labelled exactly Photo / Speak / Type. The composer's
    // own camera and mic use the SDK's real content descriptions ("Camera",
    // "Voice" — InputComposer.kt:512/715), so this cannot pass vacuously.
    await expect(phone.getByRole("button", { name: "Photo", exact: true })).toHaveCount(0)
    await expect(phone.getByRole("button", { name: "Speak", exact: true })).toHaveCount(0)
    await expect(phone.getByRole("button", { name: "Type", exact: true })).toHaveCount(0)
    await expect(phone.getByRole("button", { name: "Camera", exact: true })).toBeVisible()
    await expect(phone.getByRole("button", { name: "Voice", exact: true })).toBeVisible()
    await expect(phone.getByText("What are farmers asking today?")).toBeVisible()
  })

  test("night appearance puts the phone in dark mode", async ({ page }) => {
    await page.goto("/?appearance=night")
    await expect(page.locator(".phone.dark")).toBeVisible()
  })

  test("gallery renders the component sections", async ({ page }) => {
    await page.goto("/?view=gallery")
    await expect(page.getByRole("heading", { name: "Form controls" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Overlays & menus" })).toBeVisible()
  })

  test("Get SDK: is the integration guide, and states versions per platform", async ({ page }) => {
    await page.goto("/?view=sdk")
    // The themed platform cards and their quick-start downloads were removed: the tab now renders
    // ONLY the integration guide, generated from `tools/guide-gen` into `lib/guide.data.json` so
    // the Studio and the shareable artifact cannot drift.
    await expect(page.getByRole("heading", { name: "Integration guide" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Quick-start/ })).toHaveCount(0)
    // Versions are per-platform and derived from SDK_META, never restated in prose.
    await expect(page.getByText("2.0.0", { exact: false }).first()).toBeVisible()
    await expect(page.getByText("1.0.0", { exact: false }).first()).toBeVisible()
  })

  test("dark palette: empty by default, and each platform emits its own shape", async ({ page }) => {
    await page.goto("/")
    // Unset dark colours must stay OUT of the config — the SDK falls back to the light value,
    // so emitting a duplicate would silently freeze dark mode to the light palette.
    await expect(page.locator("pre")).not.toContainText("dark")

    // Set one dark colour. The section is optional, so the swatch starts blank.
    const nightBrand = page.locator('[data-testid="night-brandPrimary"]')
    await nightBrand.fill("#101820")

    // web: `theme.dark` sits BESIDE colors.
    await expect(page.locator("pre")).toContainText("dark: {")
    await expect(page.locator("pre")).toContainText("brandPrimary: '#101820'")

    // android: `.brandPrimaryNight(...)` on the same builder.
    await page.getByRole("tab", { name: "Android" }).click()
    await expect(page.locator("pre")).toContainText(".brandPrimaryNight(0xFF101820.toInt())")

    // iOS: flat `darkBrandPrimary:`.
    await page.getByRole("tab", { name: "iOS" }).click()
    await expect(page.locator("pre")).toContainText("darkBrandPrimary: Color(hex: 0x101820)")
  })

  test("Get SDK: the guide's android install line uses the real Maven group", async ({ page }) => {
    await page.goto("/?view=sdk")
    // groupId is org.digitalgreen.FARMERCHAT. Plain `org.digitalgreen:...` resolves nowhere, so a
    // host copying the install line would get an unresolvable dependency. The install lines now
    // live in the guide's code blocks rather than on a card, so assert inside the guide body.
    const guide = page.locator(".fcg-body")
    await expect(guide.getByText("org.digitalgreen.farmerchat", { exact: false }).first()).toBeVisible()
  })

  test("deep-link params open the requested view", async ({ page }) => {
    await page.goto("/?view=sdk")
    await expect(page.getByRole("heading", { name: "Integration guide" })).toBeVisible()
    await page.goto("/?view=gallery")
    await expect(page.getByRole("heading", { name: "Form controls" })).toBeVisible()
  })
})
