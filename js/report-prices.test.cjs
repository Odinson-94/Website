'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
// Uses the existing integration workspace's jsdom dependency via NODE_PATH.
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('./report-prices.js'),'utf8');
const data=value=>({available:true,version:value,retail:{currency:'GBP',packCredits:15,packPriceMinor:value*100},tokenRates:[{model:'test-model',tier:'standard',component:'uncached_input',context:'standard',usageCreditsPerMillion:value}],products:{
 cable:{name:'Cable',unit:'calculation',mode:'report',usageCredits:value,batches:[{quantity:5,usageCredits:15}]},
 sap:{name:'SAP',unit:'project, including all houses',mode:'report',usageCredits:20,batches:[]},
 roomplanner:{name:'Building Generator',unit:'project',mode:'report',usageCredits:24,batches:[]},
 browser:{name:'Browser',mode:'included',usageCredits:null,batches:[]},
 adelphos:{name:'Adelphos',mode:'usage',usageCredits:null,batches:[]}
}});
async function fixture(initial){
 const dom=new JSDOM('<div id="published-credit-prices"></div><div id="published-token-prices"></div><p id="credit-pack-description"></p><button data-checkout-plan="payg-20"></button><div id="report-price-cards"></div><p id="report-price-status"></p><button id="refresh-report-prices"></button>',{url:'https://adelphos.ai/pricing/',runScripts:'outside-only'});
 const win=dom.window;let payload=initial;
 win.fetch=async()=>({ok:true,json:async()=>payload});win.AbortSignal=AbortSignal;win.setInterval=()=>0;win.console.error=()=>{};
 vm.runInContext(source,dom.getInternalVMContext());await new Promise(setImmediate);
 return {dom,win,set:value=>payload=value,refresh:async()=>{win.document.getElementById('refresh-report-prices').click();await new Promise(setImmediate);}};
}
test('published standard and batch prices render and update after refresh',async()=>{
 const f=await fixture(data(20));const cards=f.win.document.getElementById('report-price-cards');
 assert.equal(cards.children.length,5);assert.ok(cards.textContent.includes('Building Generator'));assert.ok(cards.textContent.includes('24 UC'));assert.ok(cards.textContent.includes('AI usage'));assert.ok(cards.textContent.includes('Included'));assert.ok(!cards.textContent.includes('null'));assert.ok(cards.textContent.includes('20 UC'));assert.ok(cards.textContent.includes('Batch of 5: 15 UC each (75 UC total)'));assert.ok(cards.textContent.includes('including all houses'));
 assert.equal(f.win.document.getElementById('published-token-prices').textContent,'');
 f.set(data(25));await f.refresh();assert.ok(f.win.document.getElementById('credit-pack-description').textContent.includes('£25'));assert.equal(f.win.document.getElementById('published-token-prices').textContent,''); assert.ok(cards.textContent.includes('25 UC'));assert.equal(cards.dataset.priceVersion,'25');f.dom.window.close();
});
test('unpublished catalogue never displays the suggested draft price',async()=>{
 const f=await fixture({available:false});assert.equal(f.win.document.getElementById('report-price-cards').children.length,0);assert.ok(f.win.document.getElementById('report-price-status').textContent.includes('when published'));f.dom.window.close();
});
test('a failed refresh clears stale displayed prices',async()=>{
 const f=await fixture(data(20));f.win.fetch=async()=>({ok:false});await f.refresh();assert.equal(f.win.document.getElementById('report-price-cards').children.length,0);assert.ok(f.win.document.getElementById('report-price-status').textContent.includes('temporarily unavailable'));f.dom.window.close();
});

// #region ADELPHOS-SESSION 2026-09-20/public-pricing/01a0b8b9
// CHANGELOG: 2026-09-20 — Verify provider names stay off public pricing across refreshes.
// what: Exercise real rendering with an internal rate payload and without token data.
// why: Keep app publishing working after removing the public provider breakdown.
test('internal model rates never render and are not required for app prices',async()=>{
 const payload=data(20);payload.tokenRates[0].model='claude-opus-internal';
 const f=await fixture(payload);assert.ok(!f.win.document.body.textContent.includes('claude-opus-internal'));
 f.win.document.getElementById('published-token-prices').textContent='legacy provider card';
 const next=data(25);delete next.tokenRates;f.set(next);await f.refresh();
 assert.equal(f.win.document.getElementById('published-token-prices').textContent,'');
 assert.ok(f.win.document.getElementById('report-price-cards').textContent.includes('25 UC'));
 f.dom.window.close();
});
// #endregion ADELPHOS-SESSION 01a0b8b9
