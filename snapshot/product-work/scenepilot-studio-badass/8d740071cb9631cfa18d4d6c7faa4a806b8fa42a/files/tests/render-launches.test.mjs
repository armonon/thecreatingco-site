import test from "node:test";
import assert from "node:assert/strict";
import { createRenderLaunchRegistry } from "../electron/render-launches.js";
test("native cancellation is remembered before an encoder exists and clean retry is possible",()=>{
  const registry=createRenderLaunchRegistry();const launch=registry.begin("job");
  assert.throws(()=>registry.begin("job"),/already/);
  assert.equal(registry.cancel("job"),true);assert.equal(launch.canceled,true);
  registry.finish("job");assert.equal(registry.cancel("job"),false);
  assert.equal(registry.begin("job").canceled,false);
});
