import {test,expect} from "@playwright/test";
const notes="Northstar Robotics: We sent the local-first security explainer and workspace checklist.\nMeridian Health: Security review is cleared for the renewal.\nFieldstack: We still need to avoid bloated CRM administration.\nCivicGrid: We need offline access for field visits.\nThey approved it.";
test("one screen investigates multiple accounts and applies only reviewed changes",async({page,request})=>{
  await page.setViewportSize({width:1600,height:900});await page.goto("/");
  await page.locator("aside").getByRole("button",{name:"Update accounts",exact:true}).click();
  const view=page.getByRole("region",{name:"Account investigation",exact:true});
  const connect=view.getByRole("button",{name:"Connect Jev",exact:true});
  if(await connect.isVisible()){await view.getByLabel("Jev API key",{exact:true}).fill("fixture-key");await connect.click();await expect(connect).toBeHidden();}
  await view.getByLabel("What happened across your accounts?").fill(notes);
  await view.getByLabel("Send selected notes and account context to TypeSafe.").check();
  await view.getByRole("button",{name:"Investigate notes",exact:true}).click();
  await expect(view.getByText("3 changes · 1 unchanged · 1 to clarify",{exact:true})).toBeVisible();
  const accounts=view.getByRole("region",{name:"Affected accounts"});
  await accounts.getByRole("button",{name:/Meridian/}).click();
  await expect(view.getByRole("heading",{name:"Resolve risk",exact:true})).toBeVisible();
  await expect(view.getByText("Security review must clear before renewal signs",{exact:true})).toBeVisible();
  // The desktop shell stays fixed; only the source and result panes scroll.
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2)).toBe(true);
  await page.screenshot({path:"test-results/investigation-desktop.png",animations:"disabled"});
  const changes=view.getByRole("region",{name:"Account changes"});
  await changes.getByRole("button",{name:"Apply this change",exact:true}).click();
  await expect(changes.getByRole("heading",{name:"Applied · Resolve risk"})).toBeVisible();
  await accounts.getByRole("button",{name:/Northstar/}).click();
  await expect(changes.getByText("Send local-first security explainer + workspace checklist",{exact:true})).toBeVisible();
  await changes.getByRole("button",{name:"Apply this change",exact:true}).click();
  await expect(view.getByText("2 applied to CRM",{exact:true})).toBeVisible();
  await accounts.getByRole("button",{name:/Fieldstack/}).click();
  await expect(changes.getByText("Already known — leave unchanged",{exact:true})).toBeVisible();
  await expect(changes.getByRole("button",{name:"Apply this change"})).toHaveCount(0);
  await accounts.getByRole("button",{name:/Unassigned evidence/}).click();
  await expect(changes.getByText("Which account does this refer to?",{exact:true})).toBeVisible();
  await accounts.getByRole("button",{name:/CivicGrid/}).click();
  await page.getByRole("button",{name:"Toggle theme"}).click();
  await page.screenshot({path:"test-results/investigation-dark.png",animations:"disabled"});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await changes.scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/investigation-mobile.png",animations:"disabled"});
  const state=await(await request.get("/api/workspace")).json();
  expect(state.workspace.tasks.find((t:any)=>t.id==="task_northstar_security").status).toBe("done");
  expect(state.workspace.claims.find((c:any)=>c.id==="claim_meridian_security").status).toBe("superseded");
  expect(state.workspace.claims.filter((c:any)=>c.text.includes("offline access"))).toHaveLength(0);
  expect(JSON.stringify(state)).not.toContain("fixture-key");
  // Imported sources use the same path and retain no-op decisions on a rerun.
  await view.getByRole("button",{name:"Imported calls",exact:true}).click();
  await view.getByLabel("Pasted notes",{exact:true}).check();
  await view.getByRole("button",{name:"Investigate 1 calls",exact:true}).click();
  await expect(view.getByText("1 changes · 3 unchanged · 1 to clarify",{exact:true})).toBeVisible();
});
