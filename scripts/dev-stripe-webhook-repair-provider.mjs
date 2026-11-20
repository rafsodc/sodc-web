import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createBindingRepairProvider} from "./notify-secret-binding-repair-provider.mjs";

const PROJECT = "sodc-web", NUMBER = "931675247602", REGION = "europe-west2";
const PREFIX = `projects/${PROJECT}/locations/${REGION}`;
const TARGET = `${PREFIX}/functions/stripeWebhookPayments`;
const SIGNING = "STRIPE_WEBHOOK_SECRET_PAYMENTS";
const ACCOUNT = "acct_1SgTanEJWVZaraSf", ENDPOINT = "we_1TOixKEJWVZaraSfeonnSQby";
const ENDPOINT_URL = "https://europe-west2-sodc-web.cloudfunctions.net/stripeWebhookPayments";
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_failed", "checkout.session.expired",
  "charge.refunded", "charge.dispute.created", "charge.dispute.closed", "charge.dispute.updated",
  "checkout.session.async_payment_succeeded", "refund.created", "refund.updated", "refund.failed"];
const KEYS = ["STRIPE_SECRET", SIGNING, "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "GOV_NOTIFY_TEAM_API_KEY"];
const SHARED = ["STRIPE_SECRET", "GOV_NOTIFY_LIVE_API_KEY", "GOV_NOTIFY_TEST_API_KEY", "GOV_NOTIFY_TEAM_API_KEY"];
const JSON_LIMIT = 5 * 1024 * 1024, ZIP_LIMIT = 25 * 1024 * 1024;
const NUMERIC = /^[1-9][0-9]{0,19}$/;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = value => structuredClone(value);
const sorted = value => JSON.stringify(value, (_, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);

export class DevStripeWebhookProviderError extends Error {
  constructor(code) {super(`Dev Stripe webhook repair blocked: ${code}.`); this.name = "DevStripeWebhookProviderError"; this.code = code;}
}
const need = (value, code) => {if (!value) throw new DevStripeWebhookProviderError(code);};
function authentication() {
  let token, expires = 0;
  return () => {
    if (Date.now() >= expires) {
      try {token = execFileSync("gcloud", ["auth", "print-access-token"], {encoding:"utf8", timeout:30_000,
        maxBuffer:64 * 1024, stdio:["ignore","pipe","pipe"]}).trim();}
      catch {throw new DevStripeWebhookProviderError("provider-authentication-failed");}
      expires = Date.now() + 60_000;
    }
    return token;
  };
}
function versionName(secret, version) {return `projects/${NUMBER}/secrets/${secret}/versions/${version}`;}
function signingVersion(value) {
  need(typeof value === "string" && NUMERIC.test(value), "invalid-signing-version"); return value;
}
function secretMetadata(value, secret, version) {
  need(object(value) && value.name === versionName(secret,version) && !Object.hasOwn(value,"payload"), "invalid-secret-metadata");
  return value;
}
function secretText(value, pattern, code) {
  need(typeof value === "string" && value.length <= 4096 && pattern.test(value), code); return value;
}
function endpointProjection(value) {
  need(object(value) && /^we_[A-Za-z0-9]+$/.test(value.id ?? "") && value.object === "webhook_endpoint" &&
    value.livemode === false && Array.isArray(value.enabled_events) && value.enabled_events.every(event => typeof event === "string") &&
    !Object.hasOwn(value,"secret") && !Object.hasOwn(value,"client_secret"), "invalid-stripe-endpoint-response");
  return clone(value);
}
function storageReference(value) {
  const allowed = [`gcf-v2-sources-${NUMBER}-${REGION}`, `gcf-v2-uploads-${NUMBER}-${REGION}.cloudfunctions.appspot.com`];
  need(object(value) && allowed.includes(value.bucket) && typeof value.object === "string" && value.object.length <= 1024 &&
    /^[A-Za-z0-9_./-]+\.zip$/.test(value.object) && value.object.split("/").every(part => part && ![".",".."].includes(part)) &&
    typeof value.generation === "string" && NUMERIC.test(value.generation), "invalid-generation-bound-source");
  return {bucket:value.bucket, object:value.object, generation:value.generation};
}
function buildName(name) {
  need(typeof name === "string" && new RegExp(`^projects/(?:${PROJECT}|${NUMBER})/locations/${REGION}/builds/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`).test(name), "invalid-build-reference");
  return name;
}
function operationName(name) {
  need(typeof name === "string" && name.startsWith(`${PREFIX}/operations/`) && /^[A-Za-z0-9_-]{1,200}$/.test(name.slice(`${PREFIX}/operations/`.length)), "invalid-operation-reference");
  return name;
}

/** Fixed Dev-only provider. Payload-returning methods are private operator inputs;
 * callers must HMAC them, never write or print them. No retry, rollback, replay,
 * general deploy, IAM mutation, or old repair PATCH is exposed. */
export function createDevStripeWebhookProvider({projectId = PROJECT, region = REGION, tokenProvider,
  fetchImpl = globalThis.fetch, timeoutMs = 30_000} = {}) {
  need(projectId === PROJECT && region === REGION, "unsupported-dev-provider-scope");
  need(typeof fetchImpl === "function" && (tokenProvider === undefined || typeof tokenProvider === "function") &&
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30_000, "invalid-provider-dependency");
  const authenticate = tokenProvider ?? authentication();
  let snapshotTarget, stripeApiKey, stripeCredential, initialStripeVersion;

  async function transport(url, options, {archive = false, uncertain = false} = {}) {
    const controller = new AbortController();
    let timer, reader;
    const code = uncertain ? "provider-write-outcome-unknown" : "provider-read-failed";
    const work = (async () => {
      const response = await fetchImpl(url, {...options,redirect:"error",signal:controller.signal});
      need(response.ok, code);
      const cap = archive ? ZIP_LIMIT : JSON_LIMIT;
      const length = response.headers?.get("content-length");
      if (length !== undefined && length !== null) need(/^(0|[1-9][0-9]*)$/.test(length) && Number(length) <= cap, "provider-response-too-large");
      need(response.body?.getReader, "invalid-provider-response");
      reader = response.body.getReader();
      let size = 0;
      const chunks = [], hash = archive ? createHash("sha256") : null;
      for (;;) {
        const {done,value} = await reader.read(); if (done) break;
        need(value instanceof Uint8Array, "invalid-provider-response");
        size += value.byteLength; need(size <= cap, "provider-response-too-large");
        if (hash) hash.update(value); else chunks.push(Buffer.from(value));
      }
      if (archive) {
        need(size > 0 && (length == null || Number(length) === size), "invalid-source-archive-size");
        return {sha256:hash.digest("hex"),size};
      }
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      need(object(result), "invalid-provider-response"); return result;
    })();
    const deadline = new Promise((_,reject) => {timer = setTimeout(() => {controller.abort(); reject(new DevStripeWebhookProviderError(code));},timeoutMs);});
    try {return await Promise.race([work,deadline]);}
    catch (error) {
      if (uncertain) throw new DevStripeWebhookProviderError("provider-write-outcome-unknown");
      throw error instanceof DevStripeWebhookProviderError ? error : new DevStripeWebhookProviderError(code);
    } finally {
      clearTimeout(timer); controller.abort();
      if (reader) {void reader.cancel().catch(()=>{}); try {reader.releaseLock();} catch { /* pending read: abort owns it */ }}
    }
  }
  async function google(host, resource, {method = "GET", body, archive = false} = {}) {
    let token;
    try {token = await authenticate();} catch {throw new DevStripeWebhookProviderError("provider-authentication-failed");}
    need(typeof token === "string" && token.length <= 16_384 && /^[^\s]+$/.test(token), "provider-authentication-failed");
    return transport(`https://${host}${resource}`, {method,headers:{Authorization:`Bearer ${token}`,"x-goog-user-project":PROJECT,
      ...(archive ? {"Accept-Encoding":"identity"} : {}), ...(body ? {"Content-Type":"application/json"} : {})},
    ...(body ? {body:JSON.stringify(body)} : {})}, {archive,uncertain:method !== "GET"});
  }
  // The old provider is used for its snapshot method ONLY. The adapter bounds
  // its complete body read too; old mutations cannot escape through this facade.
  const original = createBindingRepairProvider({projectId:PROJECT,region:REGION,tokenProvider:authenticate,
    fetchImpl:async(url,options) => {
      need(options.method === "GET" && options.body === undefined, "baseline-read-only-required");
      const parsed = new URL(url);
      need(parsed.protocol === "https:" && parsed.port === "" && ["cloudresourcemanager.googleapis.com","cloudfunctions.googleapis.com","cloudscheduler.googleapis.com","run.googleapis.com","secretmanager.googleapis.com"].includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.hash, "invalid-baseline-provider-route");
      const result = await transport(url,{method:"GET",headers:options.headers});
      if (parsed.hostname === "cloudresourcemanager.googleapis.com") need(result.projectId === PROJECT && result.projectNumber === NUMBER,"provider-project-mismatch");
      return Response.json(result);
    }});

  async function googleList(host, resource, key) {
    const result = [], tokens = new Set(); let next;
    for (let page = 0; page < 10; page++) {
      const value = await google(host,resource+(next ? `&pageToken=${encodeURIComponent(next)}` : ""));
      need(Array.isArray(value[key] ?? []) && (value.unreachable === undefined || Array.isArray(value.unreachable) && value.unreachable.length === 0),"incomplete-provider-list");
      result.push(...(value[key] ?? [])); need(result.length <= 1000,"provider-list-limit-exceeded");
      next = value.nextPageToken;
      if (next === undefined || next === "") return result;
      need(typeof next === "string" && next.length <= 4096 && !tokens.has(next),"invalid-provider-pagination"); tokens.add(next);
    }
    throw new DevStripeWebhookProviderError("provider-pagination-limit-exceeded");
  }
  async function access(secret, version) {
    const value = await google("secretmanager.googleapis.com",`/v1/${versionName(secret,version)}:access`);
    const encoded = value.payload?.data;
    need(value.name === versionName(secret,version) && typeof encoded === "string" && encoded.length <= 8192 &&
      Buffer.from(encoded,"base64").toString("base64") === encoded,"invalid-private-secret-response");
    return Buffer.from(encoded,"base64").toString("utf8");
  }
  function bindStripeCredential(target, numeric) {
    const ref = target.serviceConfig.secretEnvironmentVariables.find(binding => binding.key === "STRIPE_SECRET");
    const names = [PROJECT,NUMBER].map(project => `projects/${project}/secrets/STRIPE_SECRET/versions/${ref.version}`);
    need(object(numeric) && names.includes(numeric.name) && numeric.state === "ENABLED" && !Object.hasOwn(numeric,"payload"), "stripe-bound-secret-metadata-mismatch");
    if (initialStripeVersion !== undefined && initialStripeVersion !== ref.version || stripeApiKey && stripeApiKey.version !== ref.version) {
      stripeCredential = undefined; stripeApiKey = undefined;
      throw new DevStripeWebhookProviderError("stripe-credential-binding-changed");
    }
    initialStripeVersion = ref.version;
    stripeCredential = {version:ref.version,ready:false};
  }
  async function stripeRaw(resource, {method = "GET", body, idempotencyKey} = {}) {
    need(stripeCredential, "verified-stripe-credential-binding-required");
    const version = stripeCredential.version;
    if (!stripeApiKey) {
      const value = secretText(await access("STRIPE_SECRET",version),/^sk_test_[A-Za-z0-9_]+$/,"stripe-test-key-required");
      need(stripeCredential?.version === version, "stripe-credential-binding-changed");
      stripeApiKey = {version,value};
    }
    need(stripeCredential?.version === version && stripeApiKey.version === version, "stripe-credential-binding-changed");
    const key = stripeApiKey.value;
    return transport(`https://api.stripe.com${resource}`,{method,headers:{Authorization:`Bearer ${key}`,"Stripe-Version":"2026-03-25.dahlia",
      ...(body ? {"Content-Type":"application/x-www-form-urlencoded"} : {}), ...(idempotencyKey ? {"Idempotency-Key":idempotencyKey} : {})},
    ...(body ? {body} : {})},{uncertain:method !== "GET"});
  }
  async function stripe(resource, options) {
    const account = await stripeRaw("/v1/account"); need(account.id === ACCOUNT,"stripe-account-mismatch");
    return stripeRaw(resource,options);
  }
  async function stripeEndpoints() {
    const output = [], seen = new Set(); let after;
    for (let page = 0; page < 10; page++) {
      const result = await stripe(`/v1/webhook_endpoints?limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`);
      need(result.object === "list" && Array.isArray(result.data) && typeof result.has_more === "boolean","invalid-stripe-pagination");
      for (const item of result.data) {const value = endpointProjection(item); need(!seen.has(value.id),"invalid-stripe-pagination"); seen.add(value.id); output.push(value);}
      need(output.length <= 1000,"provider-list-limit-exceeded");
      if (!result.has_more) return output;
      need(result.data.length > 0,"invalid-stripe-pagination"); after = result.data.at(-1).id;
    }
    throw new DevStripeWebhookProviderError("provider-pagination-limit-exceeded");
  }
  async function archive(value) {
    const ref = storageReference(value);
    const digest = await google("storage.googleapis.com",`/storage/v1/b/${encodeURIComponent(ref.bucket)}/o/${encodeURIComponent(ref.object)}?alt=media&generation=${ref.generation}`,{archive:true});
    return {...ref,...digest};
  }
  async function build(name) {
    buildName(name);
    const value = await google("cloudbuild.googleapis.com",`/v1/${name}`);
    need(value.name === name && value.id === name.split("/").at(-1) && typeof value.status === "string", "invalid-build-response");
    const resolvedSource = value.sourceProvenance?.resolvedStorageSource === undefined ? null : storageReference(value.sourceProvenance.resolvedStorageSource);
    const result = {name,status:value.status,createTime:value.createTime ?? null,startTime:value.startTime ?? null,finishTime:value.finishTime ?? null,resolvedSource};
    for (const key of ["createTime","startTime","finishTime"]) need(result[key] === null || typeof result[key] === "string" && Number.isFinite(Date.parse(result[key])),"invalid-build-response");
    return result;
  }
  function targetBindings(bindings) {
    need(Array.isArray(bindings) && bindings.length === 5 && new Set(bindings.map(b=>b?.key)).size === 5,"invalid-target-bindings");
    for (const binding of bindings) need(object(binding) && Object.keys(binding).sort().join(",") === "key,projectId,secret,version" && KEYS.includes(binding.key) && binding.secret === binding.key && [PROJECT,NUMBER].includes(binding.projectId) && typeof binding.version === "string" && NUMERIC.test(binding.version),"invalid-target-bindings");
    return clone(bindings);
  }
  function projectedOperation(value, name) {
    need(object(value) && value.name === name && (value.done === undefined || typeof value.done === "boolean"),"invalid-operation-response");
    const result = {name,...(value.done === undefined ? {} : {done:value.done})};
    if (value.metadata !== undefined) {
      need(object(value.metadata),"invalid-operation-response"); result.metadata = {};
      if (value.metadata.target !== undefined) {need([TARGET,TARGET.replace(PROJECT,NUMBER)].includes(value.metadata.target),"invalid-operation-target"); result.metadata.target=value.metadata.target;}
      if (value.metadata.verb !== undefined) {need(value.metadata.verb === "update","invalid-operation-verb");result.metadata.verb="update";}
      if (value.metadata.buildName !== undefined) {need(result.metadata.target && result.metadata.verb === "update","unscoped-operation-build");result.metadata.buildName=buildName(value.metadata.buildName);}
    }
    if (value.error !== undefined) {need(object(value.error) && Number.isSafeInteger(value.error.code),"invalid-operation-error");result.error={code:value.error.code};}
    return result;
  }
  return {
    async snapshot() {
      stripeCredential = undefined;
      try {
        const base = await original.snapshot();
        need(base.project?.projectId === PROJECT && base.project.projectNumber === NUMBER,"provider-project-mismatch");
        const targets = base.functions.filter(fn=>fn.name===TARGET); need(targets.length === 1,"missing-target-function");
        const target = targets[0]; targetBindings(target.serviceConfig?.secretEnvironmentVariables);
        bindStripeCredential(target,base.secretVersions?.STRIPE_SECRET?.numeric);
        const referenced = new Map();
        for (const fn of base.functions) {
          need(Array.isArray(fn.serviceConfig?.secretEnvironmentVariables ?? []),"invalid-bound-secret-reference");
          for (const binding of fn.serviceConfig?.secretEnvironmentVariables ?? []) {
            need(object(binding) && typeof binding.secret === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(binding.secret) &&
              [PROJECT,NUMBER].includes(binding.projectId) && typeof binding.version === "string" && NUMERIC.test(binding.version),"invalid-bound-secret-reference");
            if (!referenced.has(binding.secret)) referenced.set(binding.secret,new Set()); referenced.get(binding.secret).add(binding.version);
          }
        }
        need(referenced.size <= 100,"bound-secret-limit-exceeded");
        for (const [secret,versions] of referenced) {
          need(versions.size === 1,"ambiguous-bound-secret-version"); if (SHARED.includes(secret)) continue;
          const version = [...versions][0], path=`/v1/projects/${NUMBER}/secrets/${secret}`;
          const [numeric,latest,policy] = await Promise.all([google("secretmanager.googleapis.com",`${path}/versions/${version}`),google("secretmanager.googleapis.com",`${path}/versions/latest`),google("secretmanager.googleapis.com",`${path}:getIamPolicy?options.requestedPolicyVersion=3`)]);
          secretMetadata(numeric,secret,version);
          need(object(latest) && new RegExp(`^projects/${NUMBER}/secrets/${secret}/versions/[1-9][0-9]*$`).test(latest.name ?? "") && !Object.hasOwn(latest,"payload"),"invalid-secret-metadata");
          base.secretVersions[secret]={numeric,latest}; base.secretPolicies[secret]=policy;
        }
        const signingVersions = await googleList("secretmanager.googleapis.com",`/v1/projects/${NUMBER}/secrets/${SIGNING}/versions?pageSize=100`,"versions");
        const seen = new Set();
        for (const value of signingVersions) {const version=value?.name?.split("/").at(-1);signingVersion(version);secretMetadata(value,SIGNING,version);need(!seen.has(version),"duplicate-signing-version");seen.add(version);}
        const endpoint = endpointProjection(await stripe(`/v1/webhook_endpoints/${ENDPOINT}`));
        need(endpoint.id === ENDPOINT && endpoint.url === ENDPOINT_URL && endpoint.api_version === "2026-03-25.dahlia" && endpoint.status === "enabled","stripe-endpoint-scope-mismatch");
        const endpoints = await stripeEndpoints();
        need(endpoints.filter(e=>e.id===ENDPOINT).length===1 && sorted(endpoints.find(e=>e.id===ENDPOINT))===sorted(endpoint),"stripe-endpoint-inventory-drift");
        const targetSourceArchive = await archive(target.buildConfig?.source?.storageSource);
        const targetBuild = await build(target.buildConfig?.build);
        const targetBuildArchive = targetBuild.resolvedSource ? await archive(targetBuild.resolvedSource) : null;
        snapshotTarget=clone(target);
        stripeCredential.ready = true;
        return {...base,signingPolicy:base.secretPolicies[SIGNING],signingVersions,stripe:{account:{id:ACCOUNT},endpoint,endpoints},targetSourceArchive,targetBuild,targetBuildArchive};
      } catch (error) {
        stripeCredential = undefined; stripeApiKey = undefined;
        throw error instanceof DevStripeWebhookProviderError ? error : new DevStripeWebhookProviderError("provider-snapshot-failed");
      }
    },
    async addSecretVersion({value} = {}) {
      const secret=secretText(value,/^whsec_[A-Za-z0-9]+$/,"invalid-candidate-signing-secret");
      const result=await google("secretmanager.googleapis.com",`/v1/projects/${NUMBER}/secrets/${SIGNING}:addVersion`,{method:"POST",body:{payload:{data:Buffer.from(secret,"utf8").toString("base64")}}});
      const version=signingVersion(result?.name?.split("/").at(-1));secretMetadata(result,SIGNING,version);return result;
    },
    async accessSecretVersion({version} = {}) {signingVersion(version);return secretText(await access(SIGNING,version),/^whsec_[A-Za-z0-9]+$/,"invalid-mounted-signing-secret");},
    async patchFunctionBindings({name,bindings} = {}) {
      need(name===TARGET,"invalid-repair-target");const desired=targetBindings(bindings);
      need(snapshotTarget,"verified-snapshot-required");const previous=targetBindings(snapshotTarget.serviceConfig.secretEnvironmentVariables);
      const oldSigning=previous.find(b=>b.key===SIGNING),newSigning=desired.find(b=>b.key===SIGNING);
      need(oldSigning.version==="1" && newSigning.version!=="1" && newSigning.projectId===oldSigning.projectId &&
        sorted(previous.filter(b=>b.key!==SIGNING).sort((a,b)=>a.key.localeCompare(b.key)))===sorted(desired.filter(b=>b.key!==SIGNING).sort((a,b)=>a.key.localeCompare(b.key))),"non-signing-binding-change");
      const current=await google("cloudfunctions.googleapis.com",`/v2/${TARGET}`);
      need(sorted(current)===sorted(snapshotTarget),"target-changed-before-patch");
      const version=await google("secretmanager.googleapis.com",`/v1/${versionName(SIGNING,newSigning.version)}`);
      secretMetadata(version,SIGNING,newSigning.version);need(version.state==="ENABLED","signing-version-not-enabled");
      return google("cloudfunctions.googleapis.com",`/v2/${TARGET}?updateMask=serviceConfig.secretEnvironmentVariables`,{method:"PATCH",body:{name:TARGET,serviceConfig:{secretEnvironmentVariables:desired}}});
    },
    async operation(name) {operationName(name);return projectedOperation(await google("cloudfunctions.googleapis.com",`/v2/${name}`),name);},
    build,
    async updateSubscriptions({endpointId,enabledEvents,idempotencyKey} = {}) {
      need(endpointId===ENDPOINT,"invalid-stripe-endpoint-target");
      need(Array.isArray(enabledEvents) && enabledEvents.length===EVENTS.length && new Set(enabledEvents).size===EVENTS.length && EVENTS.every(e=>enabledEvents.includes(e)),"invalid-subscription-events");
      need(typeof idempotencyKey==="string" && /^[A-Za-z0-9_-]{16,200}$/.test(idempotencyKey),"invalid-stripe-idempotency-key");
      need(stripeCredential?.ready, "verified-stripe-credential-binding-required");
      const body=new URLSearchParams(EVENTS.map(event=>["enabled_events[]",event])).toString();
      const result=endpointProjection(await stripe(`/v1/webhook_endpoints/${ENDPOINT}`,{method:"POST",body,idempotencyKey}));
      need(result.id===ENDPOINT && result.url===ENDPOINT_URL && result.api_version==="2026-03-25.dahlia" && result.status==="enabled" &&
        result.enabled_events.length===EVENTS.length && new Set(result.enabled_events).size===EVENTS.length && EVENTS.every(e=>result.enabled_events.includes(e)),"stripe-update-result-mismatch");return result;
    },
  };
}
