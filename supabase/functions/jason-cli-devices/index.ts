// Internal bridge. No customer bearer token or Supabase service key is returned.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fields = "id,name,scopes,created_at,expires_at,last_used_at,revoked_at,token_prefix,token_suffix";
serve(async (req) => {
  const expected = Deno.env.get("ADELPHOS_METERING_SERVICE_TOKEN") || "";
  const supplied = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a,b] = await Promise.all([digest(expected),digest(supplied)]);
  let mismatch = 0; for(let i=0;i<a.length;i++) mismatch |= a[i]^b[i];
  if (!expected || mismatch || req.method !== "POST") return json({error:"Unauthorized"},401);
  try {
    const body = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const table = () => db.from("adelphos_cli_devices");
    if(body.action === "resolve") {
      if(!/^[a-f0-9]{64}$/.test(body.token_hash || "")) return json({error:"Credential refused"},401);
      const {data,error} = await table().select("id,chat_user_id,tenant_id,owner_email,scopes").eq("token_hash",body.token_hash).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
      if(error) throw error;
      if(!data) return json({error:"Credential refused"},401);
      const touched = await table().update({last_used_at:new Date().toISOString()}).eq("id",data.id).is("revoked_at",null).gt("expires_at",new Date().toISOString()).select("id").maybeSingle();
      if(touched.error) throw touched.error;
      if(!touched.data) return json({error:"Credential refused"},401);
      return json(data);
    }
    if(body.action === "admin_revoke" || body.action === "admin_revoke_receipt" || body.action === "owner_revoke" || body.action === "owner_revoke_receipt") {
      const {data,error}=await db.rpc("adelphos_admin_revoke_cli_key",{
        p_request_id:body.requestId,p_actor_id:body.actorId,p_actor_email:body.actorEmail,
        p_key_id:body.targetId,p_reason:body.reason,p_read_only:body.action.endsWith("_receipt"),
        p_mode:body.action.startsWith("owner_") ? "owner" : "staff",p_tenant:body.action.startsWith("owner_") ? body.tenantId : null
      });
      if(error) {
        console.error("Jason CLI audit action refused",error.code);
        const status=error.code === "23505" ? 409 : error.code === "P0002" ? 404 : ["22023","22P02"].includes(error.code) ? 400 : 503;
        return json({error:status===409 ? "Action ID conflict" : status===404 ? "Key not found" : "Key action unavailable"},status);
      }
      return data ? json(data) : json({error:"Action outcome not confirmed"},404);
    }
    const user = String(body.chat_user_id || ""), tenant = String(body.tenant_id || ""), email = String(body.owner_email || "").trim().toLowerCase();
    if(!user || !tenant || !email.includes("@")) return json({error:"Owner required"},400);
    if(body.action === "register") {
      const name=String(body.name || "").trim();
      if(!name || name.length>80 || !/^[a-f0-9]{64}$/.test(body.token_hash || "") || !/^jcli_[0-9a-f]{6}$/.test(body.token_prefix || "") || !/^[0-9a-f]{4}$/.test(body.token_suffix || "")) return json({error:"Invalid device"},400);
      const {data,error}=await table().insert({chat_user_id:user,tenant_id:tenant,owner_email:email,name,token_hash:body.token_hash,token_prefix:body.token_prefix,token_suffix:body.token_suffix}).select(fields).single();
      if(error) throw error;
      return json(data,201);
    }
    if(body.action === "list") {
      const {data,error}=await table().select(fields).eq("chat_user_id",user).eq("tenant_id",tenant).order("created_at",{ascending:false});
      if(error) throw error;
      return json({devices:data});
    }
    return json({error:"Unknown operation"},400);
  } catch {
    console.error("Jason CLI registry operation failed");
    return json({error:"Device service unavailable"},503);
  }
});
