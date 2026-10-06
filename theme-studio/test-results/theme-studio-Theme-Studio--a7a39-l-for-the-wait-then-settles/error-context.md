# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: theme-studio.spec.ts >> Theme Studio E2E >> chat: asking a question shows the tips carousel for the wait, then settles
- Location: e2e/theme-studio.spec.ts:106:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.phone').locator('.fc-shimmer')
Expected: 0
Received: 1
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" with timeout 15000ms
  - waiting for locator('.phone').locator('.fc-shimmer')
    7 × locator resolved to 1 element
      - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e7]: FarmerChat Theme Studio
        - tablist [ref=e9]:
          - tab "Studio" [selected] [ref=e10]
          - tab "Get SDK" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Preview
          - combobox [ref=e15]:
            - generic: Light
        - button "Toggle studio theme" [ref=e16]
        - button "Reset" [ref=e17]
    - main [ref=e18]:
      - complementary [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]:
            - generic [ref=e22]: Preset theme
            - generic [ref=e24]:
              - button "FarmerChat Green" [ref=e25]
              - button "Ocean Blue" [ref=e27]
              - button "Sunset Amber" [ref=e29]
              - button "Royal Purple" [ref=e31]
              - button "Teal Midnight" [ref=e33]
              - button "Crimson Red" [ref=e35]
              - button "Indigo" [ref=e37]
              - button "Rose Pink" [ref=e39]
              - button "Slate Gray" [ref=e41]
              - button "Cyan Sky" [ref=e43]
              - button "Golden" [ref=e45]
              - button "Chocolate" [ref=e47]
              - button "Coral" [ref=e49]
              - button "Midnight Navy" [ref=e51]
              - button "Forest" [ref=e53]
          - generic [ref=e55]:
            - generic [ref=e56]: Brand colors
            - generic [ref=e58]:
              - generic [ref=e59]:
                - generic [ref=e60]: Brand primary
                - generic [ref=e62]:
                  - textbox "Brand primary" [ref=e63] [cursor=pointer]: "#008236"
                  - textbox "#RRGGBB" [ref=e64]: "#008236"
              - generic [ref=e65]:
                - generic [ref=e66]: Brand primary dark
                - generic [ref=e68]:
                  - textbox "Brand primary dark" [ref=e69] [cursor=pointer]: "#08361b"
                  - textbox "#RRGGBB" [ref=e70]: "#08361B"
              - generic [ref=e71]:
                - generic [ref=e72]: Brand accent
                - generic [ref=e74]:
                  - textbox "Brand accent" [ref=e75] [cursor=pointer]: "#00c950"
                  - textbox "#RRGGBB" [ref=e76]: "#00C950"
              - generic [ref=e77]:
                - generic [ref=e78]: On-brand (text/icon)
                - generic [ref=e80]:
                  - textbox "On-brand (text/icon)" [ref=e81] [cursor=pointer]: "#ffffff"
                  - textbox "#RRGGBB" [ref=e82]: "#FFFFFF"
              - generic [ref=e83]:
                - generic [ref=e84]: Background
                - generic [ref=e86]:
                  - textbox "Background" [ref=e87] [cursor=pointer]: "#ffffff"
                  - textbox "#RRGGBB" [ref=e88]: "#FFFFFF"
              - generic [ref=e89]:
                - generic [ref=e90]: Reading surface
                - generic [ref=e92]:
                  - textbox "Reading surface" [ref=e93] [cursor=pointer]: "#f7f5ef"
                  - textbox "#RRGGBB" [ref=e94]: "#F7F5EF"
              - generic [ref=e95]:
                - generic [ref=e96]: Card surface
                - generic [ref=e98]:
                  - textbox "Card surface" [ref=e99] [cursor=pointer]: "#ffffff"
                  - textbox "#RRGGBB" [ref=e100]: "#FFFFFF"
              - generic [ref=e101]:
                - generic [ref=e102]: On background (text)
                - generic [ref=e104]:
                  - textbox "On background (text)" [ref=e105] [cursor=pointer]: "#1c2b26"
                  - textbox "#RRGGBB" [ref=e106]: "#1C2B26"
              - generic [ref=e107]:
                - generic [ref=e108]: On surface (text)
                - generic [ref=e110]:
                  - textbox "On surface (text)" [ref=e111] [cursor=pointer]: "#1c2b26"
                  - textbox "#RRGGBB" [ref=e112]: "#1C2B26"
              - generic [ref=e113]:
                - generic [ref=e114]: Error
                - generic [ref=e116]:
                  - textbox "Error" [ref=e117] [cursor=pointer]: "#c94f3d"
                  - textbox "#RRGGBB" [ref=e118]: "#C94F3D"
          - generic [ref=e119]:
            - generic [ref=e120]:
              - generic [ref=e121]: Dark mode colors
              - paragraph [ref=e122]: Optional. Leave a swatch empty and the SDK reuses the light colour for dark mode. Switch the phone preview to night to see these.
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]:
                  - generic [ref=e126]: Brand primary
                  - generic [ref=e127]: empty = inherit
                - generic [ref=e128]:
                  - textbox "Brand primary" [ref=e129] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e130]
              - generic [ref=e131]:
                - generic [ref=e132]:
                  - generic [ref=e133]: Brand primary dark
                  - generic [ref=e134]: empty = inherit
                - generic [ref=e135]:
                  - textbox "Brand primary dark" [ref=e136] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e137]
              - generic [ref=e138]:
                - generic [ref=e139]:
                  - generic [ref=e140]: Brand accent
                  - generic [ref=e141]: empty = inherit
                - generic [ref=e142]:
                  - textbox "Brand accent" [ref=e143] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e144]
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e147]: On-brand (text/icon)
                  - generic [ref=e148]: empty = inherit
                - generic [ref=e149]:
                  - textbox "On-brand (text/icon)" [ref=e150] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e151]
              - generic [ref=e152]:
                - generic [ref=e153]:
                  - generic [ref=e154]: Background
                  - generic [ref=e155]: empty = inherit
                - generic [ref=e156]:
                  - textbox "Background" [ref=e157] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e158]
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - generic [ref=e161]: Reading surface
                  - generic [ref=e162]: empty = inherit
                - generic [ref=e163]:
                  - textbox "Reading surface" [ref=e164] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e165]
              - generic [ref=e166]:
                - generic [ref=e167]:
                  - generic [ref=e168]: Card surface
                  - generic [ref=e169]: empty = inherit
                - generic [ref=e170]:
                  - textbox "Card surface" [ref=e171] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e172]
              - generic [ref=e173]:
                - generic [ref=e174]:
                  - generic [ref=e175]: On background (text)
                  - generic [ref=e176]: empty = inherit
                - generic [ref=e177]:
                  - textbox "On background (text)" [ref=e178] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e179]
              - generic [ref=e180]:
                - generic [ref=e181]:
                  - generic [ref=e182]: On surface (text)
                  - generic [ref=e183]: empty = inherit
                - generic [ref=e184]:
                  - textbox "On surface (text)" [ref=e185] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e186]
              - generic [ref=e187]:
                - generic [ref=e188]:
                  - generic [ref=e189]: Error
                  - generic [ref=e190]: empty = inherit
                - generic [ref=e191]:
                  - textbox "Error" [ref=e192] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e193]
          - generic [ref=e194]:
            - generic [ref=e195]: Shape (radius)
            - generic [ref=e197]:
              - generic [ref=e198]:
                - generic [ref=e199]:
                  - generic [ref=e200]: Card radius
                  - generic [ref=e201]: 24px
                - slider [ref=e206]
              - generic [ref=e207]:
                - generic [ref=e208]:
                  - generic [ref=e209]: Button radius
                  - generic [ref=e210]: 999px
                - slider [ref=e215]
              - generic [ref=e216]:
                - generic [ref=e217]:
                  - generic [ref=e218]: Input radius
                  - generic [ref=e219]: 12px
                - slider [ref=e224]
          - generic [ref=e225]:
            - generic [ref=e226]: Typography
            - generic [ref=e228]:
              - generic [ref=e229]:
                - generic [ref=e230]:
                  - generic [ref=e231]: Type scale
                  - generic [ref=e232]: 1×
                - slider [ref=e237]
              - generic [ref=e238]:
                - generic [ref=e239]: Font family
                - textbox "e.g. Inter" [ref=e240]
          - generic [ref=e241]:
            - generic [ref=e242]: Floating button (FAB)
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]: FAB label
                - textbox "empty = round" [ref=e247]
              - generic [ref=e248]:
                - generic [ref=e249]:
                  - generic [ref=e250]: FAB background
                  - generic [ref=e251]: empty = inherit
                - generic [ref=e252]:
                  - textbox "FAB background" [ref=e253] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e254]
              - generic [ref=e255]:
                - generic [ref=e256]:
                  - generic [ref=e257]: FAB content
                  - generic [ref=e258]: empty = inherit
                - generic [ref=e259]:
                  - textbox "FAB content" [ref=e260] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e261]
          - generic [ref=e262]:
            - generic [ref=e263]: Chat message UI
            - generic [ref=e265]:
              - generic [ref=e266]:
                - generic [ref=e267]:
                  - generic [ref=e268]: User bubble bg
                  - generic [ref=e269]: empty = inherit
                - generic [ref=e270]:
                  - textbox "User bubble bg" [ref=e271] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e272]
              - generic [ref=e273]:
                - generic [ref=e274]:
                  - generic [ref=e275]: User bubble text
                  - generic [ref=e276]: empty = inherit
                - generic [ref=e277]:
                  - textbox "User bubble text" [ref=e278] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e279]
              - generic [ref=e280]:
                - generic [ref=e281]:
                  - generic [ref=e282]: AI answer text
                  - generic [ref=e283]: empty = inherit
                - generic [ref=e284]:
                  - textbox "AI answer text" [ref=e285] [cursor=pointer]: "#888888"
                  - textbox "inherit" [ref=e286]
              - generic [ref=e287]:
                - generic [ref=e288]:
                  - generic [ref=e289]: Bubble radius
                  - generic [ref=e290]:
                    - generic [ref=e291]: inherit
                    - switch "Override Bubble radius" [ref=e292]
                - slider [disabled] [ref=e297]
              - generic [ref=e298]:
                - generic [ref=e299]:
                  - generic [ref=e300]: Message font size
                  - generic [ref=e301]:
                    - generic [ref=e302]: inherit
                    - switch "Override Message font size" [ref=e303]
                - slider [disabled] [ref=e308]
          - generic [ref=e309]:
            - generic [ref=e310]: Environment & identity
            - generic [ref=e312]:
              - generic [ref=e313]:
                - generic [ref=e314]: Environment
                - combobox [ref=e315]:
                  - generic: PROD
              - generic [ref=e316]:
                - generic [ref=e317]:
                  - generic [ref=e318]: Guest API key
                  - generic [ref=e319]: required for anonymous sessions
                - textbox "unset" [ref=e320]
              - generic [ref=e321]:
                - generic [ref=e322]:
                  - generic [ref=e323]: Google geo key
                  - generic [ref=e324]: advice feed stays empty without it
                - textbox "unset" [ref=e325]
          - generic [ref=e326]:
            - generic [ref=e327]: Journey & locale
            - generic [ref=e329]:
              - generic [ref=e330]:
                - generic [ref=e331]: Mode
                - combobox [ref=e332]:
                  - generic: FULL_JOURNEY
              - generic [ref=e333]:
                - generic [ref=e334]: Appearance
                - combobox [ref=e335]:
                  - generic: AUTO
              - generic [ref=e336]:
                - generic [ref=e337]:
                  - generic [ref=e338]: Language code
                  - generic [ref=e339]: e.g. "en", "hi"
                - textbox "unset" [ref=e340]
              - generic [ref=e341]:
                - generic [ref=e342]:
                  - generic [ref=e343]: Country code
                  - generic [ref=e344]: e.g. "IN", "KE"
                - textbox "unset" [ref=e345]
              - generic [ref=e346]:
                - generic [ref=e347]:
                  - generic [ref=e348]: State code
                  - generic [ref=e349]: seed geography
                - textbox "unset" [ref=e350]
              - generic [ref=e351]:
                - generic [ref=e352]: Show drawer
                - switch [checked] [ref=e354]
              - generic [ref=e355]:
                - generic [ref=e356]: Show chat history
                - switch [checked] [ref=e358]
              - generic [ref=e359]:
                - generic [ref=e360]: Show settings
                - switch [checked] [ref=e362]
              - generic [ref=e363]:
                - generic [ref=e364]: Show name screen
                - switch [checked] [ref=e366]
          - generic [ref=e367]:
            - generic [ref=e368]: Features
            - generic [ref=e370]:
              - generic [ref=e371]:
                - generic [ref=e372]: Voice questions
                - switch [checked] [ref=e374]
              - generic [ref=e375]:
                - generic [ref=e376]: Photo questions
                - switch [checked] [ref=e378]
              - generic [ref=e379]:
                - generic [ref=e380]: Weather
                - switch [checked] [ref=e382]
              - generic [ref=e383]:
                - generic [ref=e384]: SSFR advisory
                - switch [checked] [ref=e386]
              - generic [ref=e387]:
                - generic [ref=e388]:
                  - generic [ref=e389]: Agentic streaming chat
                  - generic [ref=e390]: 2.0.0 opt-in
                - switch [ref=e391]
              - generic [ref=e392]:
                - generic [ref=e393]:
                  - generic [ref=e394]: Analytics events
                  - generic [ref=e395]: off by default; hooks fire regardless
                - switch [ref=e396]
      - generic [ref=e397]:
        - generic [ref=e398]:
          - tablist [ref=e400]:
            - tab "Splash" [ref=e401]
            - tab "Language" [ref=e402]
            - tab "Name" [ref=e403]
            - tab "Home" [ref=e404]
            - tab "Chat" [selected] [ref=e405]
            - tab "OTP" [ref=e406]
            - tab "Settings" [ref=e407]
            - tab "Edit name" [ref=e408]
            - tab "Change lang" [ref=e409]
            - tab "Past Advice" [ref=e410]
            - tab "Help" [ref=e411]
            - tab "Sign-up promo" [ref=e412]
            - tab "All set" [ref=e413]
            - tab "Error" [ref=e414]
            - tab "Legal" [ref=e415]
          - paragraph [ref=e416]: Approximate shared design — the SDK renders consistently across platforms. The platform tabs change the exported code, not this preview.
          - generic [ref=e419]:
            - button [ref=e422]
            - generic [ref=e426]:
              - generic [ref=e427]:
                - generic [ref=e428]: How do I control armyworm in maize?
                - generic [ref=e429]:
                  - generic [ref=e430]: "To control Fall Armyworm in your maize field, adopt an Integrated Pest Management (IPM) approach:• Monitoring: inspect crops early and destroy egg masses by hand.• Biological: spray *Bacillus thuringiensis* or neem-based formulations early.• Chemical: for severe infestations, Emamectin Benzoate 5 SG at 0.4 g/litre, into the whorls."
                  - generic [ref=e431]:
                    - generic [ref=e432]: Do you grow maize on your farm?
                    - button "1 Yes, save maize" [ref=e433]:
                      - generic [ref=e434]: "1"
                      - generic [ref=e435]: Yes, save maize
                    - button "2 Not now" [ref=e436]:
                      - generic [ref=e437]: "2"
                      - generic [ref=e438]: Not now
                  - generic [ref=e439]: Local conditions may vary. Please confirm important actions before you act.
                  - generic [ref=e443]:
                    - button "Share" [ref=e444]
                    - button "Listen" [ref=e445]
                  - generic [ref=e446]:
                    - generic [ref=e447]: You can also ask
                    - button "How much urea per acre? Ask" [ref=e448]:
                      - generic [ref=e449]: How much urea per acre?
                      - generic [ref=e450]: Ask
                    - button "When should I irrigate? Ask" [ref=e451]:
                      - generic [ref=e452]: When should I irrigate?
                      - generic [ref=e453]: Ask
                - generic [ref=e454]: Which fertiliser for tomatoes?
                - generic [ref=e455]: Looking up soil conditions
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - generic: Did you know?
                      - paragraph: You can ask follow-up questions to get more details
            - generic [ref=e462]:
              - button "Camera" [ref=e463]
              - textbox "Ask about your farm…" [active] [ref=e464]
              - button "Voice" [ref=e465]
        - generic [ref=e466]:
          - generic [ref=e467]:
            - generic [ref=e468]:
              - generic [ref=e469]: Export — Web
              - generic [ref=e470]:
                - button "Copy code" [ref=e471]
                - button "Snippet" [ref=e472]
                - button "theme.json" [ref=e473]
            - tablist [ref=e475]:
              - tab "Web" [selected] [ref=e476]
              - tab "React Native" [ref=e477]
              - tab "Android" [ref=e478]
              - tab "iOS" [ref=e479]
          - generic [ref=e480]:
            - code [ref=e485]: "import { FarmerChat } from '@digitalgreenorg/farmerchat-web'; FarmerChat.initialize({ environment: 'prod', theme: { colors: { brandPrimary: '#008236', brandPrimaryDark: '#08361B', brandAccent: '#00C950', onBrand: '#FFFFFF', background: '#FFFFFF', readingSurface: '#F7F5EF', cardSurface: '#FFFFFF', onBackground: '#1C2B26', onSurface: '#1C2B26', error: '#C94F3D', }, shape: { cardCornerRadius: 24, buttonCornerRadius: 999, inputCornerRadius: 12 }, }, // Telemetry is OFF by default. Semantic callbacks fire either way. enableAnalytics: false, });"
            - paragraph [ref=e486]: Paste into your web app. Colors are CSS hex strings. theme.json below is exactly this object → FarmerChat.initialize(JSON.parse(json)).
  - region "Notifications alt+T"
