import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, validatePublicUrl } from '../lib/safe-fetch.mjs';
import { auditWebsite } from '../lib/audit.mjs';

test('blocks private, local, link-local, shared and documentation IPv4 ranges',()=>{
  for(const ip of ['0.0.0.0','10.1.2.3','100.64.0.1','127.0.0.1','169.254.1.2','172.16.0.1','192.168.1.1','192.0.0.8','192.0.2.1','198.18.0.2','198.51.100.4','203.0.113.9','224.0.0.1','255.255.255.255']) assert.equal(isPublicAddress(ip),false,ip);
});

test('blocks local and special IPv6 but accepts global test addresses',()=>{
  for(const ip of ['::','::1','fc00::1','fd12::2','fe80::1','ff02::1','2001:db8::1','::ffff:127.0.0.1','::ffff:7f00:1','::ffff:a9fe:a9fe','::ffff:c0a8:101','::ffff:192.168.1.1','::7f00:1','2001:0::1','2002:7f00:1::1','3fff::1']) assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
});

test('only public HTTP(S) URLs without embedded credentials are accepted',()=>{
  assert.equal(validatePublicUrl('https://example.com/path').hostname,'example.com');
  for(const url of ['file:///etc/passwd','javascript:alert(1)','http://localhost','http://localhost.local','http://user:pass@example.com','not a URL']) assert.throws(()=>validatePublicUrl(url),undefined,url);
});

test('audits inert hostile HTML, honors document base, and omits URL query secrets from reports',{skip:!process.env.WEBLAB_CHROMIUM_PATH},async()=>{
  const html='<!doctype html><html lang="en"><head><title>Test website</title><base href="/docs/"><link rel="stylesheet" href="/missing.css"></head><body><main><h1>Test</h1><a href="guide?token=secret-value">Guide</a><svg/onload="window.WEBLAB_POC=1"><script>window.WEBLAB_POC=1</script></svg><form action="submit?token=secret-value"><label for="email">Email</label><input id="email" name="email"></form></main></body></html>';
  const requested=[];
  const fetcher=async url=>{requested.push(url);return{status:url.endsWith('/guide?token=secret-value')?404:url.endsWith('/missing.css')?502:200,url,headers:{'content-type':url.endsWith('.css')?'text/css':'text/html'},body:Buffer.from(html),elapsedMs:10};};
  const result=await auditWebsite('https://example.com/start/?auth=secret-input',{fetcher});
  assert.ok(requested.includes('https://example.com/docs/guide?token=secret-value'));
  assert.ok(requested.includes('https://example.com/missing.css'));
  assert.equal(result.homepage.documentBase,'https://example.com/docs/');
  assert.equal(result.browser.security.executionProbe,null);
  assert.equal(result.browser.security.remoteScriptsExecuted,false);
  assert.equal(result.homepage.links[0].href,'https://example.com/docs/guide');
  assert.equal(result.homepage.forms[0].action,'https://example.com/docs/submit');
  assert.equal(JSON.stringify(result).includes('secret-value'),false);
  assert.equal(JSON.stringify(result).includes('secret-input'),false);
  assert.ok(result.findings.some(f=>f.title==='Some sampled stylesheets could not be loaded.'));
});
