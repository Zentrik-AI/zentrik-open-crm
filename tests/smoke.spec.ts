import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

/** Click a sidebar nav item by its label (names carry a trailing count). */
function nav(page: Page, label: string) {
  return page.locator("aside").getByRole("button", { name: label }).first().click();
}

test("navigates the CRM surfaces and redacts in share-safe mode", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Desktop flow runs in the desktop project.");
  const vw = (name: string) => page.locator(`[data-view="${name}"]`);

  await expect(page.getByRole("heading", { name: "Open CRM Workspace" })).toBeVisible();
  await expect(vw("home").getByText("Weighted pipeline")).toBeVisible();
  await expect(vw("home").getByRole("heading", { name: "Today" })).toBeVisible();

  await nav(page, "Pipeline");
  await expect(vw("pipeline").getByRole("heading", { name: "Pipeline" })).toBeVisible();
  await expect(vw("pipeline").getByText("Open deals")).toBeVisible();
  await expect(vw("pipeline").getByText("Negotiation").first()).toBeVisible();

  await nav(page, "Contacts");
  await expect(vw("contacts").getByRole("heading", { name: "Contacts" })).toBeVisible();
  await expect(vw("contacts").getByText("Eli Moreno").first()).toBeVisible();

  await nav(page, "Tasks");
  await expect(vw("tasks").getByRole("heading", { name: "Tasks" })).toBeVisible();
  await vw("tasks").getByRole("button", { name: "Mark done" }).first().click();
  await expect(page.getByText(/^Done ·/)).toBeVisible();

  await nav(page, "Notes");
  await expect(vw("notes").getByText("Capture note")).toBeVisible();

  await nav(page, "Improve Open CRM");
  await expect(vw("improve").getByRole("heading", { name: "Help shape the product" })).toBeVisible();

  await nav(page, "Accounts");
  await expect(vw("accounts").getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  await expect(vw("accounts").getByText("$42K").first()).toBeVisible();

  await page.getByRole("button", { name: "Private", exact: true }).click();
  await expect(page.getByRole("button", { name: "Share-safe" })).toBeVisible();
  await expect(vw("accounts").getByText("$42K")).toHaveCount(0);
  await expect(vw("accounts").getByText("hidden").first()).toBeVisible();
  await page.getByRole("button", { name: "Share-safe" }).click();

  await page.keyboard.press("Meta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("Meridian");
  await expect(palette.getByRole("option", { name: /Meridian/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await nav(page, "Settings");
  await expect(vw("settings").getByRole("heading", { name: "AI & API keys" })).toBeVisible();
  await expect(vw("settings").getByText(/Markdown vault/i).first()).toBeVisible();
  const download = page.waitForEvent("download");
  await vw("settings").getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("open-crm-workspace.json");
});

test("creates a local account + contact + note that persist, then resets", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Setup flow runs in the desktop project.");

  await nav(page, "Accounts");
  const addForm = page.locator("form", { has: page.getByRole("button", { name: "Add account", exact: true }) });
  await addForm.getByLabel("Account name").fill("Atlas Foundry");
  await addForm.getByLabel("Domain").fill("atlas-foundry.example");
  await addForm.getByLabel("Segment").fill("Design partner");
  await addForm.getByLabel("Owner").fill("Rae");
  await addForm.getByLabel("Primary contact").fill("Marta Silva");
  await addForm.getByLabel("Contact role").fill("Founder");
  await addForm.getByRole("button", { name: "Add account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeVisible();
  await expect(page.getByText("atlas-foundry.example")).toBeVisible();

  // Add a second contact via the account's contacts panel
  const contactForm = page.locator("form", { has: page.getByLabel("Influence") });
  await contactForm.getByLabel("Name", { exact: true }).fill("Noah Reed");
  await contactForm.getByLabel("Role", { exact: true }).fill("Technical evaluator");
  await contactForm.getByLabel("Influence").selectOption("technical");
  await contactForm.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Noah Reed").first()).toBeVisible();

  // Capture a note against the new account
  await nav(page, "Notes");
  const noteForm = page.locator("form", { has: page.getByRole("button", { name: "Add note" }) });
  await noteForm.getByLabel("Account").selectOption({ label: "Atlas Foundry" });
  await noteForm.getByLabel("Title").fill("Onboarding workspace created");
  await noteForm.getByLabel("Body").fill("Founder created the first workspace and asked for a clearer CSV import path.");
  await noteForm.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("heading", { name: "Onboarding workspace created" })).toBeVisible();

  // Persistence across reload
  await page.reload();
  await nav(page, "Accounts");
  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeVisible();

  // Reset (two-step confirm)
  await nav(page, "Settings");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Reset everything" }).click();
  await nav(page, "Accounts");
  await expect(page.getByRole("heading", { name: "Atlas Foundry" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
});
