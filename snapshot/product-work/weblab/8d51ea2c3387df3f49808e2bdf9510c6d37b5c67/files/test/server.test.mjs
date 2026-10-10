import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

async function freePort(){
  const server=net.createServer();await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  const {port}=server.address();await new Promise(resolve=>server.close(resolve));return port;
}

test('local HTTP API ignores a wildcard bind override, rejects private targets, and rate-limits scans',async t=>{
  const port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,WEBLAB_HOST:'0.0.0.0',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(1_000)]);}});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  let health;
  for(let i=0;i<60;i++){
    if(child.exitCode!==null)throw new Error(`WebLab server exited early: ${output}`);
    try{health=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(500)});break;}catch{await delay(50);}
  }
  assert.equal(health?.status,200,`server did not start: ${output}`);
  assert.match(output,new RegExp(`127\\.0\\.0\\.1:${port}`));
  const rejected=await fetch(`http://127.0.0.1:${port}/api/audit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/private'})});
  assert.equal(rejected.status,422);
  assert.match((await rejected.json()).error,/non-public network address/);
  const limited=[];
  for(let i=1;i<5;i++)limited.push(await fetch(`http://127.0.0.1:${port}/api/audit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/private'})}));
  const rateLimited=await fetch(`http://127.0.0.1:${port}/api/audit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/private'})});
  assert.ok(limited.every(response=>response.status===422));
  assert.equal(rateLimited.status,429);
});
