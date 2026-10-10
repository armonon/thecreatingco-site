import { auditWebsite } from './audit.mjs';

const active=new Set();
const buckets=new Map();
const BODY_LIMIT=2048;
const RESPONSE_HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});

function limited(clientKey){
  const now=Date.now(),prior=buckets.get(clientKey)??{start:now,count:0};
  if(now-prior.start>60_000){prior.start=now;prior.count=0;}
  prior.count++;buckets.set(clientKey,prior);
  if(buckets.size>10_000){for(const [key,value] of buckets){if(now-value.start>120_000)buckets.delete(key);if(buckets.size<=8_000)break;}}
  return prior.count>5;
}

const result=(statusCode,body)=>({statusCode,headers:RESPONSE_HEADERS,body});

export async function handleAuditRequest(bodyText,clientKey='unknown',{hosted=false}={}){
  if(limited(clientKey))return result(429,{error:'Scan limit reached. Wait a minute before starting another scan.'});
  if(Buffer.byteLength(bodyText??'','utf8')>BODY_LIMIT)return result(413,{error:'Request is too large.'});
  let data;try{data=JSON.parse(bodyText??'');}catch{return result(400,{error:'Request must be valid JSON.'});}
  if(typeof data.url!=='string'||data.url.length>BODY_LIMIT)return result(400,{error:'Enter one website URL no longer than 2,048 characters.'});
  if(active.size>=2)return result(429,{error:'Two website checks are already running. Try again shortly.'});
  const token=Symbol('scan');active.add(token);
  try{
    const options=hosted?{requestTimeoutMs:3_000,linkTimeoutMs:1_000,linkConcurrency:8,maxLinkChecks:16,cssTimeoutMs:1_000,cssConcurrency:6,maxStylesheets:6,browserChecksEnabled:false}:{};
    const audit=await auditWebsite(data.url,options);
    return result(audit.status==='failed'?422:200,audit);
  }catch(error){return result(400,{error:error.message??'The check could not be completed.'});}
  finally{active.delete(token);}
}
