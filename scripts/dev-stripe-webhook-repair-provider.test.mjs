import {afterEach,describe,expect,it,vi} from "vitest";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createBindingRepairProvider} from "./notify-secret-binding-repair-provider.mjs";
import {prepareRepair,applySecret,applyFunction,verifyFunction,applySubscriptions,verifyRepair} from "./dev-stripe-webhook-repair-lib.mjs";
import {fixture as coreFixture,KEY,NOW,CANDIDATE,context} from "./test-fixtures/dev-stripe-webhook-repair-fixture.mjs";
import {createDevStripeWebhookProvider,DevStripeWebhookProviderError} from "./dev-stripe-webhook-repair-provider.mjs";
vi.mock("node:child_process",()=>({execFileSync:vi.fn()}));
vi.mock("./notify-secret-binding-repair-provider.mjs",async importOriginal=>{
 const original=await importOriginal();return {...original,createBindingRepairProvider:vi.fn(original.createBindingRepairProvider)};
});
const PROJECT="sodc-web",NUMBER="931675247602",REGION="europe-west2";
const PREFIX=`projects/${PROJECT}/locations/${REGION}`,TARGET=`${PREFIX}/functions/stripeWebhookPayments`;
const SIGNING="STRIPE_WEBHOOK_SECRET_PAYMENTS",ENDPOINT="we_1TOixKEJWVZaraSfeonnSQby",ACCOUNT="acct_1SgTanEJWVZaraSf";
const KEYS=["STRIPE_SECRET",SIGNING,"GOV_NOTIFY_LIVE_API_KEY","GOV_NOTIFY_TEST_API_KEY","GOV_NOTIFY_TEAM_API_KEY"];
const EVENTS=["checkout.session.completed","checkout.session.async_payment_failed","checkout.session.expired","charge.refunded","charge.dispute.created","charge.dispute.closed","charge.dispute.updated","checkout.session.async_payment_succeeded","refund.created","refund.updated","refund.failed"];
const BUILD=`projects/${NUMBER}/locations/${REGION}/builds/11111111-1111-4111-8111-111111111111`;
const OPERATION=`${PREFIX}/operations/repair-1`;
const ref={bucket:`gcf-v2-sources-${NUMBER}-${REGION}`,object:"stripeWebhookPayments/function-source.zip",generation:"123456"};
const binding=(key,version="1")=>({key,secret:key,projectId:PROJECT,version});
const metadata=(secret,version="1")=>({name:`projects/${NUMBER}/secrets/${secret}/versions/${version}`,state:"ENABLED",createTime:"2026-11-20T12:00:00Z"});
const clone=value=>structuredClone(value);
function hasOrigin(url,expected) {const parsed=new URL(url);return parsed.origin===expected && parsed.username==="" && parsed.password==="";}

