import test from "node:test";
import assert from "node:assert/strict";
import {api} from "./worker.mjs";
const site="https://site.example", env={RESEARCH_SERVER_ORIGIN:"https://app.example"};
test("unconnected UI and scoped origin forwarding",async(t)=>{
 const mode=await api(new Request(site+"/api/mode"),{});
 assert.equal((await mode.json()).serverPending,true);
 assert.equal((await api(new Request(site+"/api/projects"),{})).status,503);
 const post=(origin)=>new Request(site+"/api/login",{method:"POST",headers:{origin,cookie:"site-auth=private; sb-unit-auth-token.0=abc","content-type":"application/json"},body:"{}"});
 assert.equal((await api(post("https://else.example"),env)).status,403);
 const stub=t.mock.method(globalThis,"fetch",async(url,init)=>{
  assert.equal(url.href,env.RESEARCH_SERVER_ORIGIN+"/api/login");
  assert.equal(init.headers.get("cookie"),"sb-unit-auth-token.0=abc");
  assert.equal(init.headers.get("origin"),env.RESEARCH_SERVER_ORIGIN);
  return new Response("{}",{headers:{"set-cookie":"sb-unit-auth-token.0=fresh; Domain=app.example; Path=/","content-type":"application/json"}});
 });
 const ok=await api(post(site),env);
 assert.equal(ok.status,200);
 assert.match(ok.headers.get("set-cookie"),/HttpOnly/i);
 assert.doesNotMatch(ok.headers.get("set-cookie"),/domain/i);
 assert.equal(stub.mock.callCount(),1);
});
