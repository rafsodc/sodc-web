import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {parseMigrationArguments, runMigrationCli} from './authorization-migration.mjs';
import {createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash, PHASE_ASSERTIONS, prepareMigrationRun, recordMigrationGate} from './authorization-migration-state.mjs';

const originalSha='a'.repeat(40), toolSha='b'.repeat(40);
const now=new Date('2026-10-25T12:00:00.000Z');
const roots=[];
afterEach(async()=>{for(const directory of roots.splice(0))await rm(directory,{recursive:true,force:true});});
const rawDiff=filename=>`:100644 100644 ${'c'.repeat(40)} ${'d'.repeat(40)} M\0${filename}\0`;
async function fixture({projectId='sodc-web',installation='strict'}={}){
 const temporary=await mkdtemp(path.join(tmpdir(),'migration-tool-cli-'));roots.push(temporary);
 const repositoryRoot=path.join(temporary,'repo');await mkdir(repositoryRoot);
 const options={repositoryRoot,projectId,runId:'tool-source-dev'};
 const plan=createMigrationPlan({...options,gitSha:originalSha,operator:'operator',reason:'reviewed strict Dev rehearsal',installation,artifactDirectory:path.join(temporary,'artifacts'),now});
 const prepared=await prepareMigrationRun({repositoryRoot,plan});
 for(const gate of [{gate:'backup',details:projectId==='sodc-web'?{waiverReference:'Dev waiver'}:{backupReference:'backup',restoreTestReference:'restore'}},{gate:'freeze-scope',details:{entrypoints:['grantAdmin'],jobNames:[],externalWritersReference:'reviewed external writers',probeUserId:'approved-nonadmin',probeReference:'existing signed probe'}}])await recordMigrationGate(options,{schemaVersion:'sodc-authorization-migration-gate/v1',projectId,gitSha:originalSha,runId:plan.runId,reviewedBy:'operator',observedAt:now.toISOString(),evidence:'local reviewed evidence',...gate},now);
 const inventory={schemaVersion:'sodc-cloud-run-writer-inventory/v1',projectId,services:[]};
 const freeze={projectId,gitSha:originalSha,runId:plan.runId,planHash:prepared.planHash,completedAt:now.toISOString(),oldWriterInventory:inventory,originalPolicies:[],originalJobs:[],apiFrozen:true};
 const baseline={projectId,gitSha:originalSha,installation,authority:{counts:{identities:9,profiles:8,states:7}},functions:[],policies:[],jobs:[]};
 const adapter={observe:vi.fn(async()=>({projectId,gitSha:originalSha,observedAt:now.toISOString()})),perform:vi.fn(async phase=>phase==='inspect'?{baseline}:{stateHash:migrationHash(freeze)}),verify:vi.fn(async phase=>({ok:true,evidence:{projectId,gitSha:originalSha,runId:plan.runId,planHash:prepared.planHash,observedAt:now.toISOString(),assertions:{...Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,true])),...(phase==='freeze'?{oldWritersRetired:false}:{})}}})),close:vi.fn()};
 await executeMigrationPhase(options,{phase:'inspect',confirmProject:projectId,adapter,sourceCheck:async()=>{},now:()=>now});
 await expect(executeMigrationPhase(options,{phase:'freeze',confirmProject:projectId,adapter,sourceCheck:async()=>{},now:()=>now})).rejects.toMatchObject({code:'PHASE_NOT_VERIFIED'});
 await writeFile(path.join(prepared.directory,'provider-freeze.json'),JSON.stringify(freeze),{mode:0o600});
 await writeFile(path.join(prepared.directory,'provider-old-writer-inventory.json'),JSON.stringify({projectId,gitSha:originalSha,runId:plan.runId,planHash:prepared.planHash,capturedAt:now.toISOString(),inventory,inventoryHash:migrationHash(inventory)}),{mode:0o600});
 await writeFile(path.join(prepared.directory,'provider-freeze-proof.json'),JSON.stringify({projectId,gitSha:originalSha,runId:plan.runId,planHash:prepared.planHash,passed:false,reason:'original held refusal retained'}),{mode:0o600});
 const gitState={head:toolSha,status:'',raw:rawDiff('scripts/authorization-migration-cloud.mjs'),patch:'reviewed exact migration-tool patch',ancestor:true};
 const git=vi.fn(async args=>{
  if(args[0]==='rev-parse')return gitState.head+'\n';
  if(args[0]==='status')return gitState.status;
  if(args[0]==='merge-base'){if(!gitState.ancestor)throw Error('not descendant');return '';}
  if(args[0]==='diff')return args.includes('--raw')?gitState.raw:gitState.patch;
  throw Error('Unexpected Git operation: '+args.join(' '));
 });
 const loadAdapter=vi.fn(async()=>{throw Error('Unexpected provider loading');});
 const dependencies={repositoryRoot,nodeVersion:'24.22.0',env:{},git,loadAdapter,now:()=>now};
 return {temporary,options,plan,freeze,prepared,baseline,adapter,gitState,git,dependencies,...await loadMigrationRun(options)};
}
const flags=f=>['--project',f.plan.projectId,'--run-id',f.plan.runId];
const adoption=f=>['adopt-tool-source',...flags(f),'--confirm-project',f.plan.projectId,'--tool-sha',toolSha,'--review-reference','reviewed PR tool-only fix','--reason','continue frozen same-runtime Dev rehearsal'];
const invokeAdoption=f=>runMigrationCli(adoption(f),f.dependencies);

