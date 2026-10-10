import path from "node:path";
import { notarize } from "@electron/notarize";

export default async function notarizeScenePilot(context) {
  if (process.platform !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const common = { appBundleId: context.packager.appInfo.id, appPath };
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (appleId && appleIdPassword && teamId) {
    await notarize({ ...common, appleId, appleIdPassword, teamId });
    return;
  }
  if (appleApiKey && appleApiKeyId && appleApiIssuer) {
    await notarize({ ...common, appleApiKey, appleApiKeyId, appleApiIssuer });
    return;
  }
  if (process.env.SCENEPILOT_REQUIRE_NOTARIZATION === "1") throw new Error("Public release blocked: Apple notarization credentials are missing.");
  process.stdout.write("Preview only — skipping Apple notarization: credentials are not configured.\n");
}
