import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home page loads and shows step 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("STEP 1 OF 6")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
  });

  test("navbar shows ArcLab logo", async ({ page }) => {
    await page.goto("/");
    const logo = page.locator("nav img[alt='ArcLab']");
    await expect(logo).toBeVisible();
  });

  test("navbar step tracker shows Upload as active on step 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav").getByText("Upload")).toBeVisible();
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/info");
    await expect(page.getByRole("heading", { name: "Team ParallaX" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ArcLab", exact: true })).toBeVisible();
});

  test("about page shows team members", async ({ page }) => {
    await page.goto("/info");
    await expect(page.getByText("Chen Letao")).toBeVisible();
    await expect(page.getByText("Liu Keming")).toBeVisible();
  });

  test("about page shows GitHub and LinkedIn links", async ({ page }) => {
    await page.goto("/info");
    await expect(page.getByRole("link", { name: /GitHub/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /LinkedIn/ }).first()).toBeVisible();
  });

  test("about nav link navigates to info page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL("/info");
    await expect(page.getByRole("heading", { name: "Team ParallaX" })).toBeVisible();
  });

  test("ArcLab logo link navigates to home", async ({ page }) => {
    await page.goto("/info");
    await page.locator("nav a").first().click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Upload step UI", () => {
  test("shows drop zone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Drop your video here")).toBeVisible();
  });

  test("shows supported formats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("MP4", { exact: true })).toBeVisible();
    await expect(page.getByText("MOV", { exact: true })).toBeVisible();
  });

  test("mock results button is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Skip to mock results")).toBeVisible();
  });
});

test.describe("Step progression with mock data", () => {
  test("mock results jumps to step 6", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Skip to mock results").click();
    await expect(page.getByText("STEP 6 OF 6")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  });

  test("navbar updates to show Results as active after mock jump", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Skip to mock results").click();
    await expect(page.locator("nav").getByText("Results")).toBeVisible();
  });
});
