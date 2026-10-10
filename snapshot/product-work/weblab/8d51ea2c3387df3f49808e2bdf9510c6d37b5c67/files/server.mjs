import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleAuditRequest } from './lib/audit-handler.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
// This prototype can fetch arbitrary public URLs, so never allow an environment
// override to expose the unauthenticated scan API to a network interface.
const host='127.0.0.1';
const port=Number(process.env.PORT ?? 4177);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function send(res,status,body,type='application/json; charset=utf-8') {res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
async function bodyText(req,max=2048){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw Object.assign(new Error('Request is too large.'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks,size).toString('utf8');}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method==='GET'&&url.pathname==='/health'){send(res,200,{status:'ok',product:'WebLab',version:'0.1.0'});return;}
  if(req.method==='POST'&&url.pathname==='/api/audit'){
    try{const result=await handleAuditRequest(await bodyText(req),req.socket.remoteAddress??'local');res.writeHead(result.statusCode,{...result.headers,'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(result.body));}
    catch(error){send(res,error.status??400,{error:error.message??'The check could not be completed.'});}return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){send(res,405,{error:'Method not allowed.'});return;}
  const files={'/':'index.html','/index.html':'index.html','/app.css':'app.css','/app.js':'app.js'};const filename=files[url.pathname];if(!filename){send(res,404,{error:'Not found.'});return;}
  try{const data=await readFile(path.join(root,filename));send(res,200,req.method==='HEAD'?'':data.toString('utf8'),types[path.extname(filename)]);}catch{send(res,500,{error:'WebLab interface file unavailable.'});}
});
server.requestTimeout=75_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;
server.listen(port,host,()=>console.log(`WebLab local prototype at http://${host}:${port}`));
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),3_000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
