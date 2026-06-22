import { expect, test } from "@playwright/test";

const ROBOT_VARIANTS = [
  { id: "g1-29dof", kind: "humanoid", armCapable: true, armLayout: "dual", urdfPath: "g1_29dof.urdf" },
  { id: "g1-23dof", kind: "humanoid", armCapable: true, armLayout: "dual", urdfPath: "g1_23dof.urdf" },
  { id: "g1-dual-arm", kind: "humanoid", armCapable: true, armLayout: "dual", urdfPath: "g1_29dof.urdf" },
  { id: "h1-humanoid", kind: "humanoid", armCapable: true, armLayout: "dual", urdfPath: "g1_29dof.urdf" },
  { id: "r1-humanoid", kind: "humanoid", armCapable: true, armLayout: "dual", urdfPath: "R1.urdf" },
  { id: "go1-quadruped", kind: "quadruped", armCapable: false, armLayout: "none", urdfPath: "go2_description.urdf" },
  { id: "go2-quadruped", kind: "quadruped", armCapable: false, armLayout: "none", urdfPath: "go2_description.urdf" },
  { id: "aliengo-quadruped", kind: "quadruped", armCapable: false, armLayout: "none", urdfPath: "go2_description.urdf" },
  { id: "b2-quadruped", kind: "quadruped", armCapable: false, armLayout: "none", urdfPath: "go2_description.urdf" },
  { id: "b2w-quadruped", kind: "quadruped", armCapable: false, armLayout: "none", urdfPath: "go2_description.urdf" },
  { id: "mobile-base", kind: "mobile", armCapable: false, armLayout: "none", urdfPath: "mobile_base.urdf" },
  { id: "mobile-single-arm", kind: "mobile", armCapable: true, armLayout: "right", urdfPath: "mobile_manipulator.urdf" },
  { id: "mobile-dual-arm", kind: "mobile", armCapable: true, armLayout: "dual", urdfPath: "mobile_dual_arm.urdf" },
  { id: "cobot-arm", kind: "mobile", armCapable: true, armLayout: "right", urdfPath: "cobot_arm.urdf" },
  { id: "tracked-rescue", kind: "mobile", armCapable: false, armLayout: "none", urdfPath: "tracked_inspection.urdf" }
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("webrobot.language"));
});

async function enterLab(page) {
  await page.goto("/");
  await expect(page.locator("#stage")).toHaveAttribute("data-debug-api", "ready");
  await page.locator("#enter-lab").evaluate((button) => button.click());
  await page.waitForFunction(() => window.webRobotDebug?.snapshot().home.entered === true);
}

async function selectVariant(page, id) {
  await page.evaluate((variantId) => {
    document.querySelector(`#robot-variant-buttons [data-robot-variant="${variantId}"]`).click();
  }, id);
}

async function waitForVariantLoaded(page, expected) {
  await page.waitForFunction(
    ({ id }) => {
      const stage = document.querySelector("#stage");
      const snapshot = window.webRobotDebug?.snapshot?.();
      return stage?.dataset.robotVariant === id && snapshot?.robotVariant === id && snapshot.home.entered;
    },
    { id: expected.id },
    { timeout: 30_000 }
  );

  await page.waitForFunction(
    ({ id, kind, urdfPath }) => {
      const snapshot = window.webRobotDebug?.snapshot?.();
      if (!snapshot || snapshot.robotVariant !== id) return false;
      return (
        snapshot.robotKind === kind &&
        snapshot.robotUrdfStatus === "URDF 已加载" &&
        snapshot.robotUrdfVisible === true &&
        snapshot.proceduralProxyVisible === false &&
        snapshot.robotUrdfPath.endsWith(urdfPath) &&
        snapshot.robotUrdfJointCount > 0
      );
    },
    expected,
    { timeout: 120_000 }
  );
}

function expectedArmState(layout, armCapable) {
  return {
    grabDisabled: !armCapable,
    leftArmDisabled: !armCapable || layout === "right" || layout === "none",
    rightArmDisabled: !armCapable || layout === "none"
  };
}

test("loads every robot platform configuration with consistent controls", async ({ page }) => {
  test.setTimeout(900_000);
  const urdfRequests = new Map();
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/robots/urdf/") || !url.endsWith(".urdf")) return;
    const path = new URL(url).pathname.split("/robots/urdf/").at(-1);
    urdfRequests.set(path, (urdfRequests.get(path) || 0) + 1);
  });

  await enterLab(page);
  const stage = page.locator("#stage");
  const resultLines = [];

  await expect(stage.locator("canvas")).toHaveCount(1);
  await expect(page.locator("#robot-variant-buttons [data-robot-variant]")).toHaveCount(ROBOT_VARIANTS.length);

  for (const expected of ROBOT_VARIANTS) {
    console.log(`Loading robot variant: ${expected.id}`);
    await selectVariant(page, expected.id);
    await waitForVariantLoaded(page, expected);
    await expect(stage.locator("canvas")).toHaveCount(1);

    const result = await page.evaluate(() => {
      const snapshot = window.webRobotDebug.snapshot();
      return {
        id: snapshot.robotVariant,
        kind: snapshot.robotKind,
        armCapable: snapshot.armCapable,
        urdfStatus: snapshot.robotUrdfStatus,
        urdfPath: snapshot.robotUrdfPath,
        joints: snapshot.robotUrdfJointCount,
        footClearance: snapshot.robot.footClearance,
        proceduralProxyVisible: snapshot.proceduralProxyVisible,
        urdfVisible: snapshot.robotUrdfVisible,
        grabDisabled: document.querySelector("#grab-btn").disabled,
        leftArmDisabled: document.querySelector("[data-arm-select='left']").disabled,
        rightArmDisabled: document.querySelector("[data-arm-select='right']").disabled
      };
    });

    expect(result).toMatchObject({
      id: expected.id,
      kind: expected.kind,
      armCapable: expected.armCapable,
      urdfStatus: "URDF 已加载",
      proceduralProxyVisible: false,
      urdfVisible: true,
      ...expectedArmState(expected.armLayout, expected.armCapable)
    });
    expect(result.urdfPath).toContain(expected.urdfPath);
    expect(result.joints).toBeGreaterThan(0);
    expect(result.footClearance).toBeGreaterThanOrEqual(-0.01);
    expect(result.footClearance).toBeLessThanOrEqual(0.12);

    resultLines.push(
      `${result.id}: kind=${result.kind}, joints=${result.joints}, footClearance=${result.footClearance.toFixed(3)}, armCapable=${result.armCapable}`
    );
  }

  console.log(`Robot variant matrix passed:\n${resultLines.join("\n")}`);
  expect(Object.fromEntries(urdfRequests)).toMatchObject({
    "unitree/g1_description/g1_29dof.urdf": 1,
    "unitree/g1_description/g1_23dof.urdf": 1,
    "unitree/r1_description/R1.urdf": 1,
    "unitree/go2_description/go2_description.urdf": 1,
    "generic/mobile_base.urdf": 1,
    "generic/mobile_manipulator.urdf": 1,
    "generic/mobile_dual_arm.urdf": 1,
    "generic/cobot_arm.urdf": 1,
    "generic/tracked_inspection.urdf": 1
  });
});
