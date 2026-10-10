import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { detectNeuralInpaintProvider } from "./neural-inpaint.js";

const OPTIONAL_BINDING_FILES = new Set([
  "libtbbbind_2_5.3.13.dylib", "libtbbbind_2_5.3.dylib", "libtbbbind_2_5.dylib",
]);
export const isOptionalBindingFile = name => OPTIONAL_BINDING_FILES.has(name);

export function finalizeProviderArtifacts(artifacts, removed, changed, hash) {
  for (const file of changed) {
    if (!artifacts.some(artifact => artifact.path === file)) throw new Error(`Unsigned manifest coverage: ${file}`);
  }
  return artifacts.filter(artifact => !removed.has(artifact.path))
    .map(artifact => changed.has(artifact.path) ? { ...artifact, sha256: hash(artifact.path) } : artifact);
}

export function requireIntelSignature(signature) {
  if (!/^Authority=Developer ID Application: Intel Corporation Apps \(Z3L495V9L4\)$/m.test(signature)
    || !/^TeamIdentifier=Z3L495V9L4$/m.test(signature)
    || !/^Timestamp=.+$/m.test(signature) || !/flags=.*\bruntime\b/.test(signature)) {
    throw new Error("Preserved OpenVINO code must carry Intel's timestamped Developer ID signature and hardened runtime");
  }
}

export function externalVendorLinks(output, ownId = "") {
  return output.split("\n").filter(line => /^\s+.* \(compatibility version/.test(line))
    .map(line => line.trim().replace(/ \(compatibility version.*$/, ""))
    .filter(link => link !== ownId && link.startsWith("/") && !link.startsWith("/usr/lib/") && !link.startsWith("/System/Library/"));
}

export function verifyVendorSignatures(appPath) {
  const directory = path.join(appPath, "Contents/Resources/inpaint-provider/runtime/openvino-node/bin");
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(dylib|node)$/.test(entry.name));
  if (!entries.length) throw new Error("No signed OpenVINO native payload found");
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    execFileSync("codesign", ["--verify", "--strict", file], { stdio: "pipe" });
    const result = spawnSync("codesign", ["-dv", "--verbose=4", file], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Cannot inspect vendor signature: ${entry.name}`);
    requireIntelSignature(result.stderr);
  }
  return entries.length;
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`Verified ${verifyVendorSignatures(appPath)} preserved Intel native signatures.`);
  const providerRoot = path.join(appPath, "Contents/Resources/inpaint-provider");
  const provider = path.join(providerRoot, "ScenePilotInpaintProvider.mjs");
  const manifestPath = `${provider}.json`;
  const verifyManifest = async () => {
    const detected = await detectNeuralInpaintProvider({ env: { SCENEPILOT_INPAINT_PROVIDER: provider } });
    if (!detected.available) throw new Error("Packaged provider integrity manifest is invalid");
  };
  await verifyManifest();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const bin = path.join(providerRoot, "runtime/openvino-node/bin");
  const removed = new Set(), changed = new Set();
  // TBB's optional topology-binding extension requires a developer-local hwloc.
  // CPU inference works without it; never omit a library with a hard dependent.
  for (const entry of readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isFile() && /\.(dylib|node|so)$/.test(entry.name))) {
    if (isOptionalBindingFile(entry.name)) continue;
    const links = execFileSync("otool", ["-L", path.join(bin, entry.name)], { encoding: "utf8" });
    for (const name of OPTIONAL_BINDING_FILES) {
      if (links.includes(`/${name} (compatibility version`)) throw new Error(`Cannot omit required binding library: ${entry.name} links ${name}`);
    }
  }
  for (const name of readdirSync(bin).filter(isOptionalBindingFile)) {
    rmSync(path.join(bin, name));
    removed.add(`runtime/openvino-node/bin/${name}`);
  }
  for (const entry of readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isFile() && /\.(dylib|node|so)$/.test(entry.name))) {
    const file = path.join(bin, entry.name);
    const ownId = execFileSync("otool", ["-D", file], { encoding: "utf8" }).split("\n")[1]?.trim();
    const links = externalVendorLinks(execFileSync("otool", ["-L", file], { encoding: "utf8" }), ownId);
    if (links.length) throw new Error(`Release blocked: ${entry.name} needs ${links.join(", ")}. Supply a self-contained vendor runtime; do not certify this developer-machine dependency.`);
  }
  if (context.packager.config.mac.identity != null) {
    const identity = context.packager.config.mac.identity;
    if (!/^(Developer ID Application: )?Armon Nasiri \(NJBZDU7XZX\)$/.test(identity)) throw new Error("Unexpected plugin signing identity");
    const plugins = readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith(".so"));
    if (!plugins.length) throw new Error("Missing OpenVINO inference plugins");
    for (const plugin of plugins) {
      const file = path.join(bin, plugin.name);
      const inspection = spawnSync("codesign", ["-dv", "--verbose=4", file], { encoding: "utf8" });
      if (inspection.status !== 0) throw new Error(`Cannot inspect inference plugin: ${plugin.name}`);
      const metadata = inspection.stderr;
      if (/^Signature=adhoc$/m.test(metadata)) {
        execFileSync("codesign", ["--force", "--options", "runtime", "--timestamp", "--sign", identity, file], { stdio: "pipe" });
        changed.add(`runtime/openvino-node/bin/${plugin.name}`);
      } else requireIntelSignature(metadata);
      execFileSync("codesign", ["--verify", "--strict", file], { stdio: "pipe" });
    }
  }
  manifest.artifacts = finalizeProviderArtifacts(manifest.artifacts, removed, changed,
    relative => createHash("sha256").update(readFileSync(path.join(providerRoot, relative))).digest("hex"));
  manifest.packaging = { optionalLibrariesOmitted: [...removed], signedBeforeManifest: [...changed] };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await verifyManifest();
}
