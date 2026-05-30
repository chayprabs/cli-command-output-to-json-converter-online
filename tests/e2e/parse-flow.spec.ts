import { expect, test } from "@playwright/test";

test("full parse flow: select ls, paste sample, get JSON", async ({ page }) => {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/parsers") && response.status() === 200,
    ),
    page.goto("/"),
  ]);

  await page.getByRole("button", { name: /select a parser/i }).click();
  await page.getByPlaceholder("Filter parsers").fill("ls");

  await page
    .locator('[role="option"]')
    .filter({ has: page.locator(".parser-select__option-name", { hasText: /^ls$/ }) })
    .first()
    .click();

  const sample = `total 8
drwxr-xr-x 2 user user 4096 Apr  1 10:00 .
drwxr-xr-x 3 user user 4096 Apr  1 09:00 ..
-rw-r--r-- 1 user user   12 Apr  1 10:00 file.txt`;

  await page.locator("#raw-input").fill(sample);

  await expect(page.getByRole("button", { name: "Parse output" })).toBeEnabled();

  await page.getByRole("button", { name: "Parse output" }).click();

  await expect(page.locator(".result-panel__scroller")).toContainText("file.txt", {
    timeout: 30_000,
  });
});

test("load sample and parse options are available", async ({ page }) => {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/parsers") && response.status() === 200,
    ),
    page.goto("/"),
  ]);

  await expect(page.getByRole("group", { name: "Parse options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load sample" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Upload file" })).toBeEnabled();

  await page.getByRole("button", { name: /select a parser/i }).click();
  await page.getByPlaceholder("Filter parsers").fill("ls");
  await page
    .locator('[role="option"]')
    .filter({ has: page.locator(".parser-select__option-name", { hasText: /^ls$/ }) })
    .first()
    .click();

  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(page.locator("#raw-input")).not.toHaveValue("");
});
