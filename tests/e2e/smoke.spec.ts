import { expect, test, type Page } from "@playwright/test";
import { seedWorkspace } from "../../src/data/seed";
import { readFile } from "node:fs/promises";
import { newChange, submitChange, applyChange } from "../../src/core/ops.ts";

test("task maintenance separates waiting, cancelled and archived work", async ({ page }) => {
  await useDemo(page);
  await page.getByRole("button", { name: /^Tasks(?:\s|$)/ }).first().click();
  const view = page.locator('[data-view="tasks"]');
  await view.getByRole("button", {name:/^Edit task:/}).first().click();
  const form = view.getByRole("form", {name:"Edit task"});
  await form.getByLabel("Task title").fill("Verify reply before contacting");
  await form.getByLabel("Task owner").fill("Sam");
  await form.getByLabel("Task status").selectOption("waiting");
  await form.getByLabel("Task reason").fill("Review only after a sourced reply");
  await form.getByRole("button", {name:"Save task"}).click();
  await expect(view.getByText("Waiting · review dates, not send instructions")).toBeVisible();
  await view.getByRole("button", {name:"Edit task: Verify reply before contacting"}).click();
  await expect(page.getByRole("region", {name:"Notifications"}).getByText(/Demo workspace ready/)).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath("waiting-editor.png"),animations:"disabled"});
  await form.screenshot({path:test.info().outputPath("waiting-editor-fields.png"),animations:"disabled"});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await form.getByLabel("Task status").selectOption("cancelled");
  await form.getByRole("button", {name:"Save task"}).click();
  await expect(view.getByText("Cancelled", {exact:true})).toBeVisible();
  await page.getByRole("button", {name:/^Accounts(?:\s|$)/}).first().click();
  const accounts = page.locator('[data-view="accounts"]');
  await accounts.getByText("Edit account / archive", {exact:true}).click();
  await accounts.getByLabel("Archive reason").fill("No current commitment; retain the history");
  await accounts.getByRole("button", {name:"Archive account",exact:true}).click();
  await expect(accounts.getByText(/No current commitment; retain the history/)).toBeVisible();
  await page.screenshot({path:test.info().outputPath("archived-account.png"),animations:"disabled"});
  if (test.info().project.name === "chromium") {
    await nav(page,"Pipeline");
    const pipeline = page.locator('[data-view="pipeline"]');
    await pipeline.getByRole("button", {name:"New deal",exact:true}).click();
    const deal = pipeline.locator("form");
    await expect(deal.getByRole("combobox",{name:"Account",exact:true})).not.toHaveValue(seedWorkspace.accounts[0].id);
    await deal.getByLabel("Deal name").fill("Visible active-account deal");
    await deal.getByRole("button", {name:"Add",exact:true}).click();
    await expect(pipeline.getByText("Visible active-account deal",{exact:true})).toBeVisible();
    await nav(page,"Accounts");
  }
  await accounts.getByText("Edit account / archive", {exact:true}).click();
  await accounts.getByLabel("Archive reason").fill("New sourced conversation");
  await accounts.getByRole("button", {name:"Restore account",exact:true}).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("zentrik-open-crm.workspace.v2")!));
  expect(saved.accounts[0].archivedAt).toBeUndefined();
  expect(saved.tasks.find((t:{title:string}) => t.title === "Verify reply before contacting").completedAt).toBeUndefined();
});

test("full backup storage requires a downloaded-original confirmation before recovery", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Desktop recovery failure path.");
  await page.evaluate(() => localStorage.setItem("zentrik-open-crm.workspace.v2", "{original for recovery"));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.includes(".recovery.")) throw new DOMException("Synthetic full backup storage", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.reload();
  const file = {name:"backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(seedWorkspace))};
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(file);
  await expect(page.getByRole("alert")).toContainText("Recovery did not complete");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name:"Download stored original"}).click();
  const downloaded = await downloadPromise;
  expect(await readFile((await downloaded.path())!, "utf8")).toBe("{original for recovery");
  await page.getByRole("checkbox", {name:/I have saved the original/}).check();
  await input.setInputFiles(file);
  await expect(page.getByRole("heading", {name:"Open CRM Workspace"})).toBeVisible();
});

