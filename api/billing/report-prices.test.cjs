'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./report-prices');
const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
afterEach(() => {
 global.fetch = originalFetch;
 if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
 if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});
async function run(method='GET') {
 const result = {headers:{}};
 await handler({method}, {setHeader:(k,v)=>result.headers[k]=v,set statusCode(v){result.status=v;},end:s=>result.body=JSON.parse(s)});
 return result;
}
function setup(payload) {
 process.env.SUPABASE_URL='https://pricing.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';
 global.fetch=async(url,options)=>{
  assert.equal(url,'https://pricing.test/rest/v1/rpc/adelphos_published_report_prices');
  assert.equal(options.body,'{}');
  return {ok:true,json:async()=>payload};
 };
}
test('unpublished catalogue has no fabricated price',async()=>{setup(null);const r=await run();assert.equal(r.status,200);assert.equal(r.body.available,false);assert.equal(r.body.products,undefined);});
test('only published fields escape and response bypasses caches',async()=>{
 const price={name:'New app',appKey:'newapp',unit:'project',mode:'report',usageCredits:20,batches:[{quantity:5,usageCredits:15,private:'secret'}]};
 setup({version:3,publishedAt:'2026-09-19T00:00:00Z',products:{cable:price,sap:price,lighting:price,roomplanner:price,internal:{...price,mode:'internal'},browser:{...price,mode:'included',usageCredits:null,batches:[]}},draft:{secret:true},actor:'private@test'});
 const r=await run();assert.equal(r.body.version,3);assert.equal(r.body.products.sap.usageCredits,20);assert.equal(r.body.identicalDownloadsFree,true);assert.equal(r.body.contractVersion,2);assert.equal(r.body.products.roomplanner.usageCredits,20);assert.equal(r.body.products.internal,undefined);assert.equal(r.body.products.browser.usageCredits,null);
 assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['Vercel-CDN-Cache-Control'],'no-store');
 assert.equal(JSON.stringify(r.body).includes('secret'),false);assert.equal(r.body.actor,undefined);assert.equal(r.body.draft,undefined);
});
test('API fails closed and does not expose credentials or backend errors',async()=>{setup(null);global.fetch=async()=>{throw new Error('test-only-secret')};const r=await run();assert.equal(r.status,503);assert.equal(JSON.stringify(r.body).includes('test-only-secret'),false);});
test('public endpoint refuses mutation without making an upstream call',async()=>{global.fetch=async()=>assert.fail('Unexpected call');assert.equal((await run('POST')).status,405);});
