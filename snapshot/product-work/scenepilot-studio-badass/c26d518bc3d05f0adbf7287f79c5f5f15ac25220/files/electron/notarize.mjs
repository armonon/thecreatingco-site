import path from "node:path";
import { notarize } from "@electron/notarize";

export function notarizationCredentials(env = process.env) {
  if (env.SCENEPILOT_NOTARY_PROFILE?.trim()) return { keychainProfile: env.SCENEPILOT_NOTARY_PROFILE.trim() };
  const { APPLE_ID: appleId, APPLE_APP_SPECIFIC_PASSWORD: appleIdPassword, APPLE_TEAM_ID: teamId,
    APPLE_API_KEY: appleApiKey, APPLE_API_KEY_ID: appleApiKeyId, APPLE_API_ISSUER: appleApiIssuer } = env;
  if (appleId && appleIdPassword && teamId) return { appleId, appleIdPassword, teamId };
  if (appleApiKey && appleApiKeyId && appleApiIssuer) return { appleApiKey, appleApiKeyId, appleApiIssuer };
  return null;
}

export default async function notarizeScenePilot(context) {
  if (process.platform !== "darwin") return;
  if (process.env.SCENEPILOT_SKIP_NOTARIZATION === "1") {
    if (process.env.SCENEPILOT_REQUIRE_NOTARIZATION === "1") throw new Error("Cannot skip required notarization");
    return;
  }
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const common = { appBundleId: context.packager.appInfo.id, appPath };
  const credentials = notarizationCredentials();
  if (credentials) {
    await notarize({ ...common, ...credentials });
    return;
  }
  if (process.env.SCENEPILOT_REQUIRE_NOTARIZATION === "1") throw new Error("Public release blocked: Apple notarization credentials are missing.");
  process.stdout.write("Preview only — skipping Apple notarization: credentials are not configured.\n");
}
