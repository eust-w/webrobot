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

test("exposes stable obstacle-aware navigation diagnostics", async ({ page }) => {
  await page.goto("/");
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("data-debug-api", "ready");

  const routes = await page.evaluate(() => {
    const routeCases = [
      [{ x: -8.0, z: -3.2 }, { x: 5.3, z: 1.85 }],
      [{ x: 0.0, z: 2.55 }, { x: 3.2, z: -5.65 }],
      [{ x: -7.5, z: 2.2 }, { x: 1.65, z: 0.95 }]
    ];
    return routeCases.map(([start, goal]) => window.webRobotDebug.planPath(start, goal));
  });

  for (const route of routes) {
    expect(["direct", "planned"]).toContain(route.stats.status);
    expect(route.points.length).toBeGreaterThan(0);
    expect(route.stats.lastPathLength).toBe(route.points.length);
    expect(route.stats.iterations).toBeLessThan(2400);
  }

  expect(routes.some((route) => route.stats.status === "planned")).toBe(true);
  await expect(stage).toHaveAttribute("data-robot-nav-planner-status", /direct|planned/);
  await expect(stage.locator("canvas")).toHaveCount(1);
});
