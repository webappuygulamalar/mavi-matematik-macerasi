import { defineConfig } from "@playwright/test";

const DEV_PORT = 8123;
const DIST_PORT = 4174;
// GitHub Pages proje sayfası gibi alt dizinde yayını taklit eder.
const DIST_BASE = "/mavi-matematik-macerasi/";

const devProject = (name, use) => ({
  name,
  testMatch: /(smoke|visual|levels|menu|layout|start)\.spec\.mjs/,
  use: { baseURL: `http://127.0.0.1:${DEV_PORT}/`, ...use }
});

export default defineConfig({
  testDir: "tests",
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    browserName: "chromium"
  },
  webServer: [
    {
      command: `python3 -m http.server ${DEV_PORT} --bind 127.0.0.1`,
      url: `http://127.0.0.1:${DEV_PORT}/index.html`,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "ignore"
    },
    {
      // Her test çalıştırmasında dist/ yeniden üretilir ve alt dizinden sunulur.
      command: `node tools/build.mjs && node tools/preview.mjs --port ${DIST_PORT} --base ${DIST_BASE}`,
      url: `http://127.0.0.1:${DIST_PORT}${DIST_BASE}index.html`,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe"
    }
  ],
  projects: [
    devProject("masaustu-1440x900", { viewport: { width: 1440, height: 900 } }),
    devProject("tablet-1024x768", { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }),
    devProject("telefon-844x390", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }),
    devProject("android-915x412", { viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 }),
    {
      name: "dist-pwa-telefon",
      testMatch: "dist.spec.mjs",
      use: {
        baseURL: `http://127.0.0.1:${DIST_PORT}${DIST_BASE}`,
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3
      }
    }
  ]
});
