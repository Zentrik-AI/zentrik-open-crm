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
    return Response.json({model:"fixture-provider (test only)",answers:Object.fromEntries(Object.keys(body.questions).map(k=>[k,{type:"choice",choice:k.endsWith("certainty")?(k.startsWith("s1")?"conditional":"explicit"):(k.startsWith("s1")?"commitment":"need"),confidence:0.87}]))});
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
