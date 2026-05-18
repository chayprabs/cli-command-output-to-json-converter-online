import { expect, test } from "@playwright/test";

test("home shows privacy notice and input panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText("never stored");
  await expect(page.getByRole("heading", { name: "Raw CLI output" })).toBeVisible();
});

test("legal pages render", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/credits"] as const) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to ParseDeck/i })).toBeVisible();
  }
});

test("parser catalog loads from API", async ({ request }) => {
  const response = await request.get("/api/parsers");
  expect(response.ok()).toBeTruthy();
  const parsers = await response.json();
  expect(Array.isArray(parsers)).toBeTruthy();
  expect(parsers.length).toBeGreaterThanOrEqual(50);
});