test.describe("local calendar dates", () => {
  test.use({timezoneId:"America/Los_Angeles"});
  test("task editor preserves the local day when saving unrelated changes", async ({ page }) => {
    const fixture = structuredClone(seedWorkspace);
    fixture.tasks[0].due = "2026-10-03T06:59:59.000Z";
    fixture.tasks[0].title = "Local date check";
    await page.evaluate(data => localStorage.setItem("zentrik-open-crm.workspace.v2",JSON.stringify(data)),fixture);
    await page.reload();
    await page.getByRole("button", {name:/^Tasks(?:\s|$)/}).first().click();
    await page.getByRole("button", {name:"Edit task: Local date check"}).click();
    const form = page.getByRole("form", {name:"Edit task"});
    await expect(form.getByLabel("Task date")).toHaveValue("2026-10-02");
    await form.getByLabel("Task owner").fill("Alex");
    await form.getByRole("button", {name:"Save task"}).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("zentrik-open-crm.workspace.v2")!));
    expect(stored.tasks[0].due).toBe("2026-10-03T06:59:59.000Z");
  });
});

test("corrupt browser records are preserved and recovery import backs up the original", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("zentrik-open-crm.workspace.v2", "{broken original"));
  await page.reload();
  await expect(page.getByRole("alert").filter({hasText:"Stored workspace is invalid"})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("zentrik-open-crm.workspace.v2"))).toBe("{broken original");
  await page.screenshot({path:test.info().outputPath("storage-recovery.png"),animations:"disabled"});
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(seedWorkspace))});
  await expect(page.getByRole("heading", {name:"Open CRM Workspace"})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("zentrik-open-crm.workspace.v2.recovery.1"))).toBe("{broken original");
});

test("stale proposals expose the conflict and cannot overwrite current ownership", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Review desktop path.");
  const request = newChange({type:"account.update",accountId:seedWorkspace.accounts[0].id,patch:{owner:"Sam"}}, {kind:"agent",name:"Example operator"});
  const pending = submitChange(structuredClone(seedWorkspace),request).workspace;
  const current = applyChange(pending,newChange({type:"account.update",accountId:seedWorkspace.accounts[0].id,patch:{owner:"Alex"}})).workspace;
  await page.evaluate(data => localStorage.setItem("zentrik-open-crm.workspace.v2",JSON.stringify(data)),current);
  await page.reload();
  await nav(page,"Review");
  const view = page.locator('[data-view="review"]');
  await expect(view.getByText(/changed since it was prepared/)).toBeVisible();
  await expect(view.getByRole("button",{name:"Approve",exact:true})).toBeDisabled();
  await page.screenshot({path:test.info().outputPath("stale-proposal.png"),animations:"disabled"});
  await view.getByRole("button",{name:"Reject",exact:true}).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("zentrik-open-crm.workspace.v2")!).accounts[0].owner)).toBe("Alex");
});

