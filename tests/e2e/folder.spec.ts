import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..", "..");
const workspaceDir = path.join(root, "test-results", "folder-workspace");

/** Run the crm command the way an agent's shell would: not a terminal, named. */
function crm(...args: string[]) {
  return execFileSync(process.execPath, [path.join(root, "bin", "open-crm.js"), "--workspace", workspaceDir, ...args, "--as", "test-agent"], { encoding: "utf8" });
}
const onDisk = () => JSON.parse(fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8"));

test("an agent's change arrives live, waits for approval, and lands in the folder", async ({ page }) => {
  await page.goto("/");
  // A folder that already has accounts opens straight into the CRM.
  await expect(page.getByRole("heading", { name: "Folder workspace" })).toBeVisible();

  const out = crm("note", "add", "--account", "northstar", "--source", "email", "--ref", "inbox/thread.eml", "--title", "Legal wants a data-flow diagram", "--body", "Eli forwarded the request from legal.");
  expect(out).toContain("Proposed");
  expect(onDisk().notes.some((n: { title: string }) => n.title === "Legal wants a data-flow diagram")).toBe(false);

  // The open app hears about it without a reload.
  await expect(page.getByText("test-agent proposed a change", { exact: false }).first()).toBeVisible();
  await page.locator("aside").getByRole("button", { name: /Review/ }).click();
  await expect(page.getByText("inbox/thread.eml", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();

  await expect.poll(() => onDisk().notes.some((n: { title: string }) => n.title === "Legal wants a data-flow diagram")).toBe(true);
  expect(fs.readFileSync(path.join(workspaceDir, "accounts", "northstar-robotics.md"), "utf8")).toContain("Legal wants a data-flow diagram");
  await expect(page.getByText("approved by you", { exact: false })).toBeVisible();
});

test("a person's change in the app is what the agent reads next", async ({ page }) => {
  await page.goto("/");
  await page.locator("aside").getByRole("button", { name: /Tasks/ }).click();
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByPlaceholder("Send recap email").fill("Call Eli about the pilot scope");
  await page.getByPlaceholder("Send recap email").press("Enter");

  await expect.poll(() => crm("tasks", "--json")).toContain("Call Eli about the pilot scope");
  expect(crm("check")).toContain("Records are valid");
});
