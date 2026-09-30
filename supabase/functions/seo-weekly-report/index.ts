import { buildReport, periodKey } from './report.mjs';

const env = (name: string) => { const value=Deno.env.get(name); if(!value) throw new Error(`Missing configuration: ${name}`); return value; };
const recipient = 'jordan.jones@adelphos.ai';
const sender = 'noreply@adelphos.ai';
const json = (status:number,body:unknown) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function authorized(request:Request) {
  const expected=Deno.env.get('SEO_REPORT_CRON_SECRET');
  if(!expected) return false;
  const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(request.headers.get('Authorization')||''),digest('Bearer '+expected)]);
  return a.reduce((difference,value,index)=>difference|(value^b[index]),0)===0;
}
async function db(path:string,init:RequestInit={}) {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const result=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(20000)});
  if(!result.ok) throw new Error('Report database request failed: '+result.status);
  return result.status===204?null:result.json();
}
Deno.serve(async request => {
  if(request.method!=='POST') return json(405,{error:'POST required'});
  if(!await authorized(request)) return json(401,{error:'Unauthorized'});
  const period=periodKey(); let claimed=false,dispatchStarted=false;
  const match=`period=eq.${period}&recipient=eq.${recipient}`;
  try {
    const claim=await db('seo_report_deliveries?on_conflict=period,recipient',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({period,recipient,status:'preparing'})});
    if(!claim.length) return json(200,{ok:true,status:'already_recorded',period});
    claimed=true;
    const newest=await db('seo_gsc_daily?select=search_date&order=search_date.desc&limit=1');
    const rows:unknown[]=[];
    if(newest.length) {
      const start=new Date(newest[0].search_date+'T00:00:00Z'); start.setUTCDate(start.getUTCDate()-13);
      for(let offset=0;;offset+=1000) {
        const page=await db(`seo_gsc_daily?select=search_date,query,page,country,device,clicks,impressions,position&search_date=gte.${start.toISOString().slice(0,10)}&order=search_date.asc,query.asc,page.asc,device.asc,country.asc&limit=1000&offset=${offset}`);
        rows.push(...page); if(page.length<1000)break;
      }
    }
    const report=buildReport(rows);
    const authResult=await fetch(`https://login.microsoftonline.com/${env('SEO_REPORT_MS_TENANT')}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:env('SEO_REPORT_MS_CLIENT'),client_secret:env('SEO_REPORT_MS_SECRET'),scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(20000)});
    if(!authResult.ok) throw new Error('Microsoft email authentication failed: '+authResult.status);
    const auth=await authResult.json(); if(!auth.access_token)throw new Error('Microsoft returned no email token');
    await db('seo_report_deliveries?'+match,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'dispatching',subject:report.subject,data_through:report.latest||null})});
    dispatchStarted=true;
    const sent=await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:report.subject,body:{contentType:'HTML',content:report.html},toRecipients:[{emailAddress:{address:recipient}}]},saveToSentItems:true}),signal:AbortSignal.timeout(25000)});
    if(sent.status!==202)throw new Error('Microsoft email submission not confirmed: '+sent.status);
    await db('seo_report_deliveries?'+match,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'accepted',accepted_at:new Date().toISOString()})});
    return json(200,{ok:true,status:'accepted',period,from:sender,to:recipient,data_through:report.latest||null,stale:report.stale});
  } catch(error) {
    const message=error instanceof Error?error.message:'Report failed';
    console.error(message);
    if(claimed)try { await db('seo_report_deliveries?'+match,dispatchStarted?{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'unconfirmed',error:message})}:{method:'DELETE',headers:{Prefer:'return=minimal'}}); }catch{console.error('Report ledger update failed');}
    return json(502,{error:'Report not confirmed',period,reconcile_before_retry:dispatchStarted});
  }
});