it('parses only the explicit strict-Dev adoption command and complete review fields',()=>{
 expect(parseMigrationArguments(['adopt-tool-source','--project','sodc-web','--run-id','reviewed-dev','--confirm-project','sodc-web','--tool-sha',toolSha,'--review-reference','review reference','--reason','same runtime fix'])).toMatchObject({command:'adopt-tool-source',flags:{project:'sodc-web','tool-sha':toolSha,'review-reference':'review reference',reason:'same runtime fix'}});
});
it.each([
 ['adopt-tool-source','--project','sodc-web','--run-id','reviewed-dev'],
 ['adopt-tool-source','--project','sodc-web','--run-id','reviewed-dev','--confirm-project','sodc-web-production','--tool-sha',toolSha,'--review-reference','review','--reason','reason'],
 ['adopt-tool-source','--project','sodc-web','--run-id','reviewed-dev','--confirm-project','sodc-web','--tool-sha',toolSha,'--review-reference','review','--reason','reason','--force'],
 ['adopt-tool-source','--project','sodc-web','--run-id','reviewed-dev','--confirm-project','sodc-web','--tool-sha',toolSha,'--tool-sha',toolSha,'--review-reference','review','--reason','reason'],
])('rejects incomplete, mismatched or ambiguous adoption flags: %j',args=>expect(()=>parseMigrationArguments(args)).toThrow());

it('adopts locally without a provider, preserving original release plan, journal and failed proof',async()=>{
 const f=await fixture(),preserved=['plan.json','journal.json','provider-freeze.json','provider-old-writer-inventory.json','provider-freeze-proof.json'];
 const before=await Promise.all(preserved.map(file=>readFile(path.join(f.directory,file))));
 const result=await invokeAdoption(f);
 expect(result).toMatchObject({projectId:'sodc-web',runId:f.plan.runId,cloudChanges:false});
 expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
 for(let i=0;i<preserved.length;i++)expect(await readFile(path.join(f.directory,preserved[i]))).toEqual(before[i]);
 const after=await loadMigrationRun(f.options);expect(after.plan).toEqual(f.plan);expect(after.planHash).toBe(f.planHash);expect(after.plan.phaseOperationIds.freeze).toContain(originalSha.slice(0,12));
 expect(f.git).toHaveBeenCalledWith(['merge-base','--is-ancestor',originalSha,toolSha],{cwd:f.options.repositoryRoot});
});

