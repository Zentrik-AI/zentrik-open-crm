// Test-only provider double. Never enabled by the production CLI or Vite config.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
const root = path.resolve(import.meta.dirname,"../..");
const workspace = path.join(os.tmpdir(),`open-crm-calls-e2e-${process.argv[2]}`);
fs.rmSync(workspace,{recursive:true,force:true});
execFileSync(process.execPath,[path.join(root,"bin/open-crm.js"),"init",workspace,"--demo"],{stdio:"ignore"});
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url=String(input);
  if(url.startsWith("https://api.typesafe.ai/")) {
    if(url.endsWith("models")) return Response.json({models:[]});
    const body=JSON.parse(init.body);
    if (JSON.stringify(body.state).includes("FAILING_FIXTURE")) return new Response("test only",{status:401});
    if(body.state.purpose === "match_accounts" || body.state.purpose === "decide_updates") {
      if(process.env.RECORD_INVESTIGATION === "1")await new Promise(r=>setTimeout(r,600));
      const answers={};
      if(body.state.purpose === "match_accounts")for(const p of body.state.passages){
        const choice=p.text.startsWith("Northstar")?"acct_northstar":p.text.startsWith("Meridian")?"acct_meridian":p.text.startsWith("Fieldstack")?"acct_fieldstack":p.text.startsWith("CivicGrid")?"acct_civicgrid":"ambiguous";
        answers[p.id]={type:"choice",choice,confidence:0.98};
      } else {
        const text=body.state.passage.text;
        const choice=text.startsWith("Northstar")?"complete_task_northstar_security":text.startsWith("Meridian")?"resolve_claim_meridian_security":text.startsWith("Fieldstack")?"known_claim_fieldstack_admin":"add_need";
        answers.action={type:"choice",choice,confidence:0.98};
        answers.qualification={type:"choice",choice:text.includes("if approved")?"conditional":"explicit",confidence:0.98};
      }
      return Response.json({model:"fixture-provider (test only)",answers});
    }
    // Deterministic test answers for the fictional workshop corpus, not inference.
    return Response.json({model:"fixture-provider (test only)",answers:Object.fromEntries(Object.keys(body.questions).map(k=>{
      const text=body.state.transcriptPassages.find(p=>p.id===k.split("_")[0])?.text ?? "";
      const kind=/We need/i.test(text)?"need":/could pilot|I will /i.test(text)?"commitment":/Our goal/i.test(text)?"goal":/no approved budget|different versions/i.test(text)?"risk":"ignore";
      return [k,{type:"choice",choice:k.endsWith("certainty")?(/if |after you|could pilot/i.test(text)?"conditional":"explicit"):kind,confidence:0.87}];
    }))});
  }
  if(url.startsWith("https://public-api.granola.ai/")) {
    if(url.includes("not_")) return Response.json({title:"Synthetic pilot call",transcript:[{speaker:{source:"speaker"},text:"We need a clearer audit trail."},{speaker:{source:"speaker"},text:"We could pilot if security approves."}]});
    return Response.json({notes:[{id:"not_fixture",title:"Synthetic pilot call"}],hasMore:false});
  }
  return original(input,init);
};
process.env.OPEN_CRM_WORKSPACE=workspace;
const port=Number(process.argv[2]);
const server=await createServer({root,server:{host:"127.0.0.1",port,strictPort:true}});
await server.listen();
for(const signal of ["SIGINT","SIGTERM"]) process.on(signal,async()=>{await server.close();fs.rmSync(workspace,{recursive:true,force:true});process.exit(0);});
