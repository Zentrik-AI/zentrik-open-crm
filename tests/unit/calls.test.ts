import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { callSpans } from "../../src/core/calls.ts";
import { createCallService } from "../../cli/calls.ts";
import { classifyCall, getGranola } from "../../cli/call-providers.ts";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { readWorkspace, writeWorkspace } from "../../cli/store.ts";

const transcript = "Speaker A: We need a clearer audit trail.\nSpeaker B: We could pilot if security approves.";
const fakeFetch: typeof fetch = async (url, init) => {
  if (String(url).endsWith("/models")) return Response.json({ models: [] });
  const body = JSON.parse(String(init?.body));
  return Response.json({ model: "jev-test-fixture", answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: "choice", choice: key.endsWith("_certainty") ? "conditional" : "need", confidence: 0.84 }])) });
};
async function complete(service: ReturnType<typeof createCallService>) {
  for (let i=0;i<100 && !service.state().job?.finishedAt;i++) await new Promise(r => setTimeout(r,10));
  assert.ok(service.state().job?.finishedAt);
}
function setup(t: { after: (fn:()=>void)=>void }, fetcher = fakeFetch) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"crm-calls-"));
  writeWorkspace(dir, createDemoWorkspace());
  const service=createCallService(dir,fetcher);
  t.after(()=>{ service.close(); fs.rmSync(dir,{recursive:true,force:true}); });
  return { dir, service };
}
test("all quotes retain exact offsets including long turns and Unicode", () => {
  const text=`  A: café 👋 ${"A longer sentence. ".repeat(90)}\r\n B: Maybe, if approved.  `;
  const spans=callSpans(text);
  assert.ok(spans.length>2);
  for (const s of spans) { assert.equal(text.slice(s.start,s.end),s.text); assert.ok(s.text.length<=340); }
  assert.equal(spans.map(s=>s.text).join("").replace(/\s/g,""),text.replace(/\s/g,""));
});
test("provider classifies spans without generating or changing quotes", async () => {
  const result=await classifyCall(transcript,"test-key",fakeFetch);
  assert.equal(result.findings.length,2);
  assert.equal(result.findings[1].certainty,"conditional");
  assert.equal(result.findings[1].text,transcript.split("\n")[1]);
});
test("rejects malformed model results instead of inventing defaults", async () => {
  await assert.rejects(classifyCall(transcript,"test-key",async()=>Response.json({model:"test",answers:{}})),/incomplete or invalid/);
});
test("session secrets stay out of state and files; explicit review writes atomic source-backed claims once", async t => {
  const {dir,service}=setup(t);
  await service.connect("jev","fake-private-session-key");
  const call=service.ingest({title:"Fictional call",transcript,source:"file"}).call;
  assert.equal(service.ingest({title:"Same",transcript,source:"file"}).duplicate,true);
  assert.throws(()=>service.start([call.id],false),/Confirm sending/);
  const initial=readWorkspace(dir).workspace;
  service.start([call.id],true); await complete(service);
  assert.deepEqual(readWorkspace(dir).workspace,initial);
  assert.ok(!JSON.stringify(service.state()).includes("fake-private-session-key"));
  assert.throws(()=>service.commit(call.id,initial.accounts[0].id,["s999"]),/does not match/);
  service.commit(call.id,initial.accounts[0].id,["s0"]);
  assert.deepEqual(service.get(call.id).savedSpanIds,["s0"]);
  const saved=readWorkspace(dir).workspace;
  assert.equal(saved.notes.length,initial.notes.length+1);
  const claim=saved.claims!.find(c=>c.id===`claim_${call.id}_s0`)!;
  assert.ok(claim.text.startsWith("[conditional]"));
  assert.deepEqual(claim.evidence,[`note_${call.id}`]);
  assert.equal(service.commit(call.id,initial.accounts[0].id,["s0"]).duplicate,true);
  assert.equal(readWorkspace(dir).workspace.notes.length,saved.notes.length);
  assert.throws(()=>service.commit(call.id,initial.accounts[1].id,["s0"]),/different account/);
  const contents=(directory:string): string => fs.readdirSync(directory,{withFileTypes:true}).map(e=>e.isDirectory()?contents(path.join(directory,e.name)):fs.readFileSync(path.join(directory,e.name),"utf8")).join("");
  assert.ok(!contents(dir).includes("fake-private-session-key"));
  service.disconnect("jev"); assert.equal(service.state().connections.jev,false);
});
test("partial provider failure leaves failed call retryable and CRM untouched", async t => {
  let count=0;
  const {service,dir}=setup(t,async(url,init)=> { if(String(url).endsWith("/models")) return Response.json({models:[]}); return ++count===1?new Response("secret provider body",{status:401}):fakeFetch(url,init); });
  await service.connect("jev","key");
  const a=service.ingest({title:"One",transcript,source:"file"}).call;
  const b=service.ingest({title:"Two",transcript:transcript+"\nA: Another fact.",source:"file"}).call;
  const before=readWorkspace(dir).rev;
  service.start([a.id,b.id],true); await complete(service);
  assert.equal(service.state().job?.failed,1);
  assert.equal(service.get(a.id).status,"error");
  assert.ok(!JSON.stringify(service.state()).includes("secret provider body"));
  assert.equal(service.get(b.id).status,"review");
  assert.equal(readWorkspace(dir).rev,before);
});
test("Granola preserves anonymous speaker identity and requests official transcript route", async()=> {
  let seen="";
  const result=await getGranola("key","not_synthetic",async url=>{seen=String(url);return Response.json({title:"Synthetic",transcript:[{speaker:{source:"microphone",diarization_label:"Speaker A"},text:"We need records."}]});});
  assert.equal(result.transcript,"Speaker A: We need records.");
  assert.ok(seen.endsWith("not_synthetic?include=transcript"));
});
test("another process cannot start a batch while the workspace is processing", async t => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const {service,dir}=setup(t, async (url,init) => {
    if (!String(url).endsWith("/models")) await gate;
    return fakeFetch(url,init);
  });
  await service.connect("jev","key");
  const call=service.ingest({title:"Synthetic",transcript,source:"file"}).call;
  service.start([call.id],true);
  const other=createCallService(dir,fakeFetch,{recover:true});
  await other.connect("jev","key");
  assert.equal(other.get(call.id).status,"processing");
  assert.throws(()=>other.start([call.id],true),/Another process/);
  release(); await complete(service); other.close();
});

test("cancellation prevents subsequent transcript chunks from being sent", async () => {
  let stopped = false;
  let requests = 0;
  await assert.rejects(classifyCall(Array.from({length:45},(_,i)=>`Speaker: Need ${i}.`).join("\n"), "key", async (url,init) => {
    requests++; stopped = true; return fakeFetch(url,init);
  }, () => stopped), /processing stopped/);
  assert.equal(requests,1);
});
test("restart marks an interrupted call retryable without writing CRM", t => {
  const {service,dir}=setup(t);
  const call=service.ingest({title:"Interrupted synthetic call",transcript,source:"file"}).call;
  const target=path.join(dir,".open-crm/calls",`${call.id}.json`);
  fs.writeFileSync(target,JSON.stringify({...call,status:"processing"}));
  const before=readWorkspace(dir).rev;
  const recovered=createCallService(dir,fakeFetch,{recover:true});
  assert.equal(recovered.get(call.id).status,"error");
  assert.match(recovered.get(call.id).error!,/stopped during processing/);
  assert.equal(readWorkspace(dir).rev,before);
  recovered.close();
});
