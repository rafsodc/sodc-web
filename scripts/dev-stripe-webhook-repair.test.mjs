import {afterEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm, chmod, symlink, open} from "node:fs/promises";
import {tmpdir} from "node:os";
import {PassThrough} from "node:stream";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {parseRepairArguments, validateRunPath, readSecretInput, runRepair, runRepairCommand} from "./dev-stripe-webhook-repair.mjs";
import {fixture, approved, CANDIDATE, NOW} from "./test-fixtures/dev-stripe-webhook-repair-fixture.mjs";

const directories = new Set();
const json = async file => JSON.parse(await readFile(file, "utf8"));
const cli = fileURLToPath(new URL("./dev-stripe-webhook-repair.mjs", import.meta.url));
const pathOptions = {platform: "linux", temporaryRoot: "/tmp"};
const valid = ["--env", "dev", "--phase", "prepare", "--run-dir", "/tmp/sodc-dev-stripe-webhook-repair-run-example", "--secret-stdin"];
const pipeStat = {statDescriptor: () => ({isFIFO: () => true, isSocket: () => false})};
const inputReader = `import {readSecretInput} from ${JSON.stringify(new URL("./dev-stripe-webhook-repair.mjs", import.meta.url).href)};
try {await readSecretInput(); process.stdout.write("ACCEPTED");} catch(error) {process.stderr.write(error.code); process.exitCode=1;}`;
async function setup() {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "sodc-webhook-cli-"))); directories.add(parent);
  const root = path.join(parent, "checkout"); await mkdir(root, {mode:0o700});
  await writeFile(path.join(root, ".firebaserc"), JSON.stringify({projects:{dev:"sodc-web",prod:"sodc-web-production"}}));
  const runDirectory = path.join(parent, "sodc-dev-stripe-webhook-repair-run-fixture");
  const lockDirectory = path.join(root, ".firebase/dev-stripe-webhook-repair-locks");
  const f=fixture();
  const dependencies={readSource:f.readSource,providerFactory:vi.fn(()=>f.provider),readCandidate:vi.fn(async()=>CANDIDATE),
    lockDirectory:()=>lockDirectory,now:()=>NOW,pathOptions:{platform:"linux",temporaryRoot:parent}};
  const run=phase=>runRepair(root,{environment:"dev",phase,runDirectory,...(["prepare","apply-secret"].includes(phase)?{secretStdin:true}:{})},dependencies);
  const approve=async()=>{const p=await json(path.join(runDirectory,"proposal.json"));await writeFile(path.join(runDirectory,"review.json"),JSON.stringify(approved(p)),{mode:0o600});return p;};
  return {parent,root,runDirectory,lockDirectory,f,dependencies,run,approve};
}
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();await Promise.all([...directories].map(d=>rm(d,{recursive:true,force:true})));directories.clear();});

