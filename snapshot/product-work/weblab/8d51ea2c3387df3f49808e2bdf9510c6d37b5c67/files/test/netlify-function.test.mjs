import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/audit.mjs';

test('Netlify audit function rejects other methods and blocks private network targets',async()=>{
  const method=await handler({httpMethod:'GET',headers:{}});
  assert.equal(method.statusCode,405);
  const response=await handler({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'203.0.113.20'},body:JSON.stringify({url:'http://127.0.0.1/private'})});
  assert.equal(response.statusCode,422);
  assert.match(JSON.parse(response.body).error,/non-public network address/);
  assert.equal(response.headers['cache-control'],'no-store');
});
