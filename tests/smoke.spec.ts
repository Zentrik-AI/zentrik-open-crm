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
  await expect(page.getByText("Start with source-grounded account work")).toBeVisible();
  await expect(page.getByText("Daily Account Board")).toBeVisible();

  await page.getByRole("button", { name: /Capture a signal/ }).click();
  await expect(page.getByRole("heading", { name: "Capture Signal" })).toBeVisible();

  await page.getByRole("button", { name: "Accounts", exact: true }).click();
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

  await page.getByRole("button", { name: "Signals", exact: true }).click();
  await page.getByLabel("Title").fill("Trial user asked for Gmail connector");
  await page
    .getByLabel("Body")
    .fill("They want email context summarized into account memory before a follow-up is drafted.");
  await page.getByRole("button", { name: "Add signal" }).click();
  await expect(page.getByText("Trial user asked for Gmail connector")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("");

  await page.getByRole("button", { name: "Tell Open CRM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell Open CRM" })).toBeVisible();
  await page.getByRole("button", { name: /Buildroom request/ }).click();
  await page.getByLabel("Workflow area").selectOption("Privacy");
  await page
    .getByLabel("Feedback title")
    .fill("Public mode should explain what will be hidden");
  await page
    .getByLabel("What happened, and what should be better?")
    .fill("When I switch into Buildroom mode, I need a clearer summary of which account fields are hidden before I share anything externally.");
  await page.getByRole("button", { name: "Send through loop" }).click();
  await expect(
    page.getByRole("heading", { name: "Public mode should explain what will be hidden" }),
  ).toBeVisible();
  await expect(page.getByText("Feedback became an idea candidate")).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText("Weighted pipeline").locator("../..")).toContainText("Hidden");
  await page.getByRole("button", { name: "Done" }).first().click();
  await expect(page.getByText("Open next actions").locator("../..")).toContainText("3");

  await page.getByRole("button", { name: "Open CRM Loop", exact: true }).click();
  await page.getByRole("button", { name: "Advance" }).first().click();
  await expect(page.getByText("Idea advanced from workspace review")).toBeVisible();

  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.getByText("Triage feedback: Public mode should explain what will be hidden")).toBeVisible();
  await page.getByRole("button", { name: "Copy prompt" }).first().click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedPrompt).toContain("domain hidden in Buildroom mode");
  expect(copiedPrompt).not.toContain("harbor-reed.invalid");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zentrik-open-crm-workspace.json");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText("Open next actions").locator("../..")).toContainText("4");
});

test("supports local account setup, contacts, persistence, and reset", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Setup workflow runs only in the desktop project.");

  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add account" })).toBeVisible();

  await page.getByLabel("Account name").fill("Atlas Foundry");
  await page.getByLabel("Domain").fill("atlas-foundry.example");
  await page.getByLabel("Segment").fill("Design partner");
  await page.getByLabel("Owner").fill("Rae");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("First next action").fill("Schedule onboarding review");
  await page.getByLabel("Primary contact").fill("Marta Silva");
  await page.getByLabel("Contact role").fill("Founder");
  await page.getByRole("button", { name: "Add account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeVisible();
  await expect(page.getByText("atlas-foundry.example")).toBeVisible();
  await expect(page.getByText("Marta Silva")).toBeVisible();
  await expect(page.getByText("Schedule onboarding review")).toBeVisible();

  await page.getByLabel("Contact name").fill("Noah Reed");
  await page.getByLabel("Role", { exact: true }).fill("Technical evaluator");
  await page.getByLabel("Influence").selectOption("technical");
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText("Noah Reed")).toBeVisible();

  await page.getByRole("button", { name: "Signals", exact: true }).click();
  await page.getByLabel("Account").selectOption({ label: "Atlas Foundry" });
  await page.getByLabel("Source").selectOption("usage");
  await page.getByLabel("Title").fill("Onboarding workspace created");
  await page
    .getByLabel("Body")
    .fill("The founder created the first workspace and asked for a clearer CSV import path.");
  await page.getByRole("button", { name: "Add signal" }).click();
  await expect(page.getByText("Onboarding workspace created")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeVisible();
  await expect(page.getByText("Noah Reed")).toBeVisible();
  await expect(page.getByText("Onboarding workspace created")).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
});

test("routes private feedback and GitHub-ready feedback differently", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Feedback routing runs only in the desktop project.");

  await page.getByRole("button", { name: "Tell Open CRM", exact: true }).click();
  await page.getByLabel("Feedback title").fill("Keyboard workflow feels hidden");
  await page
    .getByLabel("What happened, and what should be better?")
    .fill("I wanted to move from account review into signal capture without hunting through the nav.");
  await page.getByRole("button", { name: "Send through loop" }).click();
  await expect(page.getByRole("heading", { name: "Capture Signal" })).toBeVisible();
  await expect(page.getByText("Keyboard workflow feels hidden")).toBeVisible();

  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.getByText("Triage feedback: Keyboard workflow feels hidden")).toBeHidden();

  await page.getByRole("button", { name: "Tell Open CRM", exact: true }).click();
  await page.getByRole("button", { name: /GitHub issue/ }).click();
  await page.getByLabel("Workflow area").selectOption("Self-hosting");
  await page.getByLabel("Feedback title").fill("Preview command should document the port");
  await page
    .getByLabel("What happened, and what should be better?")
    .fill("Running preview worked, but the expected local URL should be explicit in the docs.");
  await page.getByRole("button", { name: "Send through loop" }).click();
  await expect(
    page.getByRole("heading", { name: "Preview command should document the port" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.getByText("Triage feedback: Preview command should document the port")).toBeVisible();
});

test("keeps primary navigation usable on mobile", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-chrome", "Mobile workflow runs only in the mobile project.");

  await expect(page.getByRole("heading", { name: "Zentrik Open CRM Demo" })).toBeVisible();
  await expect(page.getByText("Start with source-grounded account work")).toBeVisible();
  await page.getByRole("button", { name: "Tell Open CRM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell Open CRM" })).toBeVisible();
  await page.getByRole("button", { name: "Signals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capture Signal" })).toBeVisible();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Codex Task Queue" })).toBeVisible();
});