function fixture({modify,override,timeoutMs=30000,tokenProvider}={}) {
 const target={name:TARGET,state:"ACTIVE",environment:"GEN_2",updateTime:"2026-11-19T10:03:00Z",buildConfig:{runtime:"nodejs24",entryPoint:"stripeWebhookPayments",build:BUILD,source:{storageSource:clone(ref)},sourceProvenance:{resolvedStorageSource:clone(ref)},environmentVariables:{INTERNAL:"PRIVATE_ENV"}},
  serviceConfig:{service:`${PREFIX}/services/stripewebhookpayments`,serviceAccountEmail:`${NUMBER}-compute@developer.gserviceaccount.com`,allTrafficOnLatestRevision:true,revision:"stripewebhookpayments-00136-koh",maxInstanceCount:20,secretEnvironmentVariables:KEYS.map(key=>binding(key)),environmentVariables:{GOV_NOTIFY_DELIVERY_MODE:"SIMULATION"}}};
 const other={name:`${PREFIX}/functions/existingSender`,serviceConfig:{service:`${PREFIX}/services/existingsender`,secretEnvironmentVariables:[...KEYS.filter(k=>k!==SIGNING).map(key=>binding(key)),binding("NOTIFY_CALLBACK_BEARER","3")]}};
 const input={project:{projectId:PROJECT,projectNumber:NUMBER},functions:[target,other],schedulers:[{name:`${PREFIX}/jobs/job-1`,state:"ENABLED"}],
  endpoint:{id:ENDPOINT,object:"webhook_endpoint",url:`https://${REGION}-${PROJECT}.cloudfunctions.net/stripeWebhookPayments`,api_version:"2026-03-25.dahlia",livemode:false,status:"enabled",application:null,created:1776795810,description:null,metadata:{},enabled_events:EVENTS.slice(0,7)},
  build:{name:BUILD,id:BUILD.split("/").at(-1),status:"SUCCESS",createTime:"2026-11-19T10:00:00Z",startTime:"2026-11-19T10:01:00Z",finishTime:"2026-11-19T10:02:00Z",sourceProvenance:{resolvedStorageSource:clone(ref)}},
  signingVersions:[metadata(SIGNING)],signingPayloads:{},archiveBytes:Buffer.from("PK\\x03\\x04PRIVATE_ZIP_SOURCE_BYTES"),accountId:ACCOUNT};
 modify?.(input);
 const route=(url,options)=>{
  const parsed=new URL(url),p=parsed.pathname;
  if(parsed.username || parsed.password) throw new Error("Unexpected offline route");
  if(url===`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`) return input.project;
  if(url===`https://cloudfunctions.googleapis.com/v2/${PREFIX}/functions?pageSize=1000`) return {functions:input.functions};
  if(url===`https://cloudscheduler.googleapis.com/v1/${PREFIX}/jobs?pageSize=500`) return {jobs:input.schedulers};
  if(parsed.origin==="https://run.googleapis.com" && p.endsWith(":getIamPolicy")) return {version:3,bindings:[]};
  if(parsed.origin==="https://secretmanager.googleapis.com") {
   const match=/^\/v1\/projects\/[^/]+\/secrets\/([^/:]+)(.*)$/.exec(p); if(!match) throw new Error("bad secret fixture route");
   const [,secret,suffix]=match;
   if(suffix===":getIamPolicy") return {version:3,bindings:[{role:"roles/secretmanager.secretAccessor",members:[`serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com`]}]};
   if(suffix==="/versions" && secret===SIGNING) return {versions:input.signingVersions};
   if(suffix===":addVersion" && secret===SIGNING && options.method==="POST") {input.signingVersions.push(metadata(SIGNING,"2"));input.signingPayloads["2"]=Buffer.from(JSON.parse(options.body).payload.data,"base64").toString("utf8");return metadata(SIGNING,"2");}
   const access=/^\/versions\/([1-9][0-9]*):access$/.exec(suffix);
   if(access) return {name:`projects/${NUMBER}/secrets/${secret}/versions/${access[1]}`,payload:{data:Buffer.from(secret==="STRIPE_SECRET"?`sk_test_FAKE_V${access[1]}`:input.signingPayloads[access[1]]??"whsec_PRIVATESIGNINGVALUE").toString("base64")}};
   const version=/^\/versions\/([1-9][0-9]*|latest)$/.exec(suffix);
   if(version) return metadata(secret,version[1]==="latest"?(secret==="NOTIFY_CALLBACK_BEARER"?"3":secret===SIGNING?input.signingVersions.at(-1).name.split("/").at(-1):secret==="STRIPE_SECRET"?input.functions[0].serviceConfig.secretEnvironmentVariables.find(value=>value.key==="STRIPE_SECRET").version:"1"):version[1]);
  }
  if(parsed.origin==="https://api.stripe.com") {
   if(p==="/v1/account") return {id:input.accountId,business_profile:{name:"PRIVATE_ACCOUNT_DETAILS"}};
   if(p===`/v1/webhook_endpoints/${ENDPOINT}`) {
    if(options.method==="POST") {input.endpoint.enabled_events=new URLSearchParams(options.body).getAll("enabled_events[]");return input.endpoint;}
    return input.endpoint;
   }
   if(p==="/v1/webhook_endpoints") return {object:"list",data:[input.endpoint],has_more:false};
  }
  if(parsed.origin==="https://storage.googleapis.com") return new Response(input.archiveBytes,{headers:{"content-length":String(input.archiveBytes.length)}});
  if(url===`https://cloudbuild.googleapis.com/v1/${input.build.name}`) return input.build;
  if(url===`https://cloudfunctions.googleapis.com/v2/${TARGET}`) return input.functions[0];
  if(url===`https://cloudfunctions.googleapis.com/v2/${TARGET}?updateMask=serviceConfig.secretEnvironmentVariables` && options.method==="PATCH") {input.functions[0].serviceConfig.secretEnvironmentVariables=JSON.parse(options.body).serviceConfig.secretEnvironmentVariables;return {name:OPERATION,done:false,metadata:{target:TARGET,verb:"update"}};}
  if(url===`https://cloudfunctions.googleapis.com/v2/${OPERATION}`) return {name:OPERATION,done:true,metadata:{target:TARGET,verb:"update",buildName:input.build.name},response:{name:TARGET,serviceConfig:{environmentVariables:{PRIVATE:"MUST_NOT_ESCAPE"}}}};
  throw new Error("Unexpected offline route");
 };
 const fetchImpl=vi.fn(async(url,options)=>{
  const value=await override?.(url,options,route);
  const result=value??route(url,options);
  return result instanceof Response?result:Response.json(result);
 });
 const token=tokenProvider??vi.fn(async()=>"PRIVATE_GCP_TOKEN");
 const provider=createDevStripeWebhookProvider({tokenProvider:token,fetchImpl,timeoutMs});
 return {input,provider,fetchImpl,route,token};
}
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});
const writes=f=>f.fetchImpl.mock.calls.filter(([,options])=>options.method!=="GET");