test("task ownership, completion coverage and calendar export have the same scope", async ({ page }) => {
  const fixture = structuredClone(seedWorkspace);
  fixture.accounts[0].owner = "Alex";
  fixture.accounts[1].owner = "Sam";
  const base = fixture.tasks[0];
  fixture.tasks = [
    {...base, id:"task_alex", title:"Alex review", owner:"Alex", status:"open"},
    {...base, id:"task_sam", title:"Sam review", owner:"Sam", status:"open"},
    ...Array.from({length:10}, (_,i) => ({...base, id:`task_done_${i}`, title:`Completed example ${i}`, owner:"Sam", status:"done" as const, completedAt:new Date().toISOString()})),
  ];
  await page.evaluate((data) => localStorage.setItem("zentrik-open-crm.workspace.v2", JSON.stringify(data)), fixture);
  await page.reload();
  if (test.info().project.name === "mobile-chrome") await page.getByRole("button", {name:"Tasks", exact:true}).click();
  else await nav(page, "Tasks");
  const view = page.locator('[data-view="tasks"]');
  await view.getByLabel("Filter by owner").selectOption("Sam");
  await expect(view.getByText("Alex review", {exact:true})).toHaveCount(0);
  await expect(view.getByText("Sam review", {exact:true})).toBeVisible();
  await expect(view.getByText("8 of 10", {exact:true})).toBeVisible();
  await view.getByRole("button", {name:"Show all 10 completed tasks"}).click();
  await expect(view.getByText(/^Completed example /)).toHaveCount(10);
  const downloadPromise = page.waitForEvent("download");
  await view.getByRole("button", {name:"Export 1 to calendar"}).click();
  const download = await downloadPromise;
  const calendar = await readFile((await download.path())!, "utf8");
  expect(calendar).toContain("Sam review");
  expect(calendar).not.toContain("Alex review");
  expect(calendar).not.toContain("Completed example");
  await view.getByRole("button", {name:"New task"}).click();
  const form = view.locator("form");
  await form.getByLabel("Account", {exact:true}).selectOption(fixture.accounts[1].id);
  await form.getByLabel("Task", {exact:true}).fill("Selected account ownership");
  await expect(form.getByRole("textbox", {name:/^Owner/})).toHaveAttribute("placeholder", "Sam");
  await page.screenshot({path:test.info().outputPath("team-task-form.png"), animations:"disabled"});
  await form.getByRole("button", {name:"Add",exact:true}).click();
  await expect(view.getByText("Selected account ownership", {exact:true})).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("zentrik-open-crm.workspace.v2")!));
  expect(stored.tasks.find((task: {title:string}) => task.title === "Selected account ownership").owner).toBe("Sam");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", {name:"Toggle theme"}).click();
  await page.screenshot({path:test.info().outputPath("team-task-queue-dark.png"), animations:"disabled"});
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

/** Click a sidebar nav item by its label (names carry a trailing count). */
function nav(page: Page, label: string) {
  return page.locator("aside").getByRole("button", { name: label }).first().click();
}

async function useDemo(page: Page) {
  await expect(page.getByRole("heading", { name: "Start with one relationship worth remembering." })).toBeVisible();
  await page.getByRole("button", { name: "Explore with demo data" }).click();
}

