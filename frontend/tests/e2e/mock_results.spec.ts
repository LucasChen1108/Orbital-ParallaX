import { test, expect } from "@playwright/test";

test.describe("Results page (mock data)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByText("Skip to mock results").click();
    await expect(page.getByText("Gravity estimate")).toBeVisible();
  });

  test("shows all physics metric cards", async ({ page }) => {
    await expect(page.getByText("Gravity estimate")).toBeVisible();
    await expect(page.getByText("Initial velocity")).toBeVisible();
    await expect(page.getByText("Launch angle")).toBeVisible();
    await expect(page.getByText("Frames analysed")).toBeVisible();
  });

  test("trajectory canvas renders", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
  });

  test("ghost trajectory toggle works", async ({ page }) => {
    const ghostToggle = page.getByRole("button", { name: /Ghost/i }).first();
    await expect(ghostToggle).toBeVisible();
    await ghostToggle.click();
    await ghostToggle.click();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("strobe view toggle works", async ({ page }) => {
    const strobeToggle = page.getByRole("button", { name: /Strobe/i });
    await expect(strobeToggle).toBeVisible();
    await strobeToggle.click();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("video tabs are present", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Original" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overlay (annotated)" })).toBeVisible();
  });

  test("overlay tab shows no-overlay message when no overlay exists", async ({ page }) => {
    await page.getByRole("button", { name: "Overlay (annotated)" }).click();
    await expect(page.getByText(/No overlay available/i)).toBeVisible();
  });

  test("export CSV button triggers download", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/arclab.*\.csv/);
  });

  test("export PDF button triggers download", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/arclab.*\.pdf/);
  });

  test("trajectory canvas is interactive", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await expect(canvas).toBeVisible();
  });

  test("start new analysis button resets to step 1", async ({ page }) => {
    await page.getByText("↺ Start new analysis").click();
    await expect(page.getByText("STEP 1 OF 6")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
  });
});
