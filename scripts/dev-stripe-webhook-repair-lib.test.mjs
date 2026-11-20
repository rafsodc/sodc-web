import {afterEach, describe, expect, it, vi} from "vitest";
import {digest} from "./functions-config-guard-lib.mjs";
import {ACCOUNT_ID, BEFORE_EVENTS, DevStripeWebhookRepairError, ENDPOINT_ID, PROJECT_ID, PROJECT_NUMBER, REQUIRED_EVENTS, SECRET_KEY, TARGET_NAME,
  applyFunction, applySecret, applySubscriptions, assertReview, prepareRepair, reviewTemplate, verifyFunction, verifyRepair} from "./dev-stripe-webhook-repair-lib.mjs";
import {CANDIDATE, KEY, NEW_BUILD, NOW, OPERATION, approved, clone, context, fixture, operation, version} from "./test-fixtures/dev-stripe-webhook-repair-fixture.mjs";

afterEach(() => {vi.restoreAllMocks();});
async function secretReady(f, proposal = f.prepare()) {
  await expect(applySecret(context(f, proposal))).resolves.toMatchObject({status: "SECRET_VERSION_CREATED", version: "2"}); return proposal;
}
async function functionReady(f, proposal) {
  proposal = await secretReady(f, proposal);
  await expect(applyFunction(context(f, proposal))).resolves.toMatchObject({status: "FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED"});
  f.rebuild(); await expect(verifyFunction(context(f, proposal))).resolves.toMatchObject({status: "FUNCTION_VERIFIED"}); return proposal;
}

