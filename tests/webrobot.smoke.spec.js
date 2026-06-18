import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("webrobot.language"));
});

test("keeps the WebGL stage alive across language and robot variant changes", async ({ page }) => {
  await page.goto("/");
  const stage = page.locator("#stage");

  await expect(stage).toHaveAttribute("data-debug-api", "ready");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("button", { name: "进入实验室" })).toBeVisible();
  await expect(stage.locator("canvas")).toHaveCount(1);

  await page.locator("#enter-lab").evaluate((button) => button.click());
  await page.waitForFunction(() => window.webRobotDebug?.snapshot().home.entered === true);
  await expect(stage.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => {
    const languageSelect = Array.from(document.querySelectorAll("[data-language-select]")).at(-1);
    languageSelect.value = "en";
    languageSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(stage.locator("canvas")).toHaveCount(1);

  const variantSelectorHealth = await page.evaluate(() => ({
    globalMatches: document.querySelectorAll("[data-robot-variant]").length,
    buttonMatches: document.querySelectorAll("#robot-variant-buttons [data-robot-variant]").length,
    stageHasVariantTelemetry: document.querySelector("#stage")?.hasAttribute("data-robot-variant")
  }));
  expect(variantSelectorHealth.stageHasVariantTelemetry).toBe(true);
  expect(variantSelectorHealth.buttonMatches).toBeGreaterThanOrEqual(10);
  expect(variantSelectorHealth.globalMatches).toBeGreaterThan(variantSelectorHealth.buttonMatches);

  await page.evaluate(() => document.querySelector("#robot-variant-buttons [data-robot-variant='go2-quadruped']").click());
  await expect(stage).toHaveAttribute("data-robot-variant", "go2-quadruped");
  await expect(stage.locator("canvas")).toHaveCount(1);

  await expect(page.locator("#item-list button").first()).toHaveAttribute("aria-label", /Cup: Ready/);
  await expect(page.locator("#target-list button").first()).toHaveAttribute("aria-label", /Coffee Table: Available/);
});
