import test from "node:test";
import assert from "node:assert/strict";
import {abortableWait} from "../lib/abortable-wait.ts";
test("cancel releases an unresolved picker and ignores a late destination",async()=>{
  const controller=new AbortController();let select;
  const pending=new Promise(resolve=>select=resolve);
  const task=abortableWait(pending,controller.signal);
  controller.abort();await assert.rejects(task,{name:"AbortError"});
  select("late-file");await assert.rejects(task,{name:"AbortError"});
});
test("picker success, failure and pre-aborted requests remain distinct",async()=>{
  const controller=new AbortController();
  assert.equal(await abortableWait(Promise.resolve("file"),controller.signal),"file");
  await assert.rejects(abortableWait(Promise.reject(new Error("permission denied")),controller.signal),/permission denied/);
  controller.abort();await assert.rejects(abortableWait(Promise.resolve("file"),controller.signal),{name:"AbortError"});
});