describe("fixed Dev webhook command boundary",()=>{
  it("accepts the exact Dev phase and protected input flag",()=>{
    expect(parseRepairArguments(valid,pathOptions)).toEqual({environment:"dev",phase:"prepare",runDirectory:valid[5],secretStdin:true});
  });
  it.each(["apply-function","verify-function","apply-subscriptions","verify"])("takes no credential input in %s",phase=>{
    const args=[...valid];args[3]=phase;args.pop();expect(parseRepairArguments(args,pathOptions).phase).toBe(phase);
    expect(()=>parseRepairArguments([...args,"--secret-stdin"],pathOptions)).toThrow("secret-input-phase-mismatch");
  });
  it.each([
    [],["--help","--env","dev"],
    ["--env","prod","--phase","prepare","--run-dir",valid[5],"--secret-stdin"],
    ["--env","beta","--phase","prepare","--run-dir",valid[5],"--secret-stdin"],
    ["--env","dev","--phase","apply","--run-dir",valid[5]],
    ["--env","dev","--phase","prepare","--run-dir",valid[5]],
    [...valid,"--secret-stdin"],[...valid,"--env","dev"],[...valid,"--target","anotherFunction"],
    [...valid,"--secret",CANDIDATE],[...valid,"--secret-file","/tmp/value"],[...valid,"--review","/tmp/review"],
  ])("rejects implicit or broadened inputs %j",(...args)=>expect(()=>parseRepairArguments(args,pathOptions)).toThrow());
  it.each(["relative","/tmp/existing-run","/tmp/sodc-dev-stripe-webhook-repair-run-x/nested","/tmp/../tmp/sodc-dev-stripe-webhook-repair-run-x","/tmp/sodc-dev-stripe-webhook-repair-run-x/","/tmp/sodc-dev-stripe-webhook-repair-run-"])("rejects unsafe output %s",value=>{
    expect(()=>validateRunPath(value,pathOptions)).toThrow();
  });
  it("rejects overlap before any provider or credential work",async()=>{
    const root="/tmp/sodc-dev-stripe-webhook-repair-run-source";const readSource=vi.fn(),readCandidate=vi.fn(),providerFactory=vi.fn();
    await expect(runRepair(root,{environment:"dev",phase:"prepare",runDirectory:root,secretStdin:true},{readSource,readCandidate,providerFactory,pathOptions})).rejects.toThrow("run-overlaps-source");
    expect(readSource).not.toHaveBeenCalled();expect(readCandidate).not.toHaveBeenCalled();expect(providerFactory).not.toHaveBeenCalled();
  });
  it("validates the Dev alias before source, credential or provider work",async()=>{
    const c=await setup();await writeFile(path.join(c.root,".firebaserc"),JSON.stringify({projects:{dev:"sodc-web-production"}}));
    await expect(c.run("prepare")).rejects.toThrow();expect(c.dependencies.readCandidate).not.toHaveBeenCalled();expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
  });
  it.each(["existing", "symlink", "unsafe-parent"])("rejects %s prepare storage before credential/provider work",async kind=>{
    const c=await setup();
    if(kind==="existing")await mkdir(c.runDirectory,{mode:0o700});
    else if(kind==="symlink")await symlink(c.root,c.runDirectory);
    else await chmod(c.parent,0o777);
    try{await expect(c.run("prepare")).rejects.toThrow();}
    finally{await chmod(c.parent,0o700);}
    expect(c.dependencies.readCandidate).not.toHaveBeenCalled();expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
  });
  it("offers process help without cloud access and never reflects invalid values",()=>{
    const out=execFileSync(process.execPath,[cli,"--help"],{encoding:"utf8",timeout:10000});expect(out).toContain("Dev only");expect(out).toContain("SIMULATION");
    let error;try{execFileSync(process.execPath,[cli,"--secret",CANDIDATE],{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:10000});}catch(e){error=e;}
    expect(error.status).toBe(1);expect(error.stderr).toBe("Dev Stripe webhook repair blocked: invalid-arguments.\n");expect(error.stdout).toBe("");
  });
});

