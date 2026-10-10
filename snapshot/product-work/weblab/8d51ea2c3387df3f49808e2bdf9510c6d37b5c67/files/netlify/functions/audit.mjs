import { handleAuditRequest } from '../../lib/audit-handler.mjs';

export const handler = async event => {
  if(event.httpMethod!=='POST')return{statusCode:405,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify({error:'Method not allowed.'})};
  const body=event.isBase64Encoded?Buffer.from(event.body??'','base64').toString('utf8'):event.body??'';
  const headers=event.headers??{};
  const clientKey=headers['x-nf-client-connection-ip']??headers['client-ip']??event.requestContext?.identity?.sourceIp??'unknown';
  const response=await handleAuditRequest(body,clientKey,{hosted:true});
  return{statusCode:response.statusCode,headers:response.headers,body:JSON.stringify(response.body)};
};
