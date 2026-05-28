import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("supports the core CRM workflow on desktop", async ({ context, page }) => {
  test.skip(test.info().project.name !== "chromium", "Desktop workflow runs only in the desktop project.");

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:5177",
  });

  await expect(page.getByRole("heading", { name: "Zentrik Open CRM Demo" })).toBeVisible();
  await expect(page.getByText("Daily Account Board")).toBeVisible();

  await page.getByRole("button", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  await expect(page.getByText("Annual value")).toBeVisible();

  await page.getByRole("button", { name: "Private" }).click();
  await expect(page.getByRole("button", { name: "Buildroom" })).toBeVisible();
  await expect(page.getByText("Domain hidden in Buildroom mode")).toBeVisible();
  await expect(page.getByText("Annual value").locator("..")).toContainText("Hidden");
  await expect(page.getByRole("button", { name: /Northstar Robotics/ })).toContainText("Hidden");

  await page.getByPlaceholder("Search accounts, risks, needs").fill("no matching account");
  await expect(page.getByText("No accounts match the current search.")).toBeVisible();
  await page.getByPlaceholder("Search accounts, risks, needs").fill("");

  await page.getByRole("button", { name: "Signals" }).click();
  await page.getByLabel("Title").fill("Trial user asked for Gmail connector");
  await page
    .getByLabel("Body")
    .fill("They want email context summarized into account memory before a follow-up is drafted.");
  await page.getByRole("button", { name: "Add signal" }).click();
  await expect(page.getByText("Trial user asked for Gmail connector")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("");

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByText("Weighted pipeline").locator("../..")).toContainText("Hidden");
  await page.getByRole("button", { name: "Done" }).first().click();
  await expect(page.getByText("Open next actions").locator("../..")).toContainText("3");

  await page.getByRole("button", { name: "Open CRM Loop" }).click();
  await page.getByRole("button", { name: "Advance" }).first().click();
  await expect(page.getByText("Idea advanced from workspace review")).toBeVisible();

  await page.getByRole("button", { name: "Codex" }).click();
  await page.getByRole("button", { name: "Copy prompt" }).first().click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedPrompt).toContain("domain hidden in Buildroom mode");
  expect(copiedPrompt).not.toContain("harbor-reed.invalid");

  await page.getByRole("button", { name: "Settings" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zentrik-open-crm-workspace.json");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByText("Open next actions").locator("../..")).toContainText("4");
});

test("keeps primary navigation usable on mobile", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-chrome", "Mobile workflow runs only in the mobile project.");

  await expect(page.getByRole("heading", { name: "Zentrik Open CRM Demo" })).toBeVisible();
  await page.getByRole("button", { name: "Signals" }).click();
  await expect(page.getByRole("heading", { name: "Capture Signal" })).toBeVisible();
  await page.getByRole("button", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  await page.getByRole("button", { name: "Codex" }).click();
  await expect(page.getByRole("heading", { name: "Codex Task Queue" })).toBeVisible();
});
