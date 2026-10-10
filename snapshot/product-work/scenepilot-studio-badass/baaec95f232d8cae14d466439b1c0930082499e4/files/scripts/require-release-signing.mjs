/** Public distribution must never silently fall back to an ad-hoc build. */
export function requireReleaseSigning(env = process.env) {
  if (!env.CSC_NAME?.startsWith("Developer ID Application:")) throw new Error("Public release blocked: CSC_NAME must identify a Developer ID Application certificate. Ad-hoc and Apple Development builds are previews only.");
  const password = env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID;
  const api = env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER;
  if (!password && !api) throw new Error("Public release blocked: complete Apple notarization credentials are required.");
  return env.CSC_NAME;
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  try { requireReleaseSigning(); process.stdout.write("Developer ID and notarization configuration present. Signing/notarization results must still pass.\n"); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