describe("protected credential input",()=>{
  it("reads a pipe without echoing and removes only its final line terminator",async()=>{
    const input=new PassThrough();input.fd=0;const output={write:vi.fn()};input.end(CANDIDATE+"\r\n");
    expect(await readSecretInput(input,output,pipeStat)).toBe(CANDIDATE);expect(output.write).not.toHaveBeenCalled();
  });
  it.each(["",CANDIDATE+" "," "+CANDIDATE,CANDIDATE+"\n\n","invalid-signing-secret-prefix",'"'+CANDIDATE+'"',"x".repeat(600)])("rejects altered/invalid pipe value %j",async value=>{
    const input=new PassThrough();input.fd=0;input.end(value);await expect(readSecretInput(input,{write:vi.fn()},pipeStat)).rejects.toThrow();
  });
  it("accepts real child-process pipe input without echoing its value",()=>{
    const result=execFileSync(process.execPath,["--input-type=module","-e",inputReader],{input:CANDIDATE+"\n",encoding:"utf8",timeout:10000});
    expect(result).toBe("ACCEPTED");
  });
  it("rejects a real regular-file stdin redirect before consuming input",async()=>{
    const c=await setup(),file=path.join(c.parent,"synthetic-input.txt");await writeFile(file,CANDIDATE+"\n",{mode:0o600});
    const handle=await open(file,"r");
    try {
      const input=new PassThrough();input.fd=handle.fd;const iterator=vi.spyOn(input,Symbol.asyncIterator);
      await expect(readSecretInput(input,{write:vi.fn()})).rejects.toThrow("protected-pipe-required");expect(iterator).not.toHaveBeenCalled();
      let failure;try{execFileSync(process.execPath,["--input-type=module","-e",inputReader],{stdio:[handle.fd,"pipe","pipe"],encoding:"utf8",timeout:10000});}catch(error){failure=error;}
      expect(failure.status).toBe(1);expect(failure.stdout).toBe("");expect(failure.stderr).toBe("protected-pipe-required");
    } finally {await handle.close();}
  });
  it.each([undefined,-1,999999])("rejects a missing or unreadable descriptor before input (%j)",async fd=>{
    const input=new PassThrough();input.fd=fd;const iterator=vi.spyOn(input,Symbol.asyncIterator);
    await expect(readSecretInput(input,{write:vi.fn()})).rejects.toThrow("protected-pipe-required");expect(iterator).not.toHaveBeenCalled();
  });
  it("hides terminal input and always restores terminal mode",async()=>{
    const input=new PassThrough();input.isTTY=true;input.setRawMode=vi.fn();const output={write:vi.fn()};
    const reading=readSecretInput(input,output);input.write(Buffer.from(CANDIDATE+"\r"));
    expect(await reading).toBe(CANDIDATE);expect(input.setRawMode.mock.calls).toEqual([[true],[false]]);
    expect(output.write.mock.calls.flat().join("")).not.toContain(CANDIDATE);
  });
  it("restores terminal mode after cancellation",async()=>{
    const input=new PassThrough();input.isTTY=true;input.setRawMode=vi.fn();const reading=readSecretInput(input,{write:vi.fn()});input.write(Buffer.from([3]));
    await expect(reading).rejects.toThrow("secret-input-cancelled");expect(input.setRawMode.mock.calls).toEqual([[true],[false]]);
  });
  it.each(["resume", "prompt", "restore", "pause", "newline"])("settles and removes terminal listeners if %s throws",async kind=>{
    const input=new PassThrough();input.isTTY=true;input.setRawMode=vi.fn();
    const output={write:vi.fn()};
    if(kind==="resume")input.resume=vi.fn(()=>{throw Error("PRIVATE_TERMINAL");});
    if(kind==="prompt")output.write.mockImplementationOnce(()=>{throw Error("PRIVATE_TERMINAL");});
    if(kind==="restore")input.setRawMode.mockImplementation(raw=>{if(!raw)throw Error("PRIVATE_TERMINAL");});
    if(kind==="pause")input.pause=vi.fn(()=>{throw Error("PRIVATE_TERMINAL");});
    if(kind==="newline")output.write.mockImplementationOnce(()=>true).mockImplementationOnce(()=>{throw Error("PRIVATE_TERMINAL");});
    const reading=readSecretInput(input,output);
    if(!["resume","prompt"].includes(kind))input.write(Buffer.from(CANDIDATE+"\r"));
    await expect(reading).rejects.toThrow(/protected-terminal-unavailable|secret-input-cleanup-failed/);
    expect(input.listenerCount("data")).toBe(0);expect(input.listenerCount("end")).toBe(0);expect(input.listenerCount("error")).toBe(0);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });
  it("restores a terminal's previous raw state",async()=>{
    const input=new PassThrough();input.isTTY=true;input.isRaw=true;input.setRawMode=vi.fn();
    const reading=readSecretInput(input,{write:vi.fn()});input.write(Buffer.from(CANDIDATE+"\r"));
    expect(await reading).toBe(CANDIDATE);expect(input.setRawMode.mock.calls).toEqual([[true],[true]]);
  });
});

