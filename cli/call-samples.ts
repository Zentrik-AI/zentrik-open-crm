import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpError } from "../src/core/ops.ts";
import type { CallService } from "./calls.ts";
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.existsSync(path.join(base,"package.json")) ? base : path.resolve(base,"../..");
/** Explicitly synthetic source files. Uses the same import path as real files. */
export function importCallSamples(service: CallService, count: number) {
  if (count !== 1 && count !== 50) throw new OpError("invalid_value", "Choose 1 or 50 synthetic calls.");
  const ids: string[] = [];
  for (let n=1;n<=count;n++) {
    const name=`synthetic-call-${String(n).padStart(2,"0")}.txt`;
    const transcript=fs.readFileSync(path.join(root,"examples/calls",name),"utf8");
    ids.push(service.ingest({title:`Synthetic workshop call ${String(n).padStart(2,"0")}`,transcript,source:"file"}).call.id);
  }
  return { ids, synthetic: true };
}
