import { brand } from "./brand";

export const localWorkspaceSetup = [
  `git clone ${brand.repoUrl}.git`,
  "cd zentrik-open-crm",
  "npm install",
  "npm run crm -- init ~/my-crm",
  "cd ~/my-crm",
  "./crm ui",
].join("\n");

export const setupGuideUrl = `${brand.repoUrl}#start-in-two-minutes`;