describe("real private storage with controlled provider transport",()=>{
  it("keeps preparation read-only and stores a blinded candidate, never its value",async()=>{
    const c=await setup();const result=await c.run("prepare");expect(result.status).toBe("REVIEW_REQUIRED");
    expect(c.f.provider.addSecretVersion).not.toHaveBeenCalled();expect(c.f.provider.patchFunctionBindings).not.toHaveBeenCalled();expect(c.f.provider.updateSubscriptions).not.toHaveBeenCalled();
    const p=await json(path.join(c.runDirectory,"proposal.json"));expect(p.acceptsExistingDevBacklog).toBe(true);
    for(const name of await readdir(c.runDirectory)){if(name.endsWith(".json"))expect(await readFile(path.join(c.runDirectory,name),"utf8")).not.toContain(CANDIDATE);}
    expect(c.dependencies.readCandidate).toHaveBeenCalledTimes(1);
  });
  it("runs all three exact writes once with a verified rebuild in between",async()=>{
    const c=await setup();await c.run("prepare");await c.approve();
    expect((await c.run("apply-secret")).status).toBe("SECRET_VERSION_CREATED");
    expect((await c.run("apply-function")).status).toBe("FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED");
    c.f.rebuild();expect((await c.run("verify-function")).status).toBe("FUNCTION_VERIFIED");
    expect((await c.run("apply-subscriptions")).status).toBe("SUBSCRIPTIONS_UPDATED_VERIFY_REQUIRED");
    expect((await c.run("verify")).status).toBe("PASS");
    expect(c.f.provider.addSecretVersion).toHaveBeenCalledTimes(1);expect(c.f.provider.patchFunctionBindings).toHaveBeenCalledTimes(1);expect(c.f.provider.updateSubscriptions).toHaveBeenCalledTimes(1);
    expect(c.dependencies.readCandidate).toHaveBeenCalledTimes(2);
    expect((await c.run("verify")).runtimeAcceptancePassed).toBe(false);
  });
  it("does not continue after an uncertain addVersion or retry that request",async()=>{
    const c=await setup();await c.run("prepare");await c.approve();c.f.provider.addSecretVersion.mockRejectedValueOnce(new Error("PRIVATE_PAYLOAD"));
    expect((await c.run("apply-secret")).status).toBe("UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED");
    await expect(c.run("apply-secret")).rejects.toThrow();await expect(c.run("apply-function")).rejects.toThrow();
    expect(c.f.provider.addSecretVersion).toHaveBeenCalledTimes(1);expect(c.f.provider.patchFunctionBindings).not.toHaveBeenCalled();
  });
  it.each(["missing-review", "malformed-review", "source-drift", "already-started"])("checks %s before requesting the candidate again",async kind=>{
    const c=await setup();await c.run("prepare");
    if(kind!=="missing-review")await c.approve();
    if(kind==="malformed-review")await writeFile(path.join(c.runDirectory,"review.json"),"not json",{mode:0o600});
    if(kind==="source-drift")c.dependencies.readSource=async()=>({...await c.f.readSource(),binding:{...c.f.source.binding,gitSha:"e".repeat(40)}});
    if(kind==="already-started")await c.run("apply-secret");
    c.dependencies.readCandidate.mockClear();c.dependencies.providerFactory.mockClear();
    await expect(c.run("apply-secret")).rejects.toThrow();
    expect(c.dependencies.readCandidate).not.toHaveBeenCalled();expect(c.dependencies.providerFactory).not.toHaveBeenCalled();
  });
  it("prints only controlled error codes for unexpected failures",async()=>{
    const c=await setup(),out={write:vi.fn()},err={write:vi.fn()};
    const code=await runRepairCommand(["--env","dev","--phase","prepare","--run-dir",c.runDirectory,"--secret-stdin"],
      {root:c.root,stdout:out,stderr:err,...c.dependencies,readSource:async()=>{throw Error("PRIVATE_SOURCE_ENV");}});
    expect(code).toBe(1);expect(out.write).not.toHaveBeenCalled();expect(err.write).toHaveBeenCalledExactlyOnceWith("Dev Stripe webhook repair blocked: unsupported-or-invalid-input.\n");
  });
});
