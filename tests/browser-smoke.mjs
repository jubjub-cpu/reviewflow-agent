import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const port = Number(process.env.REVIEWFLOW_TEST_PORT || 4187);
const deployed = process.env.REVIEWFLOW_BASE_URL?.trim();
const base = deployed
  ? `${deployed.replace(/\/$/, "")}/`
  : `http://127.0.0.1:${port}/`;
const target = process.env.PLAYWRIGHT_MODULE || "playwright";
const specifier = /^[A-Za-z]:[\\/]/.test(target)
  ? pathToFileURL(target).href
  : target;
const { chromium } = await import(specifier);
const desktopShot = fileURLToPath(
  new URL("../docs/screenshots/reviewflow-approved-workflow.png", import.meta.url),
);
const mobileShot = fileURLToPath(
  new URL("../docs/screenshots/reviewflow-mobile-workflow.png", import.meta.url),
);
const server = deployed
  ? null
  : spawn(process.execPath, ["tools/static-server.mjs", "--port", String(port)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });

async function ready() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("ReviewFlow server did not start");
}

async function complete(page) {
  await page.locator("#run-workflow").click();
  await page.locator(".check").first().waitFor({ state: "visible" });
  assert.equal(await page.locator(".badge.blocked").count(), 0);
  assert.equal(await page.locator("#approve-internal").isEnabled(), true);
  await page.locator("#approve-internal").click();
  assert.equal(await page.locator("#response-draft").isVisible(), true);
  const draft = await page.locator("#response-draft").inputValue();
  await page
    .locator("#response-draft")
    .fill(`${draft}\n\nReviewed for synthetic demonstration.`);
  assert.equal(await page.locator("#approve-outbound").isEnabled(), true);
  await page.locator("#approve-outbound").click();
  assert.match(
    await page
      .locator('[aria-label="Outbound response approval"] .summary-line')
      .innerText(),
    /approved for human sending/i,
  );
}

let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await desktop.newPage();
  const errors = [];
  const failed = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => failed.push(request.url()));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-request]").count(), 3);

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("skip-link")),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => location.hash), "#workspace");

  await complete(page);
  const downloadWait = page.waitForEvent("download");
  await page.locator("#export-record").click();
  assert.match((await downloadWait).suggestedFilename(), /reviewflow-record\.json$/);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: desktopShot, fullPage: true });

  await page.locator('[data-request="VR-219"]').click();
  await page.locator("#run-workflow").click();
  await page.locator(".badge.blocked").first().waitFor({ state: "visible" });
  assert.ok((await page.locator(".badge.blocked").count()) >= 1);
  assert.equal(await page.locator("#approve-internal").isEnabled(), false);
  assert.match(
    await page
      .locator('[aria-label="Internal exception approval"] .summary-line')
      .innerText(),
    /Blocked/,
  );
  await page.locator("#request-text").fill("short");
  await page.locator("#run-workflow").click();
  assert.match(
    await page.locator("#request-error").innerText(),
    /at least 20 characters/,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(base, { waitUntil: "networkidle" });
  await complete(mobilePage);
  assert.equal(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
    false,
  );
  await mobilePage.evaluate(() => document.activeElement?.blur());
  await mobilePage.screenshot({ path: mobileShot, fullPage: true });
  await mobile.close();

  const errorContext = await browser.newContext();
  const errorPage = await errorContext.newPage();
  await errorPage.route("**/data/workflow.json", (route) => route.abort());
  await errorPage.goto(base, { waitUntil: "domcontentloaded" });
  await errorPage
    .getByRole("heading", {
      name: "The synthetic exception queue could not be loaded.",
    })
    .waitFor({ state: "visible" });
  assert.equal(await errorPage.getByRole("button", { name: "Retry" }).isVisible(), true);
  await errorContext.close();

  console.log("REVIEWFLOW BROWSER TESTS PASSED");
  console.log(
    JSON.stringify({
      target: deployed ? "deployed" : "local",
      requests: 3,
      twoGateApproval: true,
      blockedScenario: true,
      keyboard: true,
      desktopOverflow: false,
      mobileOverflow: false,
      consoleErrors: 0,
      failedRequests: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
