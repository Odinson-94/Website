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
 let updated=false;const chain={select(){return this;},eq(){return this;},is(){return this;},gt(){return this;},update(){updated=true;return this;},maybeSingle:async()=>({data:updated?null:{id:'key',chat_user_id:'owner'}})};
 const run=handler({from:()=>chain});assert.equal((await run(request({action:'resolve',token_hash:'a'.repeat(64)}))).status,401);
});
test('unauthorized callers never access DB and action conflict has stable409',async()=>{
 let calls=0;const run=handler({rpc:async()=>{calls++;return {error:{code:'23505',message:'private-canary'}};}});
 assert.equal((await run(new Request('http://local.invalid',{method:'POST'}))).status,401);assert.equal(calls,0);
 const res=await run(request({action:'admin_revoke'}));assert.equal(res.status,409);assert.ok(!(await res.text()).includes('private-canary'));
});
