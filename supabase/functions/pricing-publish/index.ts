// Verified Sales administrators enter through Chat. This endpoint accepts only
// the existing service-role credential, never a browser JWT or browser price.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {"Content-Type":"application/json", "Cache-Control":"no-store"}});
serve(async req => {
 if(req.method!=="POST") return json({error:"Method not allowed."},405);
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const supplied=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!key||!supplied) return json({error:"Service authentication required."},401);
 // Supabase may have multiple valid service keys during rotation. Prove the
 // supplied credential against this project's private service-only table;
 // browser roles have neither table SELECT nor an RLS policy here.
 if(supplied!==key){
  const authority=createClient(Deno.env.get("SUPABASE_URL")!,supplied,{auth:{persistSession:false}});
  const probe=await authority.from("adelphos_report_price_catalogue").select("id").eq("id",true).maybeSingle();
  if(probe.error||!probe.data?.id) return json({error:"Service authentication required."},401);
 }
 const db=createClient(Deno.env.get("SUPABASE_URL")!,key,{auth:{persistSession:false}});
 try {
  const body=await req.json();
  if(body.action==="verify"){
   const {data:c,error}=await db.from("adelphos_report_price_catalogue").select("published_revision,economics_published,published_credit_plan").eq("id",true).single();
   if(error||!c.economics_published) return json({confirmed:false});
   const {data:plan,error:planError}=await db.from("adelphos_billing_plans").select("price_cents,currency,top_up_usage_credits,stripe_price_id,metadata,active,is_active").eq("code",c.published_credit_plan).single();
   if(planError) throw planError;
   const mode=plan.metadata?.stripe_mode;
   if(!["live","test"].includes(mode)) throw new Error("Credit sale mode missing.");
   const secret=mode==="live"?Deno.env.get("STRIPE_LIVE_SECRET_KEY"):Deno.env.get("STRIPE_TEST_SECRET_KEY")||Deno.env.get("STRIPE_SECRET_KEY");
   if(!secret||!new RegExp(`^(sk|rk)_${mode}_`).test(secret)) throw new Error("Credit sale provider unavailable.");
   const stripe=new Stripe(secret,{apiVersion:"2024-06-20",httpClient:Stripe.createFetchHttpClient()});
   const price=await stripe.prices.retrieve(plan.stripe_price_id);
   const retail=c.economics_published.retail;
   return json({confirmed:plan.active&&plan.is_active&&price.active&&price.type==="one_time"&&price.livemode===(mode==="live")&&price.currency===retail.currency.toLowerCase()&&price.unit_amount===retail.packPriceMinor&&plan.price_cents===price.unit_amount&&Number(plan.top_up_usage_credits)===retail.packCredits,version:c.published_revision,packPriceMinor:price.unit_amount,packCredits:Number(plan.top_up_usage_credits),currency:price.currency});
  }
  const {p_request_id,p_actor,p_reason,p_revision}=body;
  if(!/^[0-9a-f-]{36}$/i.test(p_request_id)||typeof p_actor!=="string"||!/^[^@\s]+@adelphos\.ai$/.test(p_actor)||typeof p_reason!=="string"||p_reason.trim().length<5||p_reason.trim().length>500||!Number.isSafeInteger(p_revision)) return json({error:"Invalid pricing action."},400);
  const command={actor:p_actor,action:"publish",reason:p_reason.trim(),revision:p_revision,prices:null,economics:null};
  const {data:prior,error:priorError}=await db.from("adelphos_report_price_actions").select("input,result").eq("request_id",p_request_id).maybeSingle();
  if(priorError) throw priorError;
  if(prior){
   if(Object.keys(command).some(k=>JSON.stringify(prior.input[k])!==JSON.stringify(command[k as keyof typeof command]))) return json({error:"Pricing action ID conflict."},409);
   return json(prior.result);
  }
  const {data:c,error}=await db.from("adelphos_report_price_catalogue").select("revision,economics_draft,published_credit_plan").eq("id",true).single();
  if(error) throw error;
  if(c.revision!==p_revision) return json({error:"Pricing revision conflict. Reload before publishing."},409);
  const {data:plan,error:planError}=await db.from("adelphos_billing_plans").select("price_cents,currency,stripe_price_id,metadata").eq("code",c.published_credit_plan).single();
  if(planError) throw planError;
  let prepared=null;
  if(plan.price_cents!==c.economics_draft.retail.packPriceMinor){
   const mode=plan.metadata?.stripe_mode;
   if(!["live","test"].includes(mode)) throw new Error("Credit sale mode missing.");
   const stripeKey=mode==="live" ? Deno.env.get("STRIPE_LIVE_SECRET_KEY") : Deno.env.get("STRIPE_TEST_SECRET_KEY")||Deno.env.get("STRIPE_SECRET_KEY");
   if(!stripeKey||!new RegExp(`^(sk|rk)_${mode}_`).test(stripeKey)) throw new Error("Credit sale provider unavailable.");
   const stripe=new Stripe(stripeKey,{apiVersion:"2024-06-20",httpClient:Stripe.createFetchHttpClient()});
   const original=await stripe.prices.retrieve(plan.stripe_price_id);
   const product=typeof original.product==="string"?original.product:original.product.id;
   const price=await stripe.prices.create({currency:"gbp",unit_amount:c.economics_draft.retail.packPriceMinor,product,lookup_key:`adelphos-payg-${p_revision}-${p_request_id}`,metadata:{pricing_revision:String(p_revision)}},{idempotencyKey:`adelphos-pricing-${p_request_id}`});
   if(price.unit_amount!==c.economics_draft.retail.packPriceMinor||price.currency!=="gbp"||price.livemode!==(mode==="live")||price.type!=="one_time") throw new Error("Prepared credit price mismatch.");
   prepared={id:price.id,currency:price.currency,unit_amount:price.unit_amount,livemode:price.livemode,lookup_key:price.lookup_key};
  }
  const result=await db.rpc("adelphos_change_commercial_prices",{p_request_id,p_actor,p_reason,p_revision,p_action:"publish",p_prices:null,p_economics:null,p_stripe_price:prepared});
  if(result.error) throw result.error;
  return json(result.data);
 } catch(error){
  console.error("[sales_pricing.publish_failed]",error instanceof Error?error.message:String(error));
  return json({error:"Publication failed. Reload to verify the saved revision before retrying."},409);
 }
});
