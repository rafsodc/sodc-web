import {beforeEach, afterEach, describe, expect, it, vi} from "vitest";
import {mkdtemp,realpath,mkdir,writeFile,readFile,readdir,stat,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {parseEvidenceArguments,readEvidenceToolBinding,runBindingEvidence,runEvidenceCommand} from "./notify-binding-evidence.mjs";
import {initializeRunDirectory,openRepairStore,readRepairRunEvidence} from "./notify-secret-binding-repair-store.mjs";
import {TOOL_BINDING,evidenceFixture} from "./test-fixtures/binding-evidence-fixture.mjs";
import {NOW,KEY,clone} from "./test-fixtures/notify-binding-repair-fixture.mjs";

const temporary = new Set();
const script = fileURLToPath(new URL("./notify-binding-evidence.mjs",import.meta.url));
const aliases = {projects:{dev:"sodc-web",prod:"sodc-web-production"}};
const json = async file => JSON.parse(await readFile(file,"utf8"));
const argumentsFor = (c,phase="capture") => ["--phase",phase,"--env","dev","--source-root",c.sourceRoot,"--output-dir",c.outputDirectory,
  ...(phase==="reconcile"?["--run-dir",c.runDirectory]:[])];

async function setup({original=false}={}) {
  const base = await realpath(await mkdtemp(path.join(tmpdir(),"binding-evidence-cli-"))); temporary.add(base);
  const root = path.join(base,"tool");await mkdir(root,{mode:0o700});
  await writeFile(path.join(root,".firebaserc"),JSON.stringify(aliases));
  const sourceRoot = path.join(base,"approved-source"); await mkdir(sourceRoot,{mode:0o700});
  await writeFile(path.join(sourceRoot,".firebaserc"),JSON.stringify(aliases));
  const runDirectory=path.join(base,"original-run"),lockDirectory=path.join(base,"project-claims"),outputDirectory=path.join(base,"new-evidence");
  const f=evidenceFixture();
  if(original) {
    await initializeRunDirectory(runDirectory,{proposal:f.original.proposal,comparisonKey:KEY});
    await writeFile(path.join(runDirectory,"review.json"),JSON.stringify(f.original.review),{mode:0o600});
    const writer=await openRepairStore({runDirectory,lockDirectory,proposal:f.original.proposal});
    await writer.writeOnce("intent.json",f.original.intent);
    await writer.writeOnce("operation.json",f.original.operation);
  }
  const deps={readSource:vi.fn(async()=>clone(f.source)),readTool:vi.fn(async()=>clone(TOOL_BINDING)),
    providerFactory:vi.fn(()=>f.provider),loadRun:vi.fn(readRepairRunEvidence),lockDirectory:vi.fn(()=>lockDirectory),now:()=>NOW+60_000};
  const options=phase=>({phase,environment:"dev",sourceRoot,outputDirectory,...(phase==="reconcile"?{runDirectory}:{})});
  return {root,sourceRoot,runDirectory,lockDirectory,outputDirectory,f,deps,options,
    run:(phase="capture",extra={})=>runBindingEvidence(root,{...options(phase),...extra},deps)};
}
async function recordBytes(directory) {
  return Object.fromEntries(await Promise.all((await readdir(directory)).map(async name=>[name,(await readFile(path.join(directory,name))).toString("hex")])));
}
beforeEach(()=>{vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("UNEXPECTED_LIVE_NETWORK_IN_EVIDENCE_CLI_TEST");}));});
afterEach(async()=>{
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {
    vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();
    await Promise.all([...temporary].map(folder=>rm(folder,{recursive:true,force:true})));temporary.clear();
  }
});

