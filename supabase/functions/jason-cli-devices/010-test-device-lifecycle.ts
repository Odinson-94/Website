/** Actual edge handler in a VM with an isolated DB transport; SQL is tested separately. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const requireChat=createRequire(process.env.ADELPHOS_TEST_CHAT_ROOT+'/adelphos-chat/package.json');
const ts=requireChat('typescript');
const source=ts.transpileModule(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function handler(db){let run;runInNewContext(source,{serve:fn=>{run=fn;},createClient:()=>db,Deno:{env:{get:key=>key==='ADELPHOS_METERING_SERVICE_TOKEN'?'local-test-service':key==='SUPABASE_URL'?'http://local.invalid':'local-placeholder'}},crypto:webcrypto,TextEncoder,Response,console:{error(){}}});return run;}
const request=body=>new Request('http://local.invalid',{method:'POST',headers:{authorization:'Bearer local-test-service','content-type':'application/json'},body:JSON.stringify(body)});
test('register requires fragments and never includes hash in selected returned metadata',async()=>{
 let saved,projection;const chain={insert(value){saved=value;return this;},select(value){projection=value;return this;},single:async()=>({data:{id:'local',token_prefix:'jcli_abcdef',token_suffix:'1234'}})};
 const run=handler({from:()=>chain});const body={action:'register',chat_user_id:'owner',tenant_id:'personal-owner',owner_email:'owner@invalid.test',name:'Local',token_hash:'a'.repeat(64),token_prefix:'jcli_abcdef',token_suffix:'1234'};
 const response=await run(request(body));assert.equal(response.status,201);assert.equal(saved.token_hash,body.token_hash);assert.ok(!projection.includes('token_hash'));assert.ok(!JSON.stringify(await response.json()).includes(body.token_hash));
 assert.equal((await run(request({...body,token_suffix:null}))).status,400);
});
test('owner and staff audit actions select distinct modes and receipt-only never mutates',async()=>{
 const calls=[];const run=handler({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'key'}};}});
 await run(request({action:'owner_revoke',actorId:'owner',tenantId:'personal',actorEmail:'owner@invalid.test',targetId:'key',requestId:'request',reason:'Owner-requested revocation'}));
 await run(request({action:'admin_revoke_receipt',actorId:'staff',actorEmail:'staff@adelphos.ai',targetId:'key',requestId:'request',reason:'Staff action'}));
 assert.equal(calls[0].args.p_mode,'owner');assert.equal(calls[0].args.p_tenant,'personal');assert.equal(calls[1].args.p_mode,'staff');assert.equal(calls[1].args.p_read_only,true);assert.equal(calls[1].args.p_tenant,null);
});
test('revoked during resolve touch cannot return an authenticated device',async()=>{
 let updated=false;const chain={select(){return this;},eq(){return this;},is(){return this;},gt(){return this;},or(){return this;},update(){updated=true;return this;},maybeSingle:async()=>({data:updated?null:{id:'key',chat_user_id:'owner'}})};
 const run=handler({from:()=>chain});assert.equal((await run(request({action:'resolve',token_hash:'a'.repeat(64)}))).status,401);
});
test('unauthorized callers never access DB and action conflict has stable409',async()=>{
 let calls=0;const run=handler({rpc:async()=>{calls++;return {error:{code:'23505',message:'private-canary'}};}});
 assert.equal((await run(new Request('http://local.invalid',{method:'POST'}))).status,401);assert.equal(calls,0);
 const res=await run(request({action:'admin_revoke'}));assert.equal(res.status,409);assert.ok(!(await res.text()).includes('private-canary'));
});

test('existing hash-only issuers remain compatible without fabricated fragments',async()=>{
 let saved;const chain={insert(value){saved=value;return this;},select(){return this;},single:async()=>({data:{id:'legacy',token_prefix:null,token_suffix:null}})};
 const run=handler({from:()=>chain});
 const res=await run(request({action:'register',chat_user_id:'owner',tenant_id:'personal',owner_email:'owner@invalid.test',name:'Existing client',token_hash:'b'.repeat(64)}));
 assert.equal(res.status,201);assert.equal(saved.token_prefix,null);assert.equal(saved.token_suffix,null);
 assert.ok(!JSON.stringify(await res.json()).includes('b'.repeat(64)));
});

test('existing owner revoke uses atomic audit and refuses another owner or an audit failure',async()=>{
 const calls=[];let error;const run=handler({rpc:async(name,args)=>{calls.push({name,args});return error?{error}:{data:{id:'key'}};}});
 const body={action:'revoke',id:'key',chat_user_id:'owner',tenant_id:'personal',owner_email:'owner@invalid.test'};
 assert.deepEqual(await (await run(request(body))).json(),{ok:true});
 assert.equal(calls[0].name,'adelphos_admin_revoke_cli_key');assert.equal(calls[0].args.p_mode,'owner');assert.equal(calls[0].args.p_actor_id,'owner');assert.equal(calls[0].args.p_tenant,'personal');assert.match(calls[0].args.p_request_id,/^[0-9a-f-]{36}$/);
 error={code:'P0002'};assert.equal((await run(request(body))).status,404);
 error={code:'23514'};assert.equal((await run(request(body))).status,503);
});

test('the owner chooses expiry: none means never, a chosen date is stored, a past date is refused',async()=>{
 const saved=[];const chain={insert(value){saved.push(value);return this;},select(){return this;},single:async()=>({data:{id:'key'}})};
 const run=handler({from:()=>chain});
 const base={action:'register',chat_user_id:'owner',tenant_id:'personal',owner_email:'owner@invalid.test',name:'Laptop',token_hash:'c'.repeat(64),token_prefix:'jcli_abcdef',token_suffix:'1234'};
 assert.equal((await run(request(base))).status,201);assert.equal(saved[0].expires_at,null,'no choice never expires');
 const chosen=new Date(Date.now()+30*86400000).toISOString();
 assert.equal((await run(request({...base,expires_at:chosen}))).status,201);assert.equal(saved[1].expires_at,chosen);
 assert.equal((await run(request({...base,expires_at:new Date(Date.now()-1000).toISOString()}))).status,400);
 assert.equal((await run(request({...base,expires_at:'not a date'}))).status,400);assert.equal(saved.length,2);
});

test('resolve accepts a key with no expiry and filters a chosen expiry against now',async()=>{
 const filters=[];const chain={select(){return this;},eq(){return this;},is(){return this;},or(value){filters.push(value);return this;},update(){return this;},maybeSingle:async()=>({data:{id:'key',chat_user_id:'owner'}})};
 const run=handler({from:()=>chain});
 assert.equal((await run(request({action:'resolve',token_hash:'a'.repeat(64)}))).status,200);
 assert.equal(filters.length,2,'both the lookup and the last-used touch apply it');
 for(const value of filters) assert.match(value,/^expires_at\.is\.null,expires_at\.gt\."\d{4}-\d{2}-\d{2}T[\d:.]+Z"$/);
});