```

# Test source

```ts
  15  |     // keeps the two facts from drifting apart.
  16  |     await expect(page.getByRole("tab", { name: "Gallery" })).toHaveCount(0)
  17  |   })
  18  | 
  19  |   test("selecting a preset re-themes the exported config", async ({ page }) => {
  20  |     await page.goto("/")
  21  |     // Default preset is FarmerChat Green.
  22  |     await expect(page.locator("pre")).toContainText("#008236")
  23  |     // Switch preset → export code updates to Ocean Blue's brand primary.
  24  |     await page.getByRole("button", { name: "Ocean Blue" }).click()
  25  |     await expect(page.locator("pre")).toContainText("#1565C0")
  26  |     await expect(page.locator("pre")).not.toContainText("#008236")
  27  |   })
  28  | 
  29  |   test("switching export platform regenerates platform-specific code", async ({ page }) => {
  30  |     await page.goto("/")
  31  |     await expect(page.locator("pre")).toContainText("FarmerChat.initialize({") // web/JS
  32  |     await page.getByRole("tab", { name: "Android" }).click()
  33  |     await expect(page.locator("pre")).toContainText("FarmerChatConfig.builder(FarmerChatEnvironment.PROD)")
  34  |     await page.getByRole("tab", { name: "iOS" }).click()
  35  |     await expect(page.locator("pre")).toContainText("FarmerChatConfig(")
  36  |   })
  37  | 
  38  |   test("every platform export states the analytics default", async ({ page }) => {
  39  |     // enableAnalytics defaults to FALSE in 2.0.0. If the generated config omits it, a host wires
  40  |     // everything up, sees nothing reach their analytics listener, and has nothing in their own
  41  |     // code to explain why — so the flag is printed with its default rather than left out.
  42  |     //
  43  |     // This used to assert the flag was ANDROID-ONLY. That was wrong: it is a real field on all
  44  |     // four platforms — iOS `config.enableAnalytics` (FarmerChat.swift:117), and
  45  |     // `enableAnalytics?: boolean` in both the web and react-native `core/config.ts`. Emitting it
  46  |     // everywhere is parity, not fabrication.
  47  |     await page.goto("/")
  48  |     await page.getByRole("tab", { name: "Android" }).click()
  49  |     await expect(page.locator("pre")).toContainText(".enableAnalytics(false)")
  50  |     await page.getByRole("tab", { name: "iOS" }).click()
  51  |     await expect(page.locator("pre")).toContainText("enableAnalytics: false")
  52  |     await page.getByRole("tab", { name: "Web" }).click()
  53  |     await expect(page.locator("pre")).toContainText("enableAnalytics: false")
  54  |   })
  55  | 
  56  |   test("phone preview navigates between app screens", async ({ page }) => {
  57  |     await page.goto("/")
  58  |     await page.getByRole("tab", { name: "Chat" }).click()
  59  |     // The SERVED label, not the compose fallback: `fc_v2_app_label_related_questions` is
  60  |     // "You can also ask" on DEV, and the preview renders what the backend sends.
  61  |     await expect(page.getByText("You can also ask")).toBeVisible()
  62  |     await expect(page.getByText("How do I control armyworm in maize?")).toBeVisible()
  63  |     await page.getByRole("tab", { name: "Settings" }).click()
  64  |     // Scoped to `.phone`, not the page: `exact: true` alone used to be enough to keep these off
  65  |     // control-panel copy, but the new config panels added an "Appearance" knob whose <label> is
  66  |     // an exact match too, so a page-wide locator hits two elements and trips strict mode. These
  67  |     // assert phone-preview SECTION labels, so the phone is the right scope.
  68  |     const settings = page.locator(".phone")
  69  |     await expect(settings.getByText("Appearance", { exact: true })).toBeVisible()
  70  |     await expect(settings.getByText("Account details", { exact: true })).toBeVisible()
  71  |   })
  72  | 
  73  |   test("chat: typing a question appends a user message", async ({ page }) => {
  74  |     await page.goto("/?screen=chat")
  75  |     // 2.0.0: the composer is always on screen, so there is no "Type" button to
  76  |     // open first — that tile row belonged to the legacy (non-agentic) UI.
  77  |     const input = page.getByPlaceholder("Ask about your farm…")
  78  |     await expect(input).toBeVisible()
  79  |     await input.fill("How do I test end to end?")
  80  |     await input.press("Enter")
  81  |     await expect(page.getByText("How do I test end to end?")).toBeVisible()
  82  |   })
  83  | 
  84  |   test("chat: the agentic answer footer has no Save, and carries the accuracy note", async ({ page }) => {
  85  |     await page.goto("/?screen=chat")
  86  |     const phone = page.locator(".phone")
  87  |     await expect(phone.getByText("Local conditions may vary.", { exact: false })).toBeVisible()
  88  |     await expect(phone.getByRole("button", { name: "Share", exact: true })).toBeVisible()
  89  |     await expect(phone.getByRole("button", { name: "Listen", exact: true })).toBeVisible()
  90  |     // Save is a LEGACY-only action. The android defect that started this whole
  91  |     // audit was an agentic answer rendering the legacy row, so pin its absence.
  92  |     //
  93  |     // `exact: true` is load-bearing: getByRole's `name` matches a SUBSTRING by
  94  |     // default, and the alignment chip "Yes, save maize" contains "save".
  95  |     await expect(phone.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
  96  |   })
  97  | 
  98  |   test("chat: an agentic answer offers numbered alignment chips", async ({ page }) => {
  99  |     await page.goto("/?screen=chat")
  100 |     const phone = page.locator(".phone")
  101 |     await expect(phone.getByText("Do you grow maize on your farm?")).toBeVisible()
  102 |     await expect(phone.getByRole("button", { name: /Yes, save maize/ })).toBeVisible()
  103 |     await expect(phone.getByRole("button", { name: /Not now/ })).toBeVisible()
  104 |   })
  105 | 
  106 |   test("chat: asking a question shows the tips carousel for the wait, then settles", async ({ page }) => {
  107 |     await page.goto("/?screen=chat")
  108 |     const phone = page.locator(".phone")
  109 |     await phone.getByPlaceholder("Ask about your farm…").fill("Which fertiliser for tomatoes?")
  110 |     await phone.getByPlaceholder("Ask about your farm…").press("Enter")
  111 |     // The wait: a shimmering stream status and a tip card.
  112 |     await expect(phone.locator(".fc-shimmer")).toBeVisible()
  113 |     await expect(phone.getByText("You can ask follow-up questions to get more details")).toBeVisible()
  114 |     // ...and both are gone once the answer lands.
> 115 |     await expect(phone.locator(".fc-shimmer")).toHaveCount(0, { timeout: 15000 })
      |                                                ^ Error: expect(locator).toHaveCount(expected) failed
  116 |   })
  117 | 
  118 |   test("home: the agentic composer replaces the Photo/Speak/Type row", async ({ page }) => {
  119 |     await page.goto("/?screen=home")
  120 |     const phone = page.locator(".phone")
  121 |     await expect(phone.getByPlaceholder("Ask about your farm…")).toBeVisible()
  122 |     // The legacy tiles were labelled exactly Photo / Speak / Type. The composer's
  123 |     // own camera and mic use the SDK's real content descriptions ("Camera",
  124 |     // "Voice" — InputComposer.kt:512/715), so this cannot pass vacuously.
  125 |     await expect(phone.getByRole("button", { name: "Photo", exact: true })).toHaveCount(0)
  126 |     await expect(phone.getByRole("button", { name: "Speak", exact: true })).toHaveCount(0)
  127 |     await expect(phone.getByRole("button", { name: "Type", exact: true })).toHaveCount(0)
  128 |     await expect(phone.getByRole("button", { name: "Camera", exact: true })).toBeVisible()
  129 |     await expect(phone.getByRole("button", { name: "Voice", exact: true })).toBeVisible()
  130 |     await expect(phone.getByText("What are farmers asking today?")).toBeVisible()
  131 |   })
  132 | 
  133 |   test("night appearance puts the phone in dark mode", async ({ page }) => {
  134 |     await page.goto("/?appearance=night")
  135 |     await expect(page.locator(".phone.dark")).toBeVisible()
  136 |   })
  137 | 
  138 |   test("gallery renders the component sections", async ({ page }) => {
  139 |     await page.goto("/?view=gallery")
  140 |     await expect(page.getByRole("heading", { name: "Form controls" })).toBeVisible()
  141 |     await expect(page.getByRole("heading", { name: "Overlays & menus" })).toBeVisible()
  142 |   })
  143 | 
  144 |   test("Get SDK: is the integration guide, and states versions per platform", async ({ page }) => {
  145 |     await page.goto("/?view=sdk")
  146 |     // The themed platform cards and their quick-start downloads were removed: the tab now renders
  147 |     // ONLY the integration guide, generated from `tools/guide-gen` into `lib/guide.data.json` so
  148 |     // the Studio and the shareable artifact cannot drift.
  149 |     await expect(page.getByRole("heading", { name: "Integration guide" })).toBeVisible()
  150 |     await expect(page.getByRole("button", { name: /Quick-start/ })).toHaveCount(0)
  151 |     // Versions are per-platform and derived from SDK_META, never restated in prose.
  152 |     await expect(page.getByText("2.0.0", { exact: false }).first()).toBeVisible()
  153 |     await expect(page.getByText("1.0.0", { exact: false }).first()).toBeVisible()
  154 |   })
  155 | 
  156 |   test("dark palette: empty by default, and each platform emits its own shape", async ({ page }) => {
  157 |     await page.goto("/")
  158 |     // Unset dark colours must stay OUT of the config — the SDK falls back to the light value,
  159 |     // so emitting a duplicate would silently freeze dark mode to the light palette.
  160 |     await expect(page.locator("pre")).not.toContainText("dark")
  161 | 
  162 |     // Set one dark colour. The section is optional, so the swatch starts blank.
  163 |     const nightBrand = page.locator('[data-testid="night-brandPrimary"]')
  164 |     await nightBrand.fill("#101820")
  165 | 
  166 |     // web: `theme.dark` sits BESIDE colors.
  167 |     await expect(page.locator("pre")).toContainText("dark: {")
  168 |     await expect(page.locator("pre")).toContainText("brandPrimary: '#101820'")
  169 | 
  170 |     // android: `.brandPrimaryNight(...)` on the same builder.
  171 |     await page.getByRole("tab", { name: "Android" }).click()
  172 |     await expect(page.locator("pre")).toContainText(".brandPrimaryNight(0xFF101820.toInt())")
  173 | 
  174 |     // iOS: flat `darkBrandPrimary:`.
  175 |     await page.getByRole("tab", { name: "iOS" }).click()
  176 |     await expect(page.locator("pre")).toContainText("darkBrandPrimary: Color(hex: 0x101820)")
  177 |   })
  178 | 
  179 |   test("Get SDK: the guide's android install line uses the real Maven group", async ({ page }) => {
  180 |     await page.goto("/?view=sdk")
  181 |     // groupId is org.digitalgreen.FARMERCHAT. Plain `org.digitalgreen:...` resolves nowhere, so a
  182 |     // host copying the install line would get an unresolvable dependency. The install lines now
  183 |     // live in the guide's code blocks rather than on a card, so assert inside the guide body.
  184 |     const guide = page.locator(".fcg-body")
  185 |     await expect(guide.getByText("org.digitalgreen.farmerchat", { exact: false }).first()).toBeVisible()
  186 |   })
  187 | 
  188 |   test("deep-link params open the requested view", async ({ page }) => {
  189 |     await page.goto("/?view=sdk")
  190 |     await expect(page.getByRole("heading", { name: "Integration guide" })).toBeVisible()
  191 |     await page.goto("/?view=gallery")
  192 |     await expect(page.getByRole("heading", { name: "Form controls" })).toBeVisible()
  193 |   })
  194 | })
  195 | 
```