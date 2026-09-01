import { defineConfig } from "@playwright/test"

/* E2E for the Theme Studio. Uses the system Chrome (channel: "chrome") so no
 * Playwright browser download is needed. Builds and serves the production
 * bundle on :4799, then drives the real app. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4799",
    channel: "chrome",
    headless: true,
    acceptDownloads: true,
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4799 --strictPort",
    url: "http://localhost:4799",
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