describe("read-only evidence command arguments",()=>{
  it.each(["dev","prod"])("accepts an explicit %s observation capture",async environment=>{
    const c=await setup();
    const args=argumentsFor(c);args[args.indexOf("--env")+1]=environment;
    expect(parseEvidenceArguments(args)).toEqual({...c.options("capture"),environment});
  });

  it("requires the original private run only for Dev reconciliation",async()=>{
    const c=await setup();
    expect(parseEvidenceArguments(argumentsFor(c,"reconcile"))).toEqual(c.options("reconcile"));
  });

  it("keeps help standalone and independent of source, disk and provider calls",async()=>{
    const readSource=vi.fn(),readTool=vi.fn(),providerFactory=vi.fn(),loadRun=vi.fn();
    expect(parseEvidenceArguments(["--help"])).toEqual({help:true});
    const result=await runBindingEvidence("/does-not-exist",{help:true},{readSource,readTool,providerFactory,loadRun});
    expect(result.status).toBe("HELP");
    expect(readSource).not.toHaveBeenCalled();expect(readTool).not.toHaveBeenCalled();expect(providerFactory).not.toHaveBeenCalled();expect(loadRun).not.toHaveBeenCalled();
  });

  it.each([
    [],["--help","--env","dev"],
    ["--phase","apply","--env","dev","--source-root","/source","--output-dir","/output"],
    ["--phase","capture","--env","beta","--source-root","/source","--output-dir","/output"],
    ["--phase","capture","--env","dev","--output-dir","/output"],
    ["--phase","capture","--env","dev","--source-root","/source"],
    ["--phase","capture","--env","dev","--source-root","relative","--output-dir","/output"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","relative"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","/tmp/../output"],
    ["--phase","reconcile","--env","prod","--source-root","/source","--output-dir","/output","--run-dir","/original"],
    ["--phase","reconcile","--env","dev","--source-root","/source","--output-dir","/output"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","/output","--run-dir","/original"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","/output","--approve","true"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","/output","--retry","true"],
    ["--phase","capture","--env","dev","--source-root","/source","--output-dir","/output","--env","dev"],
  ])("rejects unsupported, missing or mutation-oriented arguments %j",args=>{
    expect(()=>parseEvidenceArguments(args)).toThrow();
  });
});

describe("private prospective evidence capture",()=>{
  it("writes a new private report and key while exposing only summary metadata",async()=>{
    const c=await setup();
    const result=await c.run();
    expect(result.status).toBe("CAPTURED_OBSERVATION_NOT_APPROVAL");
    expect((await stat(c.outputDirectory)).mode&0o7777).toBe(0o700);
    expect((await readdir(c.outputDirectory)).sort()).toEqual(["comparison.key","initialized.json","report.json"]);
    for(const name of await readdir(c.outputDirectory))expect((await stat(path.join(c.outputDirectory,name))).mode&0o7777).toBe(0o600);
    expect((await readFile(path.join(c.outputDirectory,"comparison.key"))).length).toBe(32);
    const report=await json(path.join(c.outputDirectory,"report.json"));
    expect(report).toMatchObject({schemaVersion:"sodc-notify-binding-capture/v1",originalContractAccepted:false,productionAuthorized:false,observationOnly:true});
    const publicOutput=JSON.stringify(result);
    expect(publicOutput).not.toContain("PRIVATE_ENV_VALUE_744");
    expect(publicOutput).not.toContain("comparisonKey");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    expect(c.deps.loadRun).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing output directory or its contents",async()=>{
    const c=await setup();await c.run();const before=await recordBytes(c.outputDirectory);
    await expect(c.run()).rejects.toThrow();
    expect(await recordBytes(c.outputDirectory)).toEqual(before);
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("refuses a mismatched Firebase alias before constructing a provider",async()=>{
    const c=await setup();
    for(const folder of [c.root,c.sourceRoot])await writeFile(path.join(folder,".firebaserc"),JSON.stringify({projects:{dev:"wrong-project"}}));
    await expect(c.run()).rejects.toThrow();
    expect(c.deps.providerFactory).not.toHaveBeenCalled();
    await expect(stat(c.outputDirectory)).rejects.toHaveProperty("code","ENOENT");
  });

  it("rejects invalid source evidence before a provider read",async()=>{
    const c=await setup();c.deps.readSource.mockResolvedValue({...c.f.source,binding:{...c.f.source.binding,gitSha:"invalid"}});
    await expect(c.run()).rejects.toThrow();
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();
    await expect(stat(c.outputDirectory)).rejects.toHaveProperty("code","ENOENT");
  });

  it.each(["tool","application"])("refuses output nested inside the %s source checkout",async kind=>{
    const c=await setup();
    const outputDirectory=path.join(kind==="tool"?c.root:c.sourceRoot,"unwanted-report");
    await expect(c.run("capture",{outputDirectory})).rejects.toThrow("output-inside-source-checkout");
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();
    await expect(stat(outputDirectory)).rejects.toHaveProperty("code","ENOENT");
  });

  it("rechecks the application source after awaited metadata before writing any report",async()=>{
    const c=await setup();
    c.deps.readSource.mockResolvedValueOnce(clone(c.f.source)).mockResolvedValueOnce({...clone(c.f.source),binding:{...c.f.source.binding,gitSha:"0".repeat(40)}});
    await expect(c.run()).rejects.toThrow("application-source-changed-during-evidence");
    await expect(stat(c.outputDirectory)).rejects.toHaveProperty("code","ENOENT");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it("rechecks the running tool source after awaited metadata before writing any report",async()=>{
    const c=await setup();
    c.deps.readTool.mockResolvedValueOnce(clone(TOOL_BINDING)).mockResolvedValueOnce({...TOOL_BINDING,gitSha:"0".repeat(40)});
    await expect(c.run()).rejects.toThrow("tool-source-changed-during-evidence");
    await expect(stat(c.outputDirectory)).rejects.toHaveProperty("code","ENOENT");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
});

describe("known-operation reconciliation preserves the old private run",()=>{
  it("writes a separate gap report without copying the old comparison key or changing any old record",async()=>{
    const c=await setup({original:true});
    const before=await recordBytes(c.runDirectory),claimBefore=await recordBytes(c.lockDirectory);
    const result=await c.run("reconcile");
    expect(result.status).toBe("REVIEW_REQUIRED_WITH_HISTORICAL_GAPS");
    expect(await recordBytes(c.runDirectory)).toEqual(before);
    expect(await recordBytes(c.lockDirectory)).toEqual(claimBefore);
    expect((await readdir(c.outputDirectory)).sort()).toEqual(["initialized.json","report.json"]);
    const report=await json(path.join(c.outputDirectory,"report.json"));
    expect(report).toMatchObject({originalContractAccepted:false,productionAuthorized:false,sourceArchiveEquality:"UNPROVEN",historicalTargetPreservation:"UNKNOWN"});
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    expect(c.deps.loadRun).toHaveBeenCalledWith({runDirectory:c.runDirectory,lockDirectory:c.lockDirectory});
  });

  it.each(["same","nested"])("refuses %s output inside the original run before reading it or any provider",async kind=>{
    const c=await setup({original:true});const before=await recordBytes(c.runDirectory);
    const outputDirectory=kind==="same"?c.runDirectory:path.join(c.runDirectory,"unwanted-report");
    await expect(c.run("reconcile",{outputDirectory})).rejects.toThrow();
    expect(c.deps.loadRun).not.toHaveBeenCalled();expect(c.f.provider.snapshot).not.toHaveBeenCalled();expect(c.f.provider.operation).not.toHaveBeenCalled();
    expect(await recordBytes(c.runDirectory)).toEqual(before);
  });

  it("keeps an absent acknowledgement unknown and writes no key or old-run records",async()=>{
    const c=await setup({original:true});await rm(path.join(c.runDirectory,"operation.json"));
    const before=await recordBytes(c.runDirectory);
    const result=await c.run("reconcile");
    expect(result.status).toBe("UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED");
    expect(await recordBytes(c.runDirectory)).toEqual(before);
    expect(c.f.provider.snapshot).not.toHaveBeenCalled();expect(c.f.provider.operation).not.toHaveBeenCalled();
    expect((await readdir(c.outputDirectory)).sort()).toEqual(["initialized.json","report.json"]);
  });

  it("retains PENDING as unresolved without invoking any write capability",async()=>{
    const c=await setup({original:true});c.f.provider.operation.mockResolvedValue({name:c.f.original.operation.name,done:false});
    const result=await c.run("reconcile");
    expect(result.status).toBe("PENDING");expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    expect(c.f.provider.provenance).not.toHaveBeenCalled();
  });

  it("preserves every old byte when new report initialization fails",async()=>{
    const c=await setup({original:true});const before=await recordBytes(c.runDirectory);
    await expect(runBindingEvidence(c.root,c.options("reconcile"),{...c.deps,initialize:vi.fn(async()=>{throw new Error("PRIVATE_DISK_FAILURE");})})).rejects.toThrow();
    expect(await recordBytes(c.runDirectory)).toEqual(before);expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });

  it.each(["review","comparison key"])("rejects a concurrent change to the original %s instead of publishing mixed evidence",async change=>{
    const c=await setup({original:true});
    c.f.provider.provenance.mockImplementation(async()=>{
      if(change==="review"){
        const review=await json(path.join(c.runDirectory,"review.json"));review.reason="A different review arrived during evidence collection";
        await writeFile(path.join(c.runDirectory,"review.json"),JSON.stringify(review));
      } else await writeFile(path.join(c.runDirectory,"comparison.key"),Buffer.alloc(32,0x75));
      return {currentRevision:{state:"NOT_REQUESTED"},previousRevision:{state:"NOT_REQUESTED"},functionBuild:{state:"NOT_REQUESTED"},
        operationBuild:{state:"NOT_REQUESTED"},sourceObject:{state:"NOT_REQUESTED"}};
    });
    await expect(c.run("reconcile")).rejects.toThrow("original-records-changed-during-evidence");
    await expect(stat(c.outputDirectory)).rejects.toHaveProperty("code","ENOENT");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
});

describe("actual tracked tool source inspection",()=>{
  async function repository(){
    const c=await setup();
    await writeFile(path.join(c.root,"tool.mjs"),"export const fixture = true;\n");
    execFileSync("git",["init","-q"],{cwd:c.root});
    execFileSync("git",["add",".firebaserc","tool.mjs"],{cwd:c.root});
    execFileSync("git",["-c","user.name=Evidence Fixture","-c","user.email=evidence@fixture.invalid","commit","-qm","tool source fixture"],{cwd:c.root});
    return c;
  }
  it("binds a real clean commit, tree and tracked byte digest",async()=>{
    const c=await repository();const value=await readEvidenceToolBinding(c.root);
    expect(value).toEqual({gitSha:execFileSync("git",["rev-parse","HEAD"],{cwd:c.root,encoding:"utf8"}).trim(),
      tree:execFileSync("git",["rev-parse","HEAD^{tree}"],{cwd:c.root,encoding:"utf8"}).trim(),trackedSha256:expect.stringMatching(/^[a-f0-9]{64}$/),nodeMajor:24});
    expect(await readEvidenceToolBinding(c.root)).toEqual(value);
  });
  it("refuses a dirty tracked tool before claiming a source binding",async()=>{
    const c=await repository();await writeFile(path.join(c.root,"tool.mjs"),"export const fixture = false;\n");
    await expect(readEvidenceToolBinding(c.root)).rejects.toThrow("tool-source-not-clean");
  });
  it("checks actual bytes even when Git assume-unchanged hides the mutation",async()=>{
    const c=await repository();execFileSync("git",["update-index","--assume-unchanged","tool.mjs"],{cwd:c.root});
    await writeFile(path.join(c.root,"tool.mjs"),"export const fixture = false;\n");
    expect(execFileSync("git",["status","--porcelain=v1"],{cwd:c.root,encoding:"utf8"}).trim()).toBe("");
    await expect(readEvidenceToolBinding(c.root)).rejects.toThrow("tool-source-bytes-changed");
  });
});

describe("exit statuses and sanitized command output",()=>{
  function writers(){return {stdout:vi.fn(),stderr:vi.fn()};}
  it("returns zero for help without credentials or an existing repository",async()=>{
    const out=writers();expect(await runEvidenceCommand(["--help"],{root:"/does-not-exist",...out})).toBe(0);
    expect(out.stdout).toHaveBeenCalledTimes(1);expect(out.stderr).not.toHaveBeenCalled();
  });
  it("returns zero only for a completed observation capture",async()=>{
    const c=await setup();const out=writers();
    expect(await runEvidenceCommand(argumentsFor(c),{root:c.root,deps:c.deps,...out})).toBe(0);
    expect(JSON.parse(out.stdout.mock.calls[0][0]).status).toBe("CAPTURED_OBSERVATION_NOT_APPROVAL");
    expect(out.stderr).not.toHaveBeenCalled();
  });
  it("returns three for the historical-gap reconciliation report",async()=>{
    const c=await setup({original:true});const out=writers();
    expect(await runEvidenceCommand(argumentsFor(c,"reconcile"),{root:c.root,deps:c.deps,...out})).toBe(3);
    expect(JSON.parse(out.stdout.mock.calls[0][0]).status).toBe("REVIEW_REQUIRED_WITH_HISTORICAL_GAPS");
  });
  it("returns three for unknown acknowledgement and pending operation outcomes",async()=>{
    for(const state of ["unknown","pending"]){
      const c=await setup({original:true});const out=writers();
      if(state==="unknown")await rm(path.join(c.runDirectory,"operation.json"));
      else c.f.provider.operation.mockResolvedValue({name:c.f.original.operation.name,done:false});
      expect(await runEvidenceCommand(argumentsFor(c,"reconcile"),{root:c.root,deps:c.deps,...out})).toBe(3);
      expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
    }
  });
  it("returns three for a known failed operation without exposing provider error details",async()=>{
    const c=await setup({original:true});const out=writers();
    c.f.provider.operation.mockResolvedValue({name:c.f.original.operation.name,done:true,metadata:{target:c.f.original.proposal.target,verb:"update"},
      error:{code:7,message:"PRIVATE_OPERATION_ERROR"}});
    expect(await runEvidenceCommand(argumentsFor(c,"reconcile"),{root:c.root,deps:c.deps,...out})).toBe(3);
    expect(JSON.stringify(out.stdout.mock.calls)).not.toContain("PRIVATE_OPERATION_ERROR");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
  it("returns one for protected drift without exposing private values",async()=>{
    const c=await setup({original:true});const out=writers();c.f.f.snapshot.functions[1].serviceConfig.environmentVariables.PRIVATE_LEGACY_VALUE="PRIVATE_DRIFT_CANARY";
    expect(await runEvidenceCommand(argumentsFor(c,"reconcile"),{root:c.root,deps:c.deps,...out})).toBe(1);
    expect(JSON.stringify(out.stdout.mock.calls)).not.toContain("PRIVATE_DRIFT_CANARY");
    expect(c.f.provider.patchBindings).not.toHaveBeenCalled();
  });
  it("sanitizes arbitrary provider failures including nonce-shaped error codes",async()=>{
    const c=await setup();const out=writers();const error=new Error("PRIVATE_PROVIDER_MESSAGE");error.code="private-provider-nonce-746";
    c.f.provider.snapshot.mockRejectedValue(error);
    expect(await runEvidenceCommand(argumentsFor(c),{root:c.root,deps:c.deps,...out})).toBe(1);
    const output=JSON.stringify([out.stdout.mock.calls,out.stderr.mock.calls]);
    expect(output).not.toContain("PRIVATE_PROVIDER_MESSAGE");expect(output).not.toContain("private-provider-nonce-746");
  });
  it("runs actual help in a subprocess without gcloud or a source checkout",()=>{
    const out=execFileSync(process.execPath,[script,"--help"],{encoding:"utf8",env:{PATH:"/nonexistent"}});
    expect(out).toContain("capture");expect(out).toContain("reconcile");
  });
});
