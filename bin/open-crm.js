#!/usr/bin/env node
// Entry point for the `crm` command. Plain JavaScript so it can say something
// useful on a Node that is too old to run the TypeScript sources directly.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`Open CRM needs Node 22.18 or newer (this is ${process.versions.node}). Install a current Node from https://nodejs.org and try again.`);
  process.exit(1);
}
const { main } = await import("../cli/main.ts");
await main(process.argv.slice(2));
