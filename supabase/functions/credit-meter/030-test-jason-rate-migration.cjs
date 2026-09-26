// Execute the migration in PostgreSQL (PGlite), including its transactional guards.
// Run with ADELPHOS_PGLITE_PATH pointing at an installed @electric-sql/pglite package.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.ADELPHOS_PGLITE_PATH || '@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../../migrations/20260926010000_enable_jason_provider_rates.sql'),'utf8');
const previous=fs.readFileSync(path.join(__dirname,'../../migrations/20260918020000_extend_exact_helper_model_rates.sql'),'utf8');
const oldGate=previous.match(/new_gate text := \$gate\$([\s\S]*?)\$gate\$/)[1];
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 create table adelphos_provider_rate_card(rate_code text primary key,model text,component text,usd_per_million_units numeric,context_class text,factor_code text,effective_from timestamptz,effective_until timestamptz,source_url text,source_effective_date date,active boolean);
 create table adelphos_token_price_products(code text primary key,model text,factor_code text,component text,context_class text,unique(model,factor_code,component,context_class));
 create function adelphos_current_token_prices() returns jsonb language sql as $$ select coalesce(jsonb_object_agg(p.code,r.usd_per_million_units),'{}'::jsonb) from adelphos_token_price_products p join adelphos_provider_rate_card r using(model,factor_code,component,context_class) where r.active $$;
 create table adelphos_report_price_catalogue(id boolean primary key,economics_draft jsonb,economics_published jsonb,token_price_baseline jsonb,revision int,updated_at timestamptz);
 insert into adelphos_provider_rate_card values('old','legacy','uncached_input',20,'standard','standard',now(),null,'old','2026-09-17',true);
 insert into adelphos_token_price_products values('old-key','legacy','standard','uncached_input','standard');
 insert into adelphos_report_price_catalogue values(true,'{"retail":{"unchanged":true},"tokenRates":{"old-key":25}}','{"retail":{"unchanged":true},"tokenRates":{"old-key":20}}','{"old-key":20}',7,now());
 create function adelphos_reserve_credits(p_email text,p_project_id text,p_request_id text,p_request_kind text,p_model text,p_reserve_usage_credits numeric,p_metadata jsonb) returns jsonb language plpgsql as $$ begin ${oldGate} return jsonb_build_object('allowed',true); end $$;
 `);
 return db;
}
test('migration adds exact rates, keeps history/draft edits and updates the real SQL gate',async()=>{
 const db=await fixture();
 try {
  await db.exec(migration);
  const {rows}=await db.query("select model,factor_code,component,usd_per_million_units from adelphos_provider_rate_card where model like 'gpt-%'");
  assert.equal(rows.length,36);
  const prices={'gpt-5.6-sol':[4,.4,5,20],'gpt-6-sol':[2,.2,2.5,10],'gpt-6-astra':[10,1,12.5,50]};
  const components=['uncached_input','cache_read','cache_write_5m','billable_output'];
  for(const row of rows) assert.equal(Number(row.usd_per_million_units),Number((prices[row.model][components.indexOf(row.component)]*{standard:4,schematic:20,helper:1.1}[row.factor_code]).toFixed(9)));
  const c=(await db.query('select * from adelphos_report_price_catalogue')).rows[0];
  assert.equal(c.revision,8);
  assert.equal(c.economics_draft.tokenRates['old-key'],25);
  assert.equal(c.economics_published.tokenRates['old-key'],20);
  assert.equal(c.token_price_baseline['old-key'],20);
  assert.equal(Object.keys(c.token_price_baseline).length,37);
  assert.deepEqual(c.economics_draft.retail,{unchanged:true});
  for(const model of Object.keys(prices)) {
   const r=await db.query("select adelphos_reserve_credits('a','p','r','chat',$1,1,'{}') as result",[model]);
   assert.equal(r.rows[0].result.allowed,true);
  }
  await assert.rejects(db.query("select adelphos_reserve_credits('a','p','r','chat','unpriced',1,'{}')"),/not configured/);
  await assert.rejects(db.exec(migration),/already exist/);
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as count from adelphos_provider_rate_card')).rows[0].count,37);
 }finally{await db.close();}
});
test('a concurrent pricing change rolls back without adding or overwriting rates',async()=>{
 const db=await fixture();
 try {
  await db.exec("update adelphos_provider_rate_card set usd_per_million_units=30 where rate_code='old'");
  await assert.rejects(db.exec(migration),/Pricing baseline changed/);
  await db.exec('rollback');
  const r=(await db.query('select * from adelphos_provider_rate_card')).rows;
  assert.equal(r.length,1);assert.equal(Number(r[0].usd_per_million_units),30);
 }finally{await db.close();}
});
