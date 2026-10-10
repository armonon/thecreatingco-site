import assert from "node:assert/strict";
import test from "node:test";
import { requireIntelSignature, externalVendorLinks, isOptionalBindingFile, finalizeProviderArtifacts } from "../electron/verify-vendor-signatures.mjs";

const signature = "Authority=Developer ID Application: Intel Corporation Apps (Z3L495V9L4)\nTeamIdentifier=Z3L495V9L4\nTimestamp=Aug 14, 2026\nCodeDirectory flags=0x10000(runtime)";
test("signIgnore only preserves verified timestamped Intel native code", () => {
  assert.doesNotThrow(() => requireIntelSignature(signature));
  for (const invalid of ["Signature=adhoc", signature.replaceAll("Z3L495V9L4", "OTHERTEAM1"),
    signature.replace("Timestamp=", "Signed Time="), signature.replace("runtime", "none")]) {
    assert.throws(() => requireIntelSignature(invalid), /Intel/);
  }
});
test("only the known optional affinity library and its aliases may be omitted", () => {
  assert.equal(isOptionalBindingFile("libtbbbind_2_5.3.13.dylib"), true);
  for (const file of ["libtbb.12.13.dylib", "libopenvino_arm_cpu_plugin.so", "libtbbbind_NEW.dylib"])
    assert.equal(isOptionalBindingFile(file), false);
});
test("final plugin hashes retain every unmodified artifact and require coverage", () => {
  const artifacts = [{ path: "keep", sha256: "original" }, { path: "plugin", sha256: "adhoc" }, { path: "optional", sha256: "old" }];
  assert.deepEqual(finalizeProviderArtifacts(artifacts, new Set(["optional"]), new Set(["plugin"]), () => "signed"),
    [{ path: "keep", sha256: "original" }, { path: "plugin", sha256: "signed" }]);
  assert.equal(artifacts[1].sha256, "adhoc");
  assert.throws(() => finalizeProviderArtifacts(artifacts, new Set(), new Set(["untracked"]), () => "signed"), /coverage/);
});
test("vendor install IDs are distinct from developer-machine dependencies", () => {
  const link = "\t/usr/local/lib/libhwloc.15.dylib (compatibility version 22.0.0)\n";
  assert.deepEqual(externalVendorLinks(link, "/usr/local/lib/libhwloc.15.dylib"), []);
  assert.deepEqual(externalVendorLinks(link, "@rpath/libtbbbind.dylib"), ["/usr/local/lib/libhwloc.15.dylib"]);
  assert.deepEqual(externalVendorLinks("\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0)"), []);
});
