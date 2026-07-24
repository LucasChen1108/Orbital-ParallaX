import { expect, Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { MOCK_ANALYSIS, MOCK_UPLOAD } from "../../app/lib/mockData";


const API_BASE = "http://localhost:8000/api/v1/video";
const ANALYSIS_RESPONSE = {
  ...MOCK_ANALYSIS,
  detections: MOCK_ANALYSIS.result?.timestamps.map((_, i) => [
    i,
    120 + i * 15,
    300 - i * 8,
  ]),
  detected_frames: MOCK_ANALYSIS.result?.timestamps.length,
  total_frames: MOCK_UPLOAD.total_frames,
  detection_rate: 100,
  has_overlay: false,
};

async function mockBackend(page: Page) {
  const json = async (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  };

  await page.route(`${API_BASE}/upload`, route => json(route, MOCK_UPLOAD));
  await page.route(`${API_BASE}/auto-calibrate`, route => json(route, {
    px_per_metre: 142.5,
    median_diameter_px: 31.35,
    mean_diameter_px: 31.4,
    diameter_std_px: 0.5,
    variation_cv_pct: 1.6,
    quality: "good",
    warning: null,
    valid_detections: 10,
    raw_detections: 10,
    total_frames: MOCK_UPLOAD.total_frames,
  }));
  await page.route(`${API_BASE}/analyse`, route => json(route, ANALYSIS_RESPONSE));
  await page.route(`${API_BASE}/predict`, route => json(route, {
    timestamps: MOCK_ANALYSIS.result?.timestamps,
    x_positions_m: MOCK_ANALYSIS.result?.predicted_trajectory?.x_positions_m,
    y_positions_m: MOCK_ANALYSIS.result?.predicted_trajectory?.y_positions_m,
  }));
  await page.route(`${API_BASE}/video/**`, route => route.fulfill({
    status: 204,
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.route(`${API_BASE}/frame/**`, route => route.fulfill({
    status: 200,
    contentType: "image/png",
    headers: { "access-control-allow-origin": "*" },
    body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  }));
}

async function uploadVideo(page: Page) {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "projectile.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("issue-39-e2e-video"),
  });
  await expect(page.getByText("STEP 2 OF 5")).toBeVisible();
}

async function completeHappyPath(page: Page) {
  await mockBackend(page);
  await uploadVideo(page);
  await page.getByRole("button", { name: "Confirm interval →" }).click();

  await expect(page.getByText("STEP 3 OF 5")).toBeVisible();
  await page.getByPlaceholder("e.g. 0.22").fill("0.22");
  await page.getByRole("button", { name: "Detect ball and calibrate" }).click();
  await expect(page.getByText("Automatic calibration ready")).toBeVisible();
  await page.getByRole("button", { name: "Use this calibration" }).click();

  await expect(page.getByText("STEP 4 OF 5")).toBeVisible();
  await page.getByRole("button", { name: "Run analysis →" }).click();
  await expect(page.getByText("STEP 5 OF 5")).toBeVisible();
  await expect(page.getByText("Gravity estimate")).toBeVisible();
}

function trajectoryPoint(box: { x: number; y: number; width: number; height: number }, idx: number) {
  const result = MOCK_ANALYSIS.result!;
  const allX = [
    ...result.x_positions_m,
    ...(result.predicted_trajectory?.x_positions_m ?? []),
  ];
  const allY = [
    ...result.y_positions_m,
    ...(result.predicted_trajectory?.y_positions_m ?? []),
  ];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const canvasX = 52 + (
    (result.x_positions_m[idx] - minX) / (maxX - minX || 1)
  ) * (800 - 104);
  const canvasY = 400 - 52 - (
    (result.y_positions_m[idx] - minY) / (maxY - minY || 1)
  ) * (400 - 104);
  return {
    x: box.x + canvasX * box.width / 800,
    y: box.y + canvasY * box.height / 400,
  };
}

test("full happy path: upload, interval, automatic calibration, YOLO analysis, results", async ({ page }) => {
  await completeHappyPath(page);
  await expect(page.getByText("Tracker: YOLOv8")).toBeVisible();
  await expect(page.getByTestId("trajectory-canvas")).toBeVisible();
});

test("Set as start uses the current video frame", async ({ page }) => {
  await mockBackend(page);
  await uploadVideo(page);

  await page.locator("video").evaluate((video) => {
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 0.5,
      writable: true,
    });
    video.dispatchEvent(new Event("timeupdate"));
  });
  await page.getByRole("button", { name: "Set as start" }).click();

  await expect(page.getByText(`frames 15 – ${MOCK_UPLOAD.total_frames - 1}`)).toBeVisible();
});

test("ghost trajectory toggle redraws the canvas without reloading", async ({ page }) => {
  await completeHappyPath(page);
  const canvas = page.getByTestId("trajectory-canvas");
  const toggle = page.getByRole("button", { name: "Ghost trajectory" });
  const before = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(50);
  const after = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());

  expect(after).not.toBe(before);
  await expect(page).toHaveURL("/");
});

test("Export CSV downloads non-empty data with headers", async ({ page }) => {
  await completeHappyPath(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("CSV download did not produce a file");
  const csv = await readFile(downloadPath, "utf8");

  expect(download.suggestedFilename()).toMatch(/arclab.*\.csv/);
  expect(csv.length).toBeGreaterThan(100);
  expect(csv).toContain("frame_index,timestamp_s");
  expect(csv).toContain("velocity_x_ms");
});

test("Export PDF triggers a PDF download", async ({ page }) => {
  await completeHappyPath(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/arclab.*\.pdf/);
});

test("hovering over a trajectory point exposes frame data", async ({ page }) => {
  await completeHappyPath(page);
  const canvas = page.getByTestId("trajectory-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Trajectory canvas was not rendered");
  const point = trajectoryPoint(box, 5);

  await page.mouse.move(point.x, point.y);

  await expect(canvas).toHaveAttribute("aria-label", /frame 5.*time 0\.166 seconds/i);
});

test("clicking a trajectory point seeks to its video frame", async ({ page }) => {
  await completeHappyPath(page);
  const canvas = page.getByTestId("trajectory-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Trajectory canvas was not rendered");
  const point = trajectoryPoint(box, 5);

  await page.mouse.move(point.x, point.y);
  await expect(canvas).toHaveAttribute("aria-label", /frame 5/i);
  await page.mouse.click(point.x, point.y);

  await expect(page.getByTestId("current-frame")).toHaveText(
    `frame 5 / ${MOCK_UPLOAD.total_frames - 1}`,
  );
});