it('uses original release identity for audit, gate and ordinary native apply after adoption',async()=>{
 const f=await fixture();await invokeAdoption(f);
 const loadAdapter=vi.fn(async options=>{expect(options.plan.gitSha).toBe(originalSha);expect(migrationHash(options.plan)).toBe(f.planHash);expect(typeof options.sourceCheck).toBe('function');expect(await options.sourceCheck()).toMatchObject({originalPlanSha:originalSha,toolSha,amendmentHash:expect.stringMatching(/^[a-f0-9]{64}$/)});return f.adapter;});
 const dependencies={...f.dependencies,loadAdapter};
 const audit=await runMigrationCli(['audit',...flags(f)],dependencies);expect(audit.gitSha).toBe(originalSha);
 const gate={schemaVersion:'sodc-authorization-migration-gate/v1',gate:'acceptance',projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,reviewedBy:'operator',observedAt:now.toISOString(),evidence:'reviewed historical limitations',details:{sourceProjectId:'sodc-web',backendTestReference:'backend',browserReviewReference:'browser',notificationsReference:'notifications',schedulerVolumeReference:'volume',appCheckReference:'app check'}};
 const file=path.join(f.temporary,'gate.json');await writeFile(file,JSON.stringify(gate));
 await expect(runMigrationCli(['gate',...flags(f),'--name','acceptance','--evidence',file],dependencies)).resolves.toMatchObject({gate:'acceptance',cloudChanges:false});
 f.adapter.verify.mockImplementation(async phase=>({ok:true,evidence:{projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,observedAt:now.toISOString(),assertions:Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,true]))}}));
 await expect(runMigrationCli(['apply',...flags(f),'--phase','freeze','--confirm-project',f.plan.projectId],dependencies)).resolves.toMatchObject({phase:'freeze',status:'complete'});
 // Continued source verification must tolerate legitimate phase/journal progress.
 await expect(runMigrationCli(['audit',...flags(f)],dependencies)).resolves.toMatchObject({gitSha:originalSha});
 const after=await loadMigrationRun(f.options);expect(after.plan).toEqual(f.plan);expect(after.journal.checkpoints.freeze.operationId).toBe(f.plan.phaseOperationIds.freeze);expect(after.journal.checkpoints.freeze.status).toBe('complete');
 expect(loadAdapter).toHaveBeenCalledTimes(3);
});

it.each(['sodc-web-beta','sodc-web-production'])('refuses adoption for %s without loading a provider',async projectId=>{const f=await fixture({projectId});await expect(invokeAdoption(f)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('refuses adoption on legacy Dev before provider loading',async()=>{const f=await fixture({installation:'legacy'});await expect(invokeAdoption(f)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it.each(['functions/src/index.ts','functions/package-lock.json','firebase.json','dataconnect/api/mutations.gql','config/deployment-check.json','scripts/unrelated.mjs'])('refuses adoption when release/deployment source changes: %s',async filename=>{const f=await fixture();f.gitState.raw=rawDiff(filename);await expect(invokeAdoption(f)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('refuses dirty source before provider loading or adoption',async()=>{const f=await fixture();f.gitState.status='?? scripts/unreviewed-loader.mjs\n';await expect(invokeAdoption(f)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('refuses an unapproved source change on ordinary audit and apply without loading a provider',async()=>{
 const f=await fixture();await expect(runMigrationCli(['audit',...flags(f)],f.dependencies)).rejects.toThrow();await expect(runMigrationCli(['apply',...flags(f),'--phase','freeze','--confirm-project',f.plan.projectId],f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it('rejects dirty or different tool HEAD on audit, gate and apply after valid adoption',async()=>{
 const f=await fixture();await invokeAdoption(f);
 const file=path.join(f.temporary,'gate.json');await writeFile(file,'{}');
 const commands=[['audit',...flags(f)],['gate',...flags(f),'--name','acceptance','--evidence',file],['apply',...flags(f),'--phase','freeze','--confirm-project',f.plan.projectId]];
 for(const dirty of [true,false]){
  f.gitState.status=dirty?' M scripts/authorization-migration.mjs\n':'';f.gitState.head=dirty?toolSha:'e'.repeat(40);
  for(const command of commands)await expect(runMigrationCli(command,f.dependencies)).rejects.toThrow();
 }
 expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it('rejects a changed original-to-tool diff even when the tool HEAD is unchanged',async()=>{
 const f=await fixture();await invokeAdoption(f);f.gitState.patch='different unreviewed patch bytes';
 await expect(runMigrationCli(['audit',...flags(f)],f.dependencies)).rejects.toThrow();
 await expect(runMigrationCli(['apply',...flags(f),'--phase','freeze','--confirm-project',f.plan.projectId],f.dependencies)).rejects.toThrow();
 expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