test("navigates the CRM surfaces and redacts in share-safe mode", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Desktop flow runs in the desktop project.");
  const vw = (name: string) => page.locator(`[data-view="${name}"]`);

  await useDemo(page);

  await expect(page.getByRole("heading", { name: "Open CRM Workspace" })).toBeVisible();
  await expect(vw("home").getByText(/5 open tasks, [1-5] due soon/)).toBeVisible();
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
  await expect(vw("accounts").getByText("Use any agent with explicit context")).toBeVisible();
  await expect(vw("accounts").getByRole("button", { name: "Copy agent handoff" })).toBeEnabled();

  await page.getByRole("button", { name: "Private", exact: true }).click();
  await expect(page.getByRole("button", { name: "Share-safe" })).toBeVisible();
  await expect(vw("accounts").getByText("$42K")).toHaveCount(0);
  await expect(vw("accounts").getByText("hidden").first()).toBeVisible();
  await expect(vw("accounts").getByRole("button", { name: "Copy agent handoff" })).toBeDisabled();
  await expect(vw("accounts").getByRole("button", { name: "Copy as Markdown" })).toBeDisabled();
  await page.getByRole("button", { name: "Share-safe" }).click();

  await page.keyboard.press("Meta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("Meridian");
  await expect(palette.getByRole("option", { name: /Meridian/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await nav(page, "Settings");
  await expect(vw("settings").getByRole("heading", { name: "Agent workspace" })).toBeVisible();
  await expect(vw("settings").getByRole("heading", { name: "Optional in-app AI" })).toBeVisible();
  await expect(vw("settings").getByText(/CLI agents cannot see this browser's local storage/i)).toBeVisible();
  const download = page.waitForEvent("download");
  await vw("settings").getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("open-crm-workspace.json");
});

test("creates a local account + contact + note that persist, then resets", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Setup flow runs in the desktop project.");

  const setup = page.locator("form", { has: page.getByRole("button", { name: "Create workspace" }) });
  await setup.getByLabel("Workspace name").fill("Atlas CRM");
  await setup.getByLabel("Account name").fill("Atlas Foundry");
  await setup.getByLabel("Domain").fill("atlas-foundry.example");
  await setup.getByLabel("Relationship").fill("Design partner");
  await setup.getByLabel("Owner").fill("Rae");
  await setup.getByLabel("Name", { exact: true }).fill("Marta Silva");
  await setup.getByLabel("Role", { exact: true }).fill("Founder");
  await setup.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByText("First useful loop")).toBeVisible();
  await nav(page, "Accounts");

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
  const noteForm = page.locator("form", { has: page.getByRole("button", { name: "Add source note" }) });
  await noteForm.getByLabel("Account").selectOption({ label: "Atlas Foundry" });
  await noteForm.getByLabel("Contact").selectOption({ label: "Marta Silva · Founder" });
  await noteForm.getByLabel("Source reference").fill("Founder onboarding call · Aug 31");
  await noteForm.getByLabel("Title").fill("Onboarding workspace created");
  await noteForm.getByLabel("Body").fill("Founder created the first workspace and asked for a clearer CSV import path.");
  await noteForm.getByRole("button", { name: "Add source note" }).click();
  await expect(page.getByRole("heading", { name: "Onboarding workspace created" })).toBeVisible();

  // Choose the first concrete action and complete the first useful loop.
  await nav(page, "Tasks");
  await page.getByRole("button", { name: "New task" }).click();
  const taskForm = page.locator("form", { has: page.getByLabel("Task") });
  await taskForm.getByLabel("Task").fill("Review CSV import examples");
  await taskForm.getByLabel("Account").selectOption({ label: "Atlas Foundry" });
  await taskForm.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator('[data-view="tasks"]').getByText("Review CSV import examples")).toBeVisible();

  await nav(page, "Home");
  await expect(page.getByText("First useful loop")).toHaveCount(0);

  // The account handoff contains the source, the action, and the human-review contract.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await nav(page, "Accounts");
  await page.getByRole("button", { name: "Copy agent handoff" }).click();
  const handoff = await page.evaluate(() => navigator.clipboard.readText());
  expect(handoff).toContain("Founder onboarding call · Aug 31");
  expect(handoff).toContain("Review CSV import examples");
  expect(handoff).toContain("Separate recorded facts from inference");

  // Settings explains the visual-to-CLI bridge and provides a provider-neutral request.
  await nav(page, "Settings");
  await expect(page.getByRole("heading", { name: "Agent workspace" })).toBeVisible();
  await expect(page.getByText("The snapshot is one-way", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Copy starter request" }).click();
  const starter = await page.evaluate(() => navigator.clipboard.readText());
  expect(starter).toContain("Read _agent-guide.md");
  expect(starter).toContain("Return a concise review for approval");

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

test("exports an agent-readable snapshot with its contract and source references", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Agent workspace export runs in the desktop project.");

  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true });
  });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await useDemo(page);
  await nav(page, "Settings");

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown snapshot" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("open-crm-vault.md");

  const stream = await download.createReadStream();
  let markdown = "";
  for await (const chunk of stream) markdown += chunk.toString();
  expect(markdown).toContain("<!-- _agent-guide.md -->");
  expect(markdown).toContain("The visual CRM in the browser remains the source of truth");
  expect(markdown).toContain("Read _agent-guide.md, _index.md");
  expect(markdown).toContain("Source reference: Call summary");
});

test("first-run and account work fit a mobile viewport", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-chrome", "Responsive flow runs in the mobile project.");

  await expect(page.getByRole("heading", { name: "Start with one relationship worth remembering." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );

  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
});

test("imports an Open CRM backup from first-run setup", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Import flow runs in the desktop project.");

  const imported = structuredClone(seedWorkspace);
  imported.name = "Imported workspace";
  imported.accounts[0].name = "Imported account";

  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: "open-crm-workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });

  await expect(page.getByRole("heading", { name: "Imported workspace" })).toBeVisible();
  await nav(page, "Accounts");
  await expect(page.getByRole("heading", { name: "Imported account" })).toBeVisible();
});