describe("fixed Dev-only reviewed proposal", () => {
  it("binds source, candidate and accepted Dev backlog without serializing credentials, env or IAM", () => {
    const f = fixture(), proposal = f.prepare(), text = JSON.stringify(proposal);
    expect(proposal).toMatchObject({environment: "dev", target: TARGET_NAME, accountId: ACCOUNT_ID, endpointId: ENDPOINT_ID, acceptsExistingDevBacklog: true,
      backlogAcceptance: "User accepts existing Dev backlog processing; Dev data disposable", approvedEvents: REQUIRED_EVENTS});
    expect(proposal.beforeStripe.enabled_events).toEqual(BEFORE_EVENTS);
    for (const value of [CANDIDATE, "private-environment-fixture", "private-build-env-fixture", "private-build-identity@example.invalid", KEY.toString("hex")]) expect(text).not.toContain(value);
    expect(reviewTemplate(proposal).decision).toBe("REVIEW_REQUIRED");
    expect(f.store.claim).not.toHaveBeenCalled(); expect(f.provider.addSecretVersion).not.toHaveBeenCalled();
  });
  it("allows the known unrelated #745 declaration difference and preserves the deployed Function", () => {
    const f = fixture(); expect(f.prepare().baseline.protected.functions.reconcileMyCheckoutSessionOrders).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(["secret", "unknownPrivateField", "description", "metadata"])("rejects private endpoint %s without including the value in the error or proposal", field => {
    const f = fixture(), marker = "PRIVATE_STRIPE_FIELD_MUST_NOT_LEAK";
    for (const endpoint of [f.snapshot.stripe.endpoint, f.snapshot.stripe.endpoints[0]]) endpoint[field] = field === "metadata" ? {private: marker} : marker;
    let error; try {f.prepare();} catch (caught) {error = caught;}
    expect(error).toBeInstanceOf(DevStripeWebhookRepairError); expect(error.code).toBe("stripe-endpoint-mismatch");
    expect(error.message).not.toContain(marker); expect(f.store.claim).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "whsec_short", "sk_test_invalid", "whsec_Synthetic123456\n", "whsec_" + "a".repeat(251)])("rejects malformed candidate %j", value => {
    const f = fixture(); expect(() => prepareRepair({source: f.source, snapshot: f.snapshot, comparisonKey: KEY, candidateSecret: value, now: NOW})).toThrow(DevStripeWebhookRepairError);
  });
  it.each([
    ["project", f => {f.snapshot.project.projectId = "sodc-web-production";}],
    ["project number", f => {f.snapshot.project.projectNumber = "123";}],
    ["Stripe account", f => {f.snapshot.stripe.account.id = "acct_other";}],
    ["live endpoint", f => {f.snapshot.stripe.endpoint.livemode = true; f.snapshot.stripe.endpoints[0].livemode = true;}],
    ["wrong URL", f => {f.snapshot.stripe.endpoint.url = "https://www.sodc.net/stripe";}],
    ["second endpoint", f => {f.snapshot.stripe.endpoints.push(clone(f.snapshot.stripe.endpoint));}],
    ["already changed events", f => {f.snapshot.stripe.endpoint.enabled_events = [...REQUIRED_EVENTS]; f.snapshot.stripe.endpoints[0].enabled_events = [...REQUIRED_EVENTS];}],
    ["target source keys", f => {f.updateManifest(m => m.endpoints.stripeWebhookPayments.secretEnvironmentVariables.pop());}],
    ["target callable", f => {f.updateManifest(m => {delete m.endpoints.stripeWebhookPayments.httpsTrigger; m.endpoints.stripeWebhookPayments.callableTrigger = {};});}],
    ["source SDK", f => {f.source.binding.sdk.version = "7.2.4";}],
    ["source hash", f => {f.source.binding.manifestSha256 = "0".repeat(64);}],
    ["runtime", f => {f.snapshot.functions[0].buildConfig.runtime = "nodejs22";}],
    ["instance limit", f => {f.snapshot.functions[0].serviceConfig.maxInstanceCount = 21;}],
    ["identity", f => {f.snapshot.functions[0].serviceConfig.serviceAccountEmail = "other@example.invalid";}],
    ["delivery ceiling", f => {f.snapshot.functions[0].serviceConfig.environmentVariables.GOV_NOTIFY_DELIVERY_MODE = "LIVE";}],
    ["traffic", f => {f.snapshot.functions[0].serviceConfig.allTrafficOnLatestRevision = false;}],
    ["target failure", f => {f.snapshot.functions[0].state = "FAILED";}],
    ["version already added", f => {f.snapshot.signingVersions.push(version("2"));}],
    ["old version disabled", f => {f.snapshot.signingVersions[0].state = "DISABLED";}],
    ["signing secret unpinned", f => {f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.find(x => x.key === SECRET_KEY).version = "latest";}],
    ["signing alias", f => {f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.find(x => x.key === SECRET_KEY).secret = "OTHER_SECRET";}],
    ["missing direct grant", f => {f.snapshot.signingPolicy.bindings = [];}],
    ["conditional direct grant", f => {f.snapshot.signingPolicy.bindings[0].condition = null;}],
    ["missing source hash", f => {delete f.snapshot.targetSourceArchive.sha256;}],
    ["wrong source object", f => {f.snapshot.targetSourceArchive.object = "unbound.zip";}],
    ["unbound Function provenance", f => {f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedStorageSource.generation = "99";}],
    ["Function repository provenance", f => {f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedRepoSource = {repoName: "other"};}],
    ["null Function provenance", f => {f.snapshot.functions[0].buildConfig.sourceProvenance = null;}],
    ["unbound build source hash", f => {f.snapshot.targetBuildArchive.sha256 = "a".repeat(64);}],
    ["wrong resolved generation", f => {f.snapshot.targetBuild.resolvedSource.generation = "99";}],
    ["build failure", f => {f.snapshot.targetBuild.status = "FAILURE";}],
  ])("blocks %s at preparation", (_name, change) => {
    const f = fixture(); change(f); expect(() => f.prepare()).toThrow(); expect(f.provider.addSecretVersion).not.toHaveBeenCalled();
  });
  it.each([
    p => {p.environment = "prod";}, p => {p.target = TARGET_NAME.replace("sodc-web", "sodc-web-production");},
    p => {p.acceptsExistingDevBacklog = false;}, p => {p.approvedEvents.push("*");}, p => {p.expiresAt = new Date(NOW + 7200000).toISOString();},
  ])("rejects altered scope even when review is rebuilt", change => {
    const f = fixture(), p = f.prepare(); change(p); expect(() => reviewTemplate(p)).toThrow();
  });
  it.each([
    r => {r.decision = "REVIEW_REQUIRED";}, r => {r.proposalSha256 = "0".repeat(64);}, r => {r.reviewedBy = "REPLACE_AFTER_REVIEW";},
    r => {r.reason = "";}, r => {r.extra = true;},
  ])("rejects a non-exact review", change => {
    const f = fixture(), p = f.prepare(), r = approved(p); change(r); expect(() => assertReview(p, r, NOW)).toThrow();
  });
  it("expires every mutating phase but not read-only verification", async () => {
    const f = fixture(), p = await functionReady(f);
    await expect(applySubscriptions(context(f, p, {now: NOW + 3600001}))).rejects.toThrow("proposal-expired-or-clock-invalid");
    await expect(verifyFunction(context(f, p, {now: NOW + 3600001, review: undefined}))).resolves.toMatchObject({status: "FUNCTION_VERIFIED"});
    expect(f.provider.updateSubscriptions).not.toHaveBeenCalled();
  });
});

describe("one-shot secret creation and Function handoff", () => {
  it.each(["numeric", "mixed"])("preserves original %s string project spellings through the complete protocol", async spelling => {
    const f = fixture();
    f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.forEach((value, index) => {
      value.projectId = spelling === "numeric" || index % 2 ? PROJECT_NUMBER : PROJECT_ID;
    });
    const original = clone(f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables), p = await secretReady(f);
    expect(p.beforeBindings).toEqual(original);
    await applyFunction(context(f, p));
    const expected = original.map(value => value.key === SECRET_KEY ? {...value, version: "2"} : value);
    expect(f.provider.patchFunctionBindings).toHaveBeenCalledExactlyOnceWith({name: TARGET_NAME, bindings: expected});
    f.rebuild(); await verifyFunction(context(f, p)); await applySubscriptions(context(f, p));
    await expect(verifyRepair(context(f, p))).resolves.toMatchObject({status: "PASS"});
    expect(f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables).toEqual(expected);
  });
  it("rejects a JavaScript numeric project value before preparation or any write", async () => {
    const f = fixture(), p = f.prepare(); f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables[0].projectId = Number(PROJECT_NUMBER);
    expect(() => f.prepare()).toThrow("invalid-secret-binding");
    await expect(applySecret(context(f, p))).rejects.toThrow("invalid-secret-binding");
    expect(f.store.claim).not.toHaveBeenCalled(); expect(f.provider.addSecretVersion).not.toHaveBeenCalled();
  });
  it("handles the real provider's changing signing numeric/latest pair throughout creation, rebind and final verification", async () => {
    const f = fixture(), p = f.prepare();
    expect(f.snapshot.secretVersions[SECRET_KEY]).toMatchObject({numeric: {name: expect.stringMatching(/\/1$/)}, latest: {name: expect.stringMatching(/\/1$/)}});
    await secretReady(f, p);
    expect(f.snapshot.secretVersions[SECRET_KEY]).toMatchObject({numeric: {name: expect.stringMatching(/\/1$/)}, latest: {name: expect.stringMatching(/\/2$/)}});
    await applyFunction(context(f, p)); f.rebuild();
    expect(f.snapshot.secretVersions[SECRET_KEY]).toMatchObject({numeric: {name: expect.stringMatching(/\/2$/)}, latest: {name: expect.stringMatching(/\/2$/)}});
    await verifyFunction(context(f, p)); await applySubscriptions(context(f, p));
    await expect(verifyRepair(context(f, p))).resolves.toMatchObject({status: "PASS"});
  });
  it.each(["numeric", "latest"])("blocks inconsistent signing %s metadata rather than ignoring the dynamic pair", async field => {
    const f = fixture(), p = await secretReady(f);
    f.snapshot.secretVersions[SECRET_KEY][field] = field === "numeric" ? clone(f.snapshot.signingVersions[1]) : clone(f.snapshot.signingVersions[0]);
    await expect(applyFunction(context(f, p))).rejects.toThrow("signing-version-pair-inconsistent");
    expect(f.provider.patchFunctionBindings).not.toHaveBeenCalled();
  });
  it("claims durably before adding exactly one version, privately verifies it, then rebinds only that version", async () => {
    const f = fixture(), p = await secretReady(f);
    expect(f.events).toEqual(["claim", "durable:secret-intent.json", "add-version", "durable:secret-version.json"]);
    expect(f.provider.addSecretVersion).toHaveBeenCalledExactlyOnceWith({value: CANDIDATE});
    expect(f.provider.accessSecretVersion).toHaveBeenCalledExactlyOnceWith({version: "2"});
    await expect(applyFunction(context(f, p))).resolves.toMatchObject({status: "FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED"});
    expect(f.events.indexOf("durable:function-intent.json")).toBeLessThan(f.events.indexOf("patch-function"));
    const patch = f.provider.patchFunctionBindings.mock.calls[0][0]; expect(patch.name).toBe(TARGET_NAME);
    expect(patch.bindings).toEqual(p.beforeBindings.map(x => x.key === SECRET_KEY ? {...x, version: "2"} : x));
    expect(JSON.stringify([...f.files.values()])).not.toContain(CANDIDATE);
  });
  it("never creates a version for a different in-memory candidate", async () => {
    const f = fixture(), p = f.prepare();
    await expect(applySecret(context(f, p, {candidateSecret: "whsec_DIFFERENT1234"}))).rejects.toThrow("candidate-signing-secret-mismatch");
    expect(f.store.claim).not.toHaveBeenCalled(); expect(f.provider.addSecretVersion).not.toHaveBeenCalled();
  });
  it.each(["secret-intent.json", "secret-version.json", "function-intent.json", "operation.json"]) ("does not proceed after durable write failure at %s", async name => {
    const f = fixture(), p = f.prepare(), original = f.store.writeOnce.getMockImplementation();
    f.store.writeOnce.mockImplementation(async (file, value) => {if (file === name) throw Error("Disk failed"); return original(file, value);});
    if (name.startsWith("secret")) {
      const task = applySecret(context(f, p));
      if (name === "secret-intent.json") {await expect(task).rejects.toThrow(); expect(f.provider.addSecretVersion).not.toHaveBeenCalled();}
      else {await expect(task).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"}); await expect(applyFunction(context(f, p))).rejects.toThrow();}
    } else {
      await secretReady(f, p); const task = applyFunction(context(f, p));
      if (name === "function-intent.json") {await expect(task).rejects.toThrow(); expect(f.provider.patchFunctionBindings).not.toHaveBeenCalled();}
      else {await expect(task).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"}); await expect(verifyFunction(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});}
    }
  });
  it("keeps secret creation UNKNOWN and never infers latest or retries after a lost reply", async () => {
    const f = fixture(), p = f.prepare();
    f.provider.addSecretVersion.mockImplementation(async () => {f.snapshot.signingVersions.push(version("2")); throw Error("Response lost");});
    await expect(applySecret(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    await expect(applySecret(context(f, p))).rejects.toThrow("secret-stage-already-started");
    await expect(applyFunction(context(f, p))).rejects.toThrow();
    expect(f.provider.addSecretVersion).toHaveBeenCalledTimes(1); expect(f.provider.patchFunctionBindings).not.toHaveBeenCalled();
  });
  it.each([
    metadata => ({...metadata, name: metadata.name.replace("/2", "/1")}), metadata => ({...metadata, state: "DISABLED"}),
    metadata => ({...metadata, createTime: new Date(NOW - 1).toISOString()}), metadata => ({...metadata, name: metadata.name.replace("sodc-web", "foreign-project")}),
    metadata => ({...metadata, payload: {data: "NOT_ALLOWED"}}),
  ])("cannot progress on invalid secret acknowledgement", async change => {
    const f = fixture(), p = f.prepare(); f.provider.addSecretVersion.mockResolvedValue(change(version("2", new Date(NOW + 1).toISOString())));
    await expect(applySecret(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    expect(f.files.has("secret-version.json")).toBe(false); expect(f.provider.patchFunctionBindings).not.toHaveBeenCalled();
  });
  it("cannot progress if read-back differs from the approved candidate", async () => {
    const f = fixture(), p = f.prepare(); f.provider.accessSecretVersion.mockResolvedValue("whsec_DIFFERENT1234");
    await expect(applySecret(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    expect(f.files.has("secret-version.json")).toBe(false);
  });
  it.each([
    ["source bytes", f => {f.source.binding.trackedSha256 = "0".repeat(64);}],
    ["other Function", f => {f.snapshot.functions[1].serviceConfig.timeoutSeconds = 61;}],
    ["scheduler schedule", f => {f.snapshot.schedulers[0].schedule = "0 0 * * *";}],
    ["scheduler timezone", f => {f.snapshot.schedulers[0].timeZone = "UTC";}],
    ["scheduler retry", f => {f.snapshot.schedulers[0].retryConfig.retryCount = 4;}],
    ["invokers", f => {f.snapshot.invokerPolicies.stripeWebhookPayments.bindings[0].members.push("allAuthenticatedUsers");}],
    ["secret IAM", f => {f.snapshot.signingPolicy.bindings[0].members.push("user:other@example.invalid");}],
    ["another bound secret", f => {f.snapshot.secretVersions.STRIPE_SECRET.latest.state = "DISABLED";}],
    ["new competing secret version", f => {f.snapshot.signingVersions.push(version("3"));}],
    ["Stripe API version", f => {f.snapshot.stripe.endpoint.api_version = "other"; f.snapshot.stripe.endpoints[0].api_version = "other";}],
    ["target build env", f => {f.snapshot.functions[0].buildConfig.environmentVariables.PRIVATE_BUILD_VALUE = "changed";}],
  ])("blocks before Function mutation on %s drift", async (_name, change) => {
    const f = fixture(), p = await secretReady(f); change(f);
    await expect(applyFunction(context(f, p))).rejects.toThrow(); expect(f.provider.patchFunctionBindings).not.toHaveBeenCalled();
  });
  it.each(["secret", "function", "stripe"]) ("rechecks after durable intent for the %s mutation", async phase => {
    const f = fixture(), p = phase === "secret" ? f.prepare() : phase === "function" ? await secretReady(f) : await functionReady(f);
    const intentName = phase === "secret" ? "secret-intent.json" : phase === "function" ? "function-intent.json" : "stripe-intent.json";
    const original = f.store.writeOnce.getMockImplementation();
    f.store.writeOnce.mockImplementation(async (name, value) => {await original(name, value); if (name === intentName) f.snapshot.functions[1].serviceConfig.timeoutSeconds = 99;});
    const action = {secret: applySecret, function: applyFunction, stripe: applySubscriptions}[phase];
    await expect(action(context(f, p))).rejects.toThrow("protected-baseline-drift");
    expect({secret: f.provider.addSecretVersion, function: f.provider.patchFunctionBindings, stripe: f.provider.updateSubscriptions}[phase]).not.toHaveBeenCalled();
  });
  it("never replays a Function PATCH after acknowledgement loss", async () => {
    const f = fixture(), p = await secretReady(f); f.provider.patchFunctionBindings.mockRejectedValue(Error("Lost reply"));
    await expect(applyFunction(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    await expect(applyFunction(context(f, p))).rejects.toThrow("function-stage-already-started");
    await expect(verifyFunction(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    expect(f.provider.patchFunctionBindings).toHaveBeenCalledTimes(1);
  });
});

describe("rebuild-aware preservation and ordered subscriptions", () => {
  it("accepts changed source object/revision/image provenance only when the generation-bound archive bytes match", async () => {
    const f = fixture(), p = await functionReady(f);
    expect(f.files.get("function-pass.json")).toMatchObject({operationName: OPERATION, buildName: NEW_BUILD, version: "2"});
    expect(f.snapshot.functions[0].buildConfig.source).not.toEqual(p.baseline.sourceArchive);
    await expect(applySubscriptions(context(f, p))).resolves.toMatchObject({status: "SUBSCRIPTIONS_UPDATED_VERIFY_REQUIRED"});
    const call = f.provider.updateSubscriptions.mock.calls[0][0]; expect(call).toEqual({endpointId: ENDPOINT_ID, enabledEvents: REQUIRED_EVENTS,
      idempotencyKey: `sodc-dev-stripe-webhook-${digest(p)}`});
    expect(f.events.indexOf("durable:stripe-intent.json")).toBeLessThan(f.events.indexOf("update-stripe"));
    await expect(verifyRepair(context(f, p, {now: NOW + 2 * 3600000, review: undefined}))).resolves.toMatchObject({status: "PASS", runtimeAcceptancePassed: false, productionAuthorized: false});
    expect(f.provider.addSecretVersion).toHaveBeenCalledTimes(1); expect(f.provider.patchFunctionBindings).toHaveBeenCalledTimes(1); expect(f.provider.updateSubscriptions).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["different archive bytes", f => {f.snapshot.targetSourceArchive.sha256 = "a".repeat(64); f.snapshot.targetBuildArchive.sha256 = "a".repeat(64);}],
    ["unbound build archive", f => {f.snapshot.targetBuildArchive.generation = "99";}],
    ["unbound Function archive", f => {f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedStorageSource.object = "not-hash-bound.zip";}],
    ["extra Function provenance pointer", f => {f.snapshot.functions[0].buildConfig.sourceProvenance.resolvedGitSource = {revision: "other"};}],
    ["missing build", f => {delete f.snapshot.targetBuild;}],
    ["failed build", f => {f.snapshot.targetBuild.status = "FAILURE";}],
    ["working build", f => {f.snapshot.targetBuild.status = "WORKING";}],
    ["build before intent", f => {f.snapshot.targetBuild.createTime = new Date(NOW - 1).toISOString();}],
    ["nonchronological build", f => {f.snapshot.targetBuild.finishTime = new Date(NOW - 1).toISOString();}],
    ["operation target", f => {f.provider.operation.mockResolvedValue(operation({metadata: {target: TARGET_NAME.replace("sodc-web", "foreign"), verb: "update", buildName: NEW_BUILD}}));}],
    ["operation verb", f => {f.provider.operation.mockResolvedValue(operation({metadata: {target: TARGET_NAME, verb: "delete", buildName: NEW_BUILD}}));}],
    ["operation build mismatch", f => {f.provider.operation.mockResolvedValue(operation({metadata: {target: TARGET_NAME, verb: "update", buildName: NEW_BUILD + "-other"}}));}],
    ["other secret replaced", f => {f.snapshot.functions[0].serviceConfig.secretEnvironmentVariables.find(x => x.key === "STRIPE_SECRET").version = "2";}],
    ["old signing version disabled", f => {f.snapshot.signingVersions[0].state = "DISABLED";}],
    ["build service account", f => {f.snapshot.functions[0].buildConfig.serviceAccount = "other@example.invalid";}],
    ["runtime env", f => {f.snapshot.functions[0].serviceConfig.environmentVariables.PRIVATE_ENV = "changed";}],
    ["unrelated Function changed", f => {f.snapshot.functions[1].updateTime = new Date(NOW).toISOString();}],
    ["missing operation metadata", f => {f.provider.operation.mockResolvedValue({name: OPERATION, done: true});}],
  ])("refuses to verify or enable subscriptions after %s", async (_name, change) => {
    const f = fixture(), p = await secretReady(f); await applyFunction(context(f, p)); f.rebuild(); change(f);
    await expect(verifyFunction(context(f, p))).rejects.toThrow(); expect(f.files.has("function-pass.json")).toBe(false); expect(f.provider.updateSubscriptions).not.toHaveBeenCalled();
  });
  it("accepts a build created exactly at the durable intent timestamp", async () => {
    const f = fixture(), p = await secretReady(f); await applyFunction(context(f, p)); f.rebuild(); f.snapshot.targetBuild.createTime = new Date(NOW).toISOString();
    await expect(verifyFunction(context(f, p))).resolves.toMatchObject({status: "FUNCTION_VERIFIED"});
  });
  it("allows absent optional operation buildName only with independently bound successful current build proof", async () => {
    const f = fixture(), p = await secretReady(f); await applyFunction(context(f, p)); f.rebuild();
    f.provider.operation.mockResolvedValue(operation({metadata: {target: TARGET_NAME, verb: "update"}}));
    await expect(verifyFunction(context(f, p))).resolves.toMatchObject({status: "FUNCTION_VERIFIED"});
  });
  it("returns PENDING or failed without permitting subscriptions", async () => {
    const f = fixture(), p = await secretReady(f); await applyFunction(context(f, p));
    f.provider.operation.mockResolvedValue(operation({done: false})); await expect(verifyFunction(context(f, p))).resolves.toMatchObject({status: "PENDING"});
    f.provider.operation.mockResolvedValue(operation({error: {code: 7, message: "PRIVATE_UPSTREAM_DETAIL"}}));
    const result = await verifyFunction(context(f, p)); expect(result.status).toBe("OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED"); expect(JSON.stringify(result)).not.toContain("PRIVATE_UPSTREAM_DETAIL");
    await expect(applySubscriptions(context(f, p))).rejects.toThrow(); expect(f.provider.updateSubscriptions).not.toHaveBeenCalled();
  });
  it("never replays Stripe subscription update when its response is lost", async () => {
    const f = fixture(), p = await functionReady(f); f.provider.updateSubscriptions.mockRejectedValue(Error("Unknown outcome"));
    await expect(applySubscriptions(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    await expect(applySubscriptions(context(f, p))).rejects.toThrow("stripe-stage-already-started");
    await expect(verifyRepair(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"});
    expect(f.provider.updateSubscriptions).toHaveBeenCalledTimes(1);
  });
  it("fences a same-source replacement revision after the Stripe intent but before the provider write", async () => {
    const f = fixture(), p = await functionReady(f), original = f.store.writeOnce.getMockImplementation();
    f.store.writeOnce.mockImplementation(async (name, value) => {
      await original(name, value);
      if (name === "stripe-intent.json") {
        f.snapshot.functions[0].serviceConfig.revision = "newer-unreviewed-revision";
        f.snapshot.functions[0].buildConfig.build = NEW_BUILD + "-newer";
        f.snapshot.targetBuild.name = NEW_BUILD + "-newer";
      }
    });
    await expect(applySubscriptions(context(f, p))).rejects.toThrow("function-pass-baseline-drift");
    expect(f.provider.updateSubscriptions).not.toHaveBeenCalled();
  });
  it("rejects widened Stripe response before a success acknowledgement exists", async () => {
    const f = fixture(), p = await functionReady(f); f.provider.updateSubscriptions.mockResolvedValue({...f.snapshot.stripe.endpoint, enabled_events: ["*"]});
    await expect(applySubscriptions(context(f, p))).resolves.toMatchObject({status: "UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED"}); expect(f.files.has("stripe-ack.json")).toBe(false);
  });
  it("ignores only documented moving scheduler fields and IAM etags", async () => {
    const f = fixture(), p = await secretReady(f); f.snapshot.schedulers[0].lastAttemptTime = new Date(NOW).toISOString();
    f.snapshot.schedulers[0].scheduleTime = new Date(NOW + 300000).toISOString(); f.snapshot.schedulers[0].status = {code: 0};
    f.snapshot.invokerPolicies.stripeWebhookPayments.etag = "new-etag"; f.snapshot.signingPolicy.etag = "new-etag";
    await expect(applyFunction(context(f, p))).resolves.toMatchObject({status: "FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED"});
  });
});