describe("fixed Dev Stripe webhook correction provider",()=>{
 it("matches exact HTTPS provider origins and rejects lookalike hosts, schemes, ports and credentials",()=>{
  const f=fixture();
  for(const origin of ["https://api.stripe.com","https://storage.googleapis.com"]) {
   expect(hasOrigin(origin+"/v1/account",origin)).toBe(true);
   for(const value of [origin+".attacker.test/v1/account",origin+":444/v1/account",origin.replace("https:","http:")+"/v1/account",
    origin.replace("https://","https://user@")+"/v1/account",origin+"@attacker.test/v1/account"]) {
    expect(hasOrigin(value,origin)).toBe(false);
    expect(()=>f.route(value,{method:"GET"})).toThrow("Unexpected offline route");
   }
  }
  expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("has only the new fixed-scope facade and constructs without reading credentials",()=>{
  const fetchImpl=vi.fn();const provider=createDevStripeWebhookProvider({fetchImpl});
  expect(Object.keys(provider).sort()).toEqual(["accessSecretVersion","addSecretVersion","build","operation","patchFunctionBindings","snapshot","updateSubscriptions"].sort());
  expect(provider.patchBindings).toBeUndefined();expect(fetchImpl).not.toHaveBeenCalled();expect(execFileSync).not.toHaveBeenCalled();
 });
 it.each([{projectId:"sodc-web-production"},{region:"us-central1"},{timeoutMs:30001},{timeoutMs:0}])("rejects scope/timeout overrides before authentication (%j)",options=>{
  expect(()=>createDevStripeWebhookProvider(options)).toThrow(DevStripeWebhookProviderError);expect(execFileSync).not.toHaveBeenCalled();
 });
 it("captures baseline metadata, all additional bound-secret metadata/policies, Stripe inventory and actual generation-bound streaming archive digests",async()=>{
  const f=fixture();const result=await f.provider.snapshot();
  expect(result.project).toEqual(f.input.project);expect(result.functions).toEqual(f.input.functions);expect(result.schedulers).toEqual(f.input.schedulers);
  expect(result.secretVersions[SIGNING]).toEqual({numeric:metadata(SIGNING),latest:metadata(SIGNING)});
  expect(result.secretVersions.NOTIFY_CALLBACK_BEARER).toEqual({numeric:metadata("NOTIFY_CALLBACK_BEARER","3"),latest:metadata("NOTIFY_CALLBACK_BEARER","3")});
  expect(result.signingPolicy).toEqual(result.secretPolicies[SIGNING]);expect(result.signingVersions).toEqual([metadata(SIGNING)]);
  expect(result.stripe).toEqual({account:{id:ACCOUNT},endpoint:f.input.endpoint,endpoints:[f.input.endpoint]});
  const expected={...ref,sha256:createHash("sha256").update(f.input.archiveBytes).digest("hex"),size:f.input.archiveBytes.length};
  expect(result.targetSourceArchive).toEqual(expected);expect(result.targetBuildArchive).toEqual(expected);
  expect(result.targetBuild).toEqual({name:BUILD,status:"SUCCESS",createTime:f.input.build.createTime,startTime:f.input.build.startTime,finishTime:f.input.build.finishTime,resolvedSource:ref});
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_ZIP_SOURCE_BYTES|PRIVATE_API_KEY|PRIVATE_SIGNING_VALUE|PRIVATE_GCP_TOKEN|PRIVATE_ACCOUNT_DETAILS/);
  expect(writes(f)).toHaveLength(0);
  const stripeCalls=f.fetchImpl.mock.calls.filter(([url])=>hasOrigin(url,"https://api.stripe.com"));
  for(let index=0;index<stripeCalls.length;index++) if(!stripeCalls[index][0].endsWith("/v1/account")) expect(stripeCalls[index-1][0]).toBe("https://api.stripe.com/v1/account");
  for(const [url,options] of f.fetchImpl.mock.calls) {
   expect(options.redirect).toBe("error");expect(options.signal).toBeInstanceOf(AbortSignal);
   expect(url).not.toMatch(/notify\.gov|executeGraphql|\/events(?:\?|\/)|sodc-web-production/);
   if(!hasOrigin(url,"https://api.stripe.com")) expect(options.headers["x-goog-user-project"]).toBe(PROJECT);
  }
  const media=f.fetchImpl.mock.calls.filter(([url])=>url.includes("alt=media"));expect(media).toHaveLength(2);
  for(const [url,options] of media){expect(url).toContain("generation=123456");expect(options.headers["Accept-Encoding"]).toBe("identity");}
 });

 it.each(["project-id","numeric-string","mixed-strings","bound-version-4"])("hands real provider snapshots through core while preserving all five %s project references",async spelling=>{
  const f=fixture({modify:input=>{
   if(spelling==="bound-version-4") for(const fn of input.functions) for(const value of fn.serviceConfig.secretEnvironmentVariables) if(value.key==="STRIPE_SECRET") value.version="4";
   input.functions[0].serviceConfig.secretEnvironmentVariables.forEach((value,index)=>{
    value.projectId=spelling==="numeric-string" || spelling==="mixed-strings" && index%2===0 ? NUMBER : PROJECT;
   });
  }}), core=coreFixture();
  const original=clone(f.input.functions[0].serviceConfig.secretEnvironmentVariables);
  const proposal=prepareRepair({source:core.source,snapshot:await f.provider.snapshot(),comparisonKey:KEY,candidateSecret:CANDIDATE,now:NOW});
  const ctx=context(core,proposal,{provider:f.provider});
  await expect(applySecret(ctx)).resolves.toMatchObject({status:"SECRET_VERSION_CREATED",version:"2"});
  const afterSecret=await f.provider.snapshot();
  expect(afterSecret.secretVersions[SIGNING]).toEqual({numeric:metadata(SIGNING,"1"),latest:metadata(SIGNING,"2")});
  await expect(applyFunction(ctx)).resolves.toMatchObject({status:"FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED"});
  expect(writes(f).map(([,options])=>options.method)).toEqual(["POST","PATCH"]);
  const patched=JSON.parse(writes(f).find(([,options])=>options.method==="PATCH")[1].body).serviceConfig.secretEnvironmentVariables;
  expect(patched).toHaveLength(5);
  for(const before of original) expect(patched.find(value=>value.key===before.key)).toEqual({...before,version:before.key===SIGNING?"2":before.version});
  if(spelling==="bound-version-4") {
   const rebuilt=BUILD.replace("11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222");
   const target=f.input.functions[0];target.serviceConfig.revision="stripewebhookpayments-00137-fixed";target.updateTime=new Date(NOW+20000).toISOString();target.buildConfig.build=rebuilt;
   f.input.build={...f.input.build,name:rebuilt,id:rebuilt.split("/").at(-1),createTime:new Date(NOW+1000).toISOString(),startTime:new Date(NOW+2000).toISOString(),finishTime:new Date(NOW+15000).toISOString()};
   await expect(verifyFunction(ctx)).resolves.toMatchObject({status:"FUNCTION_VERIFIED"});
   await expect(applySubscriptions(ctx)).resolves.toMatchObject({status:"SUBSCRIPTIONS_UPDATED_VERIFY_REQUIRED"});
   await expect(verifyRepair(ctx)).resolves.toMatchObject({status:"PASS",runtimeAcceptancePassed:false,productionAuthorized:false});
   expect(writes(f).map(([,options])=>options.method)).toEqual(["POST","PATCH","POST"]);
   const accesses=f.fetchImpl.mock.calls.filter(([url])=>new URL(url).pathname.includes("/secrets/STRIPE_SECRET/") && new URL(url).pathname.endsWith(":access"));
   expect(accesses).toHaveLength(1);
   expect(accesses[0][0]).toBe(`https://secretmanager.googleapis.com/v1/projects/${NUMBER}/secrets/STRIPE_SECRET/versions/4:access`);
   const stripeCalls=f.fetchImpl.mock.calls.filter(([url])=>hasOrigin(url,"https://api.stripe.com"));
   expect(stripeCalls.length).toBeGreaterThan(0);
   for(const [,options] of stripeCalls) expect(options.headers.Authorization).toBe("Bearer sk_test_FAKE_V4");
   expect(f.fetchImpl.mock.calls.some(([url])=>url.endsWith("/secrets/STRIPE_SECRET/versions/1:access"))).toBe(false);
  }
 });
 it("requires validated bound credential metadata before a subscription update",async()=>{
  const f=fixture();await expect(f.provider.updateSubscriptions({endpointId:ENDPOINT,enabledEvents:EVENTS,idempotencyKey:"dev_intent_long_enough"})).rejects.toThrow("verified-stripe-credential-binding-required");
  expect(f.fetchImpl).not.toHaveBeenCalled();expect(f.token).not.toHaveBeenCalled();
 });
 it.each(["wrong-version","wrong-secret","disabled","payload-in-metadata"])("refuses %s bound Stripe metadata before any payload access or Stripe request",async mode=>{
  const f=fixture({modify:input=>{
   for(const fn of input.functions) for(const value of fn.serviceConfig.secretEnvironmentVariables) if(value.key==="STRIPE_SECRET") value.version="4";
  },override:url=>{
   if(new URL(url).pathname.endsWith("/secrets/STRIPE_SECRET/versions/4")) {
    const value=metadata("STRIPE_SECRET","4");
    if(mode==="wrong-version") value.name=metadata("STRIPE_SECRET","1").name;
    if(mode==="wrong-secret") value.name=metadata("OTHER","4").name;
    if(mode==="disabled") value.state="DISABLED";
    if(mode==="payload-in-metadata") value.payload={data:"unexpected"};
    return value;
   }
  }});
  await expect(f.provider.snapshot()).rejects.toThrow("stripe-bound-secret-metadata-mismatch");
  expect(f.fetchImpl.mock.calls.some(([url])=>new URL(url).pathname.endsWith(":access"))).toBe(false);
  expect(f.fetchImpl.mock.calls.some(([url])=>hasOrigin(url,"https://api.stripe.com"))).toBe(false);
 });
 it("invalidates cached API credentials and remains closed when the bound version changes",async()=>{
  const f=fixture();await f.provider.snapshot();f.fetchImpl.mockClear();
  for(const fn of f.input.functions) for(const value of fn.serviceConfig.secretEnvironmentVariables) if(value.key==="STRIPE_SECRET") value.version="4";
  await expect(f.provider.snapshot()).rejects.toThrow("stripe-credential-binding-changed");
  expect(f.fetchImpl.mock.calls.some(([url])=>new URL(url).pathname.endsWith(":access"))).toBe(false);
  expect(f.fetchImpl.mock.calls.some(([url])=>hasOrigin(url,"https://api.stripe.com"))).toBe(false);
  f.fetchImpl.mockClear();
  await expect(f.provider.updateSubscriptions({endpointId:ENDPOINT,enabledEvents:EVENTS,idempotencyKey:"dev_intent_long_enough"})).rejects.toThrow("verified-stripe-credential-binding-required");
  expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("refuses a nondefault port in the baseline metadata adapter before network work",async()=>{
  createBindingRepairProvider.mockImplementationOnce(({fetchImpl})=>({snapshot:()=>fetchImpl(`https://cloudresourcemanager.googleapis.com:444/v1/projects/${PROJECT}`,{method:"GET"})}));
  const f=fixture();await expect(f.provider.snapshot()).rejects.toThrow("invalid-baseline-provider-route");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("keeps gcloud authentication lazy, bounded and in-memory",async()=>{
  execFileSync.mockReturnValue("PRIVATE_GCP_TOKEN\n");const f=fixture();const provider=createDevStripeWebhookProvider({fetchImpl:f.fetchImpl});
  await provider.snapshot();expect(execFileSync).toHaveBeenCalledTimes(1);
  expect(execFileSync).toHaveBeenCalledWith("gcloud",["auth","print-access-token"],{encoding:"utf8",timeout:30000,maxBuffer:65536,stdio:["ignore","pipe","pipe"]});
  expect(JSON.stringify(provider)).not.toContain("PRIVATE_GCP_TOKEN");
 });
 it("requires exact Dev project number before following any project-dependent metadata reference",async()=>{
  const f=fixture({modify:i=>{i.project.projectNumber="999999999";}});await expect(f.provider.snapshot()).rejects.toThrow(DevStripeWebhookProviderError);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
 });
 it.each([
  i=>{i.functions[0].serviceConfig.secretEnvironmentVariables.pop();},
  i=>{i.functions[1].serviceConfig.secretEnvironmentVariables.push(binding("NOTIFY_CALLBACK_BEARER","4"));},
  i=>{i.functions[1].serviceConfig.secretEnvironmentVariables.at(-1).projectId="sodc-web-production";},
  i=>{i.functions[1].serviceConfig.secretEnvironmentVariables.at(-1).version="latest";},
  i=>{i.functions[1].serviceConfig.secretEnvironmentVariables.at(-1).secret="../OTHER";},
 ])("blocks malformed, mixed or foreign additional bindings",async modify=>{
  const f=fixture({modify});await expect(f.provider.snapshot()).rejects.toThrow(DevStripeWebhookProviderError);expect(writes(f)).toHaveLength(0);
 });
 it.each(["wrong","acct_different"])("verifies the test account before endpoint/list reads or writes (%s)",async accountId=>{
  const f=fixture({modify:i=>{i.accountId=accountId;}});await expect(f.provider.snapshot()).rejects.toThrow("stripe-account-mismatch");
  expect(f.fetchImpl.mock.calls.filter(([url])=>hasOrigin(url,"https://api.stripe.com")&&!url.endsWith("/v1/account"))).toHaveLength(0);
 });
 it("rejects a live Stripe API key without calling Stripe",async()=>{
  const f=fixture({override:url=>url.endsWith("/secrets/STRIPE_SECRET/versions/1:access")?{name:`projects/${NUMBER}/secrets/STRIPE_SECRET/versions/1`,payload:{data:Buffer.from("sk_live_PRIVATE").toString("base64")}}:undefined});
  await expect(f.provider.snapshot()).rejects.toThrow("stripe-test-key-required");expect(f.fetchImpl.mock.calls.some(([url])=>hasOrigin(url,"https://api.stripe.com"))).toBe(false);
 });
 it.each([
  e=>{e.url="https://production.example/webhook";},e=>{e.api_version="new-version";},e=>{e.livemode=true;},e=>{e.status="disabled";},e=>{e.secret="PRIVATE_WHSEC";},
 ])("refuses changed endpoint scope or unexpected signing payload",async change=>{
  const f=fixture({modify:i=>change(i.endpoint)});await expect(f.provider.snapshot()).rejects.toThrow(DevStripeWebhookProviderError);expect(writes(f)).toHaveLength(0);
 });
 it("does not infer endpoint inventory consistency or lose duplicate endpoints",async()=>{
  const f=fixture({override:url=>url.includes("/v1/webhook_endpoints?limit=")?{object:"list",data:[{id:ENDPOINT,object:"webhook_endpoint",livemode:false,enabled_events:[]}],has_more:false}:undefined});
  await expect(f.provider.snapshot()).rejects.toThrow("stripe-endpoint-inventory-drift");
 });
 it.each([undefined,"0","latest",17])("requires the target archive's numeric generation (%j)",async generation=>{
  const f=fixture({modify:i=>{i.functions[0].buildConfig.source.storageSource.generation=generation;}});
  await expect(f.provider.snapshot()).rejects.toThrow("invalid-generation-bound-source");expect(f.fetchImpl.mock.calls.some(([url])=>hasOrigin(url,"https://storage.googleapis.com"))).toBe(false);
 });
 it.each([
  r=>{r.bucket="other-bucket";},r=>{r.object="../private.zip";},r=>{r.object="/source.zip";},r=>{r.object="source.zip?inject=1";},r=>{r.object="source.txt";},
 ])("rejects out-of-scope/ambiguous object routes before a source download",async change=>{
  const f=fixture({modify:i=>change(i.functions[0].buildConfig.source.storageSource)});await expect(f.provider.snapshot()).rejects.toThrow("invalid-generation-bound-source");
  expect(f.fetchImpl.mock.calls.some(([url])=>hasOrigin(url,"https://storage.googleapis.com"))).toBe(false);
 });
 it("independently hashes the build's resolved storage generation, never an unbound archive hash from build metadata",async()=>{
  const different={...ref,object:"stripeWebhookPayments/resolved.zip",generation:"987654"};
  const f=fixture({modify:i=>{i.build.sourceProvenance.resolvedStorageSource=different;i.build.sourceProvenance.fileHashes={sha256:"FAKE_UNBOUND_HASH"};},override:url=>url.includes("resolved.zip")?new Response("DIFFERENT_ACTUAL_BYTES"):undefined});
  const result=await f.provider.snapshot();expect(result.targetBuildArchive).toEqual({...different,size:22,sha256:createHash("sha256").update("DIFFERENT_ACTUAL_BYTES").digest("hex")});
  expect(result.targetBuildArchive.sha256).not.toBe(result.targetSourceArchive.sha256);
 });
 it("reports absent resolved build storage as null, never claims an inferred archive digest",async()=>{
  const f=fixture({modify:i=>{delete i.build.sourceProvenance.resolvedStorageSource;}});const result=await f.provider.snapshot();expect(result.targetBuildArchive).toBeNull();
 });
 it.each(["projects/other/locations/europe-west2/builds/11111111-1111-4111-8111-111111111111",`projects/${NUMBER}/locations/us-central1/builds/11111111-1111-4111-8111-111111111111`,`${BUILD}?x=1`])("rejects arbitrary build references (%s)",async name=>{
  const f=fixture();await expect(f.provider.build(name)).rejects.toThrow("invalid-build-reference");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("adds exactly one fixed signing-secret version and returns metadata only",async()=>{
  const f=fixture();await expect(f.provider.addSecretVersion({value:"whsec_CANDIDATE123"})).resolves.toEqual(metadata(SIGNING,"2"));
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);const [url,options]=f.fetchImpl.mock.calls[0];
  expect(url).toBe(`https://secretmanager.googleapis.com/v1/projects/${NUMBER}/secrets/${SIGNING}:addVersion`);
  expect(options.method).toBe("POST");expect(JSON.parse(options.body)).toEqual({payload:{data:Buffer.from("whsec_CANDIDATE123").toString("base64")}});
 });
 it.each(["", " whsec_VALUE", "whsec_VALUE\n", "sk_test_VALUE", undefined, "whsec_bad value"])("rejects malformed candidate without credential/network work (%j)",async value=>{
  const f=fixture();await expect(f.provider.addSecretVersion({value})).rejects.toThrow("invalid-candidate-signing-secret");expect(f.fetchImpl).not.toHaveBeenCalled();expect(f.token).not.toHaveBeenCalled();
 });
 it("reads only the requested numeric signing version as a private return value",async()=>{
  const f=fixture();await expect(f.provider.accessSecretVersion({version:"2"})).resolves.toBe("whsec_PRIVATESIGNINGVALUE");
  expect(f.fetchImpl.mock.calls[0][0]).toBe(`https://secretmanager.googleapis.com/v1/projects/${NUMBER}/secrets/${SIGNING}/versions/2:access`);
 });
 it.each(["latest","0","02","2:access?x=1",2,undefined])("refuses an unpinned signing payload read (%j)",async version=>{
  const f=fixture();await expect(f.provider.accessSecretVersion({version})).rejects.toThrow("invalid-signing-version");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("PATCHes only the exact webhook's five bindings, preserving all four nonsigning values",async()=>{
  const f=fixture();await f.provider.snapshot();f.fetchImpl.mockClear();const desired=KEYS.map(key=>binding(key,key===SIGNING?"2":"1"));
  await expect(f.provider.patchFunctionBindings({name:TARGET,bindings:desired})).resolves.toHaveProperty("name",OPERATION);
  const patch=writes(f);expect(patch).toHaveLength(1);
  expect(patch[0][0]).toBe(`https://cloudfunctions.googleapis.com/v2/${TARGET}?updateMask=serviceConfig.secretEnvironmentVariables`);
  expect(JSON.parse(patch[0][1].body)).toEqual({name:TARGET,serviceConfig:{secretEnvironmentVariables:desired}});
 });
 it("cannot patch without an observed baseline",async()=>{
  const f=fixture();await expect(f.provider.patchFunctionBindings({name:TARGET,bindings:KEYS.map(k=>binding(k,k===SIGNING?"2":"1"))})).rejects.toThrow("verified-snapshot-required");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it.each([
  b=>b.pop(),b=>b.push(binding("OTHER")),b=>{b[0].version="2";},b=>{b[1].version="1";},b=>{b[1].projectId=NUMBER;},b=>{b[1].version="latest";},b=>{b[1].secret="OTHER";},b=>{b[0].extra="extra";},
 ])("refuses a broader, duplicate, unpinned or nonsigning binding change",async change=>{
  const f=fixture();await f.provider.snapshot();f.fetchImpl.mockClear();const desired=KEYS.map(k=>binding(k,k===SIGNING?"2":"1"));change(desired);
  await expect(f.provider.patchFunctionBindings({name:TARGET,bindings:desired})).rejects.toThrow(DevStripeWebhookProviderError);expect(writes(f)).toHaveLength(0);
 });
 it("refuses a different Function before any metadata request",async()=>{
  const f=fixture();await expect(f.provider.patchFunctionBindings({name:TARGET.replace("stripeWebhookPayments","reconcileMyCheckoutSessionOrders"),bindings:[]})).rejects.toThrow("invalid-repair-target");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("rechecks target bytes and desired version state before PATCH",async()=>{
  for(const mode of ["target","disabled"]){
   const f=fixture();await f.provider.snapshot();f.fetchImpl.mockClear();
   if(mode==="target") f.input.functions[0].serviceConfig.maxInstanceCount=21;
   else f.fetchImpl.mockImplementation(async(url,options)=>Response.json(url.endsWith(`/secrets/${SIGNING}/versions/2`)?{...metadata(SIGNING,"2"),state:"DISABLED"}:f.route(url,options)));
   await expect(f.provider.patchFunctionBindings({name:TARGET,bindings:KEYS.map(k=>binding(k,k===SIGNING?"2":"1"))})).rejects.toThrow(DevStripeWebhookProviderError);expect(writes(f)).toHaveLength(0);
  }
 });
 it("writes exactly the eleven event array and no other Stripe fields after account verification",async()=>{
  const f=fixture();await f.provider.snapshot();f.fetchImpl.mockClear();const result=await f.provider.updateSubscriptions({endpointId:ENDPOINT,enabledEvents:EVENTS,idempotencyKey:"dev_repair_subscription_intent_1"});expect(result.enabled_events).toEqual(EVENTS);
  const post=writes(f);expect(post).toHaveLength(1);expect(post[0][0]).toBe(`https://api.stripe.com/v1/webhook_endpoints/${ENDPOINT}`);
  expect([...new Set(new URLSearchParams(post[0][1].body).keys())]).toEqual(["enabled_events[]"]);
  expect(new URLSearchParams(post[0][1].body).getAll("enabled_events[]")).toEqual(EVENTS);
  expect(post[0][1].headers["Idempotency-Key"]).toBe("dev_repair_subscription_intent_1");
  expect(f.fetchImpl.mock.calls.at(-2)[0]).toBe("https://api.stripe.com/v1/account");
 });
 it.each([
  {endpointId:"we_other",enabledEvents:EVENTS,idempotencyKey:"dev_intent_long_enough"},
  {endpointId:ENDPOINT,enabledEvents:["*"],idempotencyKey:"dev_intent_long_enough"},
  {endpointId:ENDPOINT,enabledEvents:EVENTS.slice(0,7),idempotencyKey:"dev_intent_long_enough"},
  {endpointId:ENDPOINT,enabledEvents:[...EVENTS.slice(0,10),EVENTS[0]],idempotencyKey:"dev_intent_long_enough"},
  {endpointId:ENDPOINT,enabledEvents:EVENTS,idempotencyKey:""},
 ])("rejects subscription scope drift before fetching a key (%j)",async args=>{
  const f=fixture();await expect(f.provider.updateSubscriptions(args)).rejects.toThrow(DevStripeWebhookProviderError);expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it("projects only safe operation target/build/status data, not provider response/environment/error text",async()=>{
  const f=fixture();const result=await f.provider.operation(OPERATION);expect(result).toEqual({name:OPERATION,done:true,metadata:{target:TARGET,verb:"update",buildName:BUILD}});
  expect(JSON.stringify(result)).not.toContain("MUST_NOT_ESCAPE");
 });
 it.each([`${OPERATION}?x=1`,`projects/sodc-web-production/locations/${REGION}/operations/x`,`${PREFIX}/operations/../x`])("blocks arbitrary operation references (%s)",async name=>{
  const f=fixture();await expect(f.provider.operation(name)).rejects.toThrow("invalid-operation-reference");expect(f.fetchImpl).not.toHaveBeenCalled();
 });
 it.each([
  ()=>{throw new Error("PRIVATE_GCP_TOKEN PRIVATE_BODY whsec_SECRET");},
  ()=>new Response("PRIVATE_BODY",{status:403}),
  ()=>new Response("PRIVATE_BODY",{status:200}),
  ()=>Response.json(["PRIVATE_BODY"]),
 ])("sanitizes all read failures without retry",async failure=>{
  const f=fixture({override:failure});let error;try{await f.provider.snapshot();}catch(e){error=e;}
  expect(error).toBeInstanceOf(DevStripeWebhookProviderError);expect(String(error)).not.toMatch(/PRIVATE|whsec_SECRET/);expect(f.fetchImpl).toHaveBeenCalledTimes(1);
 });
 it.each(["add","patch","stripe"])("unknown %s outcomes never retry or expose response/credential details",async kind=>{
  const f=fixture({override:(_url,options)=>options.method!=="GET"?new Response("PRIVATE_BODY",{status:403}):undefined});
  if(kind==="patch" || kind==="stripe") await f.provider.snapshot();f.fetchImpl.mockClear();
  const promise=kind==="add"?f.provider.addSecretVersion({value:"whsec_CANDIDATE"}):kind==="stripe"?f.provider.updateSubscriptions({endpointId:ENDPOINT,enabledEvents:EVENTS,idempotencyKey:"dev_intent_long_enough"}):f.provider.patchFunctionBindings({name:TARGET,bindings:KEYS.map(k=>binding(k,k===SIGNING?"2":"1"))});
  await expect(promise).rejects.toThrow("provider-write-outcome-unknown");expect(writes(f)).toHaveLength(1);
 });
 it("limits JSON bytes before parsing and source bytes both by header and streaming",async()=>{
  const json=fixture({override:()=>new Response("x",{headers:{"content-length":String(6*1024*1024)}})});await expect(json.provider.snapshot()).rejects.toThrow(DevStripeWebhookProviderError);
  const header=fixture({override:url=>url.includes("alt=media")?new Response("x",{headers:{"content-length":String(26*1024*1024)}}):undefined});await expect(header.provider.snapshot()).rejects.toThrow("provider-response-too-large");
  let chunks=0;const streaming=fixture({override:url=>url.includes("alt=media")?new Response(new ReadableStream({pull(controller){chunks++;if(chunks<=26)controller.enqueue(new Uint8Array(1024*1024));else controller.close();}})):undefined});
  await expect(streaming.provider.snapshot()).rejects.toThrow("provider-response-too-large");expect(chunks).toBeLessThanOrEqual(27);
 });
 it("bounds the entire JSON body lifetime, not only arrival of response headers",async()=>{
  vi.useFakeTimers();const f=fixture({timeoutMs:25,override:()=>new Response(new ReadableStream({start(){}}))});
  const pending=expect(f.provider.snapshot()).rejects.toThrow(DevStripeWebhookProviderError);await vi.advanceTimersByTimeAsync(30);await pending;expect(f.fetchImpl).toHaveBeenCalledTimes(1);
 });
 it("bounds a source download that stalls after headers",async()=>{
  vi.useFakeTimers();const f=fixture({timeoutMs:25,override:url=>url.includes("alt=media")?new Response(new ReadableStream({start(){}})):undefined});
  const pending=expect(f.provider.snapshot()).rejects.toThrow("provider-read-failed");await vi.advanceTimersByTimeAsync(30);await pending;
 });
 it("caps signing metadata and Stripe endpoint pagination and rejects loops/truncation",async()=>{
  const list=fixture({override:url=>url.includes(`/secrets/${SIGNING}/versions?pageSize=100`)?{versions:[],nextPageToken:"repeat"}:undefined});await expect(list.provider.snapshot()).rejects.toThrow("invalid-provider-pagination");
  const pages=fixture({override:url=>url.includes(`/secrets/${SIGNING}/versions?pageSize=100`)?{versions:[],nextPageToken:Math.random().toString()}:undefined});await expect(pages.provider.snapshot()).rejects.toThrow("provider-pagination-limit-exceeded");
  const many=fixture({override:url=>url.includes(`/secrets/${SIGNING}/versions?pageSize=100`)?{versions:Array(1001).fill(metadata(SIGNING))}:undefined});await expect(many.provider.snapshot()).rejects.toThrow("provider-list-limit-exceeded");
  const stripe=fixture({override:url=>url.includes("/v1/webhook_endpoints?limit=100")?{object:"list",data:[],has_more:true}:undefined});await expect(stripe.provider.snapshot()).rejects.toThrow("invalid-stripe-pagination");
 });
});
