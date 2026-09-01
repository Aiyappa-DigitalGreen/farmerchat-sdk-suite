import { test, expect } from "@playwright/test"

/* End-to-end coverage of the Theme Studio's real user flows, driven against the
 * production build in system Chrome. Screen/view/appearance deep-link params are
 * used where clicking a shadcn overlay would be flaky. */

test.describe("Theme Studio E2E", () => {
  test("loads with the three top-level tabs", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Theme Studio")).toBeVisible()
    await expect(page.getByRole("tab", { name: "Studio" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Gallery" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Get SDK" })).toBeVisible()
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

  test("phone preview navigates between app screens", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("tab", { name: "Chat" }).click()
    await expect(page.getByText("Related questions")).toBeVisible()
    await expect(page.getByText("What's the best fertilizer for wheat this season?")).toBeVisible()
    await page.getByRole("tab", { name: "Settings" }).click()
    await expect(page.getByText("Appearance")).toBeVisible()
    await expect(page.getByText("Account details")).toBeVisible()
  })

  test("chat: typing a question appends a user message", async ({ page }) => {
    await page.goto("/?screen=chat")
    await page.getByRole("button", { name: "Type" }).click()
    const input = page.getByPlaceholder("Type your question…")
    await expect(input).toBeVisible()
    await input.fill("How do I test end to end?")
    await input.press("Enter")
    await expect(page.getByText("How do I test end to end?")).toBeVisible()
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

  test("Get SDK: shows real package ids and downloads a themed quick-start", async ({ page }) => {
    await page.goto("/?view=sdk")
    await expect(page.getByText("Get the FarmerChat SDK")).toBeVisible()
    // Package id appears in both the card header and the install command; the
    // full install line is unique, so assert on that.
    await expect(page.getByText("npm install @digitalgreenorg/farmerchat-web@1.0.0")).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Quick-start/ }).first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/farmerchat-web-v1\.0\.0-quickstart\.md/)
  })

  test("deep-link params open the requested view", async ({ page }) => {
    await page.goto("/?view=sdk")
    await expect(page.getByText("Get the FarmerChat SDK")).toBeVisible()
    await page.goto("/?view=gallery")
    await expect(page.getByRole("heading", { name: "Form controls" })).toBeVisible()
  })
})
