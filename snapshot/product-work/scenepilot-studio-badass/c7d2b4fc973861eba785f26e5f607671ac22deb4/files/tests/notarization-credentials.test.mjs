import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {notarizationCredentials} from "../electron/notarize.mjs";
import {requireReleaseSigning} from "../scripts/require-release-signing.mjs";

test("notarization accepts a Keychain profile without exporting secrets",()=>{
 const env={CSC_NAME:"Developer ID Application: QA",SCENEPILOT_NOTARY_PROFILE:"  qa-profile  "};
 assert.equal(requireReleaseSigning(env),env.CSC_NAME);
 assert.deepEqual(notarizationCredentials(env),{keychainProfile:"qa-profile"});
 assert.throws(()=>requireReleaseSigning({...env,CSC_NAME:"-"}),/Developer ID/);
 assert.throws(()=>requireReleaseSigning({...env,SCENEPILOT_NOTARY_PROFILE:" "}),/notarization/);
});
test("incomplete authentication never silently becomes a valid submission",()=>{
 assert.equal(notarizationCredentials({APPLE_ID:"test"}),null);
 assert.deepEqual(notarizationCredentials({APPLE_ID:"test",APPLE_APP_SPECIFIC_PASSWORD:"test-only",APPLE_TEAM_ID:"team"}),{appleId:"test",appleIdPassword:"test-only",teamId:"team"});
 assert.deepEqual(notarizationCredentials({APPLE_API_KEY:"test.p8",APPLE_API_KEY_ID:"key",APPLE_API_ISSUER:"issuer"}),{appleApiKey:"test.p8",appleApiKeyId:"key",appleApiIssuer:"issuer"});
});
test("one custom notarization hook owns submission; hardened runtime is explicit",async()=>{
 const config=JSON.parse(await readFile(new URL("../electron/package.json",import.meta.url),"utf8"));
 assert.equal(config.build.mac.hardenedRuntime,true);
 assert.equal(config.build.mac.notarize,false);
 assert.equal(config.build.afterSign,"electron/notarize.mjs");
});
