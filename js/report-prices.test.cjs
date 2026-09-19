'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
// Uses the existing integration workspace's jsdom dependency via NODE_PATH.
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('./report-prices.js'),'utf8');
const data=value=>({available:true,version:value,products:{cable:{usageCredits:value,batches:[{quantity:5,usageCredits:15}]},sap:{usageCredits:20,batches:[]},lighting:{usageCredits:20,batches:[]}}});
async function fixture(initial){
 const dom=new JSDOM('<div id="report-price-cards"></div><p id="report-price-status"></p><button id="refresh-report-prices"></button>',{url:'https://adelphos.ai/pricing/',runScripts:'outside-only'});
 const win=dom.window;let payload=initial;
 win.fetch=async()=>({ok:true,json:async()=>payload});win.AbortSignal=AbortSignal;win.setInterval=()=>0;win.console.error=()=>{};
 vm.runInContext(source,dom.getInternalVMContext());await new Promise(setImmediate);
 return {dom,win,set:value=>payload=value,refresh:async()=>{win.document.getElementById('refresh-report-prices').click();await new Promise(setImmediate);}};
}
test('published standard and batch prices render and update after refresh',async()=>{
 const f=await fixture(data(20));const cards=f.win.document.getElementById('report-price-cards');
 assert.ok(cards.textContent.includes('20 UC'));assert.ok(cards.textContent.includes('Batch of 5: 15 UC each (75 UC total)'));assert.ok(cards.textContent.includes('including all houses'));
 f.set(data(25));await f.refresh();assert.ok(cards.textContent.includes('25 UC'));assert.equal(cards.dataset.priceVersion,'25');f.dom.window.close();
});
test('unpublished catalogue never displays the suggested draft price',async()=>{
 const f=await fixture({available:false});assert.equal(f.win.document.getElementById('report-price-cards').children.length,0);assert.ok(f.win.document.getElementById('report-price-status').textContent.includes('when published'));f.dom.window.close();
});
test('a failed refresh clears stale displayed prices',async()=>{
 const f=await fixture(data(20));f.win.fetch=async()=>({ok:false});await f.refresh();assert.equal(f.win.document.getElementById('report-price-cards').children.length,0);assert.ok(f.win.document.getElementById('report-price-status').textContent.includes('temporarily unavailable'));f.dom.window.close();
});
