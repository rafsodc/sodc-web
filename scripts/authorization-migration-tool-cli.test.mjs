import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm, unlink} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {parseMigrationArguments, runMigrationCli} from './authorization-migration.mjs';
import {createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash, phasesFor, PHASE_ASSERTIONS, prepareMigrationRun, recordMigrationGate} from './authorization-migration-state.mjs';

const originalSha='a'.repeat(40), toolSha='b'.repeat(40);
const successorSha='e'.repeat(40);
const completionSha='f'.repeat(40);
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
  if(args[0]==='diff'){
   const target=args.filter(value=>/^[a-f0-9]{40}$/.test(value)).at(-1), diff=gitState.byTarget?.get(target)??gitState;
   return args.includes('--raw')?diff.raw:diff.patch;
  }
  throw Error('Unexpected Git operation: '+args.join(' '));
 });
 const loadAdapter=vi.fn(async()=>{throw Error('Unexpected provider loading');});
 const dependencies={repositoryRoot,nodeVersion:'24.22.0',env:{},git,loadAdapter,now:()=>now};
 return {temporary,options,plan,freeze,prepared,baseline,adapter,gitState,git,dependencies,...await loadMigrationRun(options)};
}
const flags=f=>['--project',f.plan.projectId,'--run-id',f.plan.runId];
const adoption=f=>['adopt-tool-source',...flags(f),'--confirm-project',f.plan.projectId,'--tool-sha',toolSha,'--review-reference','reviewed PR tool-only fix','--reason','continue frozen same-runtime Dev rehearsal'];
const invokeAdoption=f=>runMigrationCli(adoption(f),f.dependencies);
const successorAdoption=(f,previous=f.base.amendmentHash)=>[
 'adopt-tool-source',...flags(f),'--confirm-project',f.plan.projectId,'--tool-sha',successorSha,
 '--review-reference','reviewed provider quota compatibility fix','--reason','continue exact frozen Dev runtime',
 ...(previous===undefined?[]:['--previous-amendment',previous]),
];
const expectNoSuccessor=f=>expect(readFile(path.join(f.directory,'tool-source-amendment-'+f.base.amendmentHash+'.json')).then(()=>true)).rejects.toMatchObject({code:'ENOENT'});
async function frozenSuccessorFixture(){
 const f=await fixture();f.base=await invokeAdoption(f);
 f.gitState.byTarget=new Map([[toolSha,{raw:f.gitState.raw,patch:f.gitState.patch}]]);
 for(const[gate,details]of[
  ['old-writers',{method:'cloud-run-retirement',freezeStateHash:migrationHash(f.freeze),inventoryHash:migrationHash(f.freeze.oldWriterInventory),successorRevisions:[],externalOperationsReference:'independently reviewed positive provider retirement'}],
  ['sql-review',{diffSha256:'f'.repeat(64)}],
 ])await recordMigrationGate(f.options,{schemaVersion:'sodc-authorization-migration-gate/v1',projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,gate,reviewedBy:'operator',observedAt:now.toISOString(),evidence:'reviewed same-source provider evidence',details},now);
 f.adapter.perform.mockImplementation(async phase=>{
  if(phase==='freeze')return {stateHash:migrationHash(f.freeze)};
  const record={projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,phase,startedAt:now.toISOString(),completedAt:now.toISOString()};
  await writeFile(path.join(f.directory,'provider-phase-'+phase+'.json'),JSON.stringify(record),{mode:0o600});return record;
 });
 f.adapter.verify.mockImplementation(async phase=>({ok:true,evidence:{projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,observedAt:now.toISOString(),assertions:Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,phase!=='control-create']))}}));
 for(const phase of['freeze','schema'])await executeMigrationPhase(f.options,{phase,confirmProject:f.plan.projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now});
 await expect(executeMigrationPhase(f.options,{phase:'control-create',confirmProject:f.plan.projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now})).rejects.toMatchObject({code:'PHASE_NOT_VERIFIED'});
 f.gitState.head=successorSha;f.gitState.patch='reviewed cumulative quota fix plus original migration-tool fix';
 return f;
}
const completionAdoption=f=>['adopt-tool-source',...flags(f),'--confirm-project','sodc-web','--tool-sha',completionSha,'--previous-amendment',f.previous.amendmentHash,'--completed-open-verification','--review-reference','reviewed completed-open verifier fix','--reason','verify completed opening without replaying deployment'];
const completionFile=f=>path.join(f.directory,'tool-source-amendment-'+f.previous.amendmentHash+'.json');
const expectNoCompletion=f=>expect(readFile(completionFile(f))).rejects.toMatchObject({code:'ENOENT'});
async function completedOpenFixture(){
 const f=await frozenSuccessorFixture();f.previous=await runMigrationCli(successorAdoption(f),f.dependencies);
 f.gitState.byTarget.set(successorSha,{raw:f.gitState.raw,patch:f.gitState.patch});
 const acceptance={schemaVersion:'sodc-authorization-migration-gate/v1',gate:'acceptance',projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,reviewedBy:'operator',observedAt:now.toISOString(),evidence:'reviewed unchanged-runtime acceptance',details:{sourceProjectId:'sodc-web',backendTestReference:'backend',browserReviewReference:'browser',notificationsReference:'accepted notification exception',schedulerVolumeReference:'volume',appCheckReference:'app check limitations'}};
 await recordMigrationGate(f.options,acceptance,now);
 // Retain an earlier gate version too; completion must bind all files, not a fixed count.
 await recordMigrationGate(f.options,{...acceptance,evidence:'final reviewed acceptance with retained earlier gate'},now);
 const schedulerJobs=['recoverNotificationDeliveries','reconcilePendingSecurityTransitions'].map(name=>({functionName:name,job:{name:'projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-'+name+'-europe-west2',schedule:'every 5 minutes',timeZone:'UTC',attemptDeadline:'300s',retryConfig:{retryCount:0},httpTarget:{uri:'https://'+name+'.run.app',httpMethod:'POST',oidcToken:{serviceAccountEmail:'reviewed-scheduler@example.invalid',audience:'https://'+name+'.run.app'}}}}));
 const schedulerIntents=schedulerJobs.map(({job})=>({name:job.name,specHash:migrationHash({name:job.name,schedule:job.schedule,timeZone:job.timeZone,attemptDeadline:job.attemptDeadline,retryConfig:job.retryConfig,httpTarget:{uri:job.httpTarget.uri,httpMethod:'POST',oidcIdentity:{serviceAccountEmail:job.httpTarget.oidcToken.serviceAccountEmail,audience:job.httpTarget.oidcToken.audience}}})}));
 f.providerWrites=vi.fn();
 f.adapter.perform.mockImplementation(async phase=>{
  const file=path.join(f.directory,'provider-phase-'+phase+'.json');
  try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const result={projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,phase,startedAt:now.toISOString(),completedAt:now.toISOString(),...(phase==='open'?{openingStarted:true,apiOpening:true}:{}),...(phase==='functions'?{schedulerIntents,functionProofs:schedulerJobs.map(({functionName,job})=>({name:functionName,uri:job.httpTarget.uri,serviceAccountEmail:job.httpTarget.oidcToken.serviceAccountEmail}))}:{})};
  f.providerWrites(phase);await writeFile(file,JSON.stringify(result),{mode:0o600});return result;
 });
 f.adapter.verify.mockImplementation(async phase=>({ok:true,evidence:{projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,observedAt:now.toISOString(),assertions:Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,!(phase==='open'&&flag==='invokersRestored')]))}}));
 for(const phase of['control-create','backfill','functions','activate','strict-api'])await executeMigrationPhase(f.options,{phase,confirmProject:f.plan.projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now});
 await expect(executeMigrationPhase(f.options,{phase:'open',confirmProject:f.plan.projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now})).rejects.toMatchObject({code:'PHASE_NOT_VERIFIED'});
 for(const {job}of schedulerJobs){
  await writeFile(path.join(f.directory,'scheduler-'+job.name.split('/').at(-1)+'.json'),JSON.stringify({projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,job}),{mode:0o600});
 }
 f.gitState.head=completionSha;f.gitState.patch='reviewed cumulative tool change plus narrow completed-open verification correction';
 return f;
}

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

it('parses a bounded successor adoption with an explicit previous amendment hash',()=>{
 const args=adoption({plan:{projectId:'sodc-web',runId:'reviewed-dev'}}).concat('--previous-amendment','1'.repeat(64));
 expect(parseMigrationArguments(args).flags['previous-amendment']).toBe('1'.repeat(64));
 for(const previous of['invalid','1'.repeat(63),'G'.repeat(64)])expect(()=>parseMigrationArguments([...args.slice(0,-1),previous])).toThrow();
});

it('appends reviewed tool source after schema and failed control verification without rewriting original plan, base amendment or history',async()=>{
 const f=await frozenSuccessorFixture(), baseFile=path.join(f.directory,'tool-source-amendment.json');
 const base=JSON.parse(await readFile(baseFile,'utf8'));
 const preserved=['plan.json','journal.json','provider-freeze.json','provider-old-writer-inventory.json','provider-phase-schema.json','provider-phase-control-create.json','tool-source-amendment.json',...base.amendment.history.map(row=>row.archive)];
 const before=await Promise.all(preserved.map(file=>readFile(path.join(f.directory,file))));
 const result=await runMigrationCli(successorAdoption(f),f.dependencies);
 expect(result).toMatchObject({projectId:'sodc-web',runId:f.plan.runId,originalPlanSha:originalSha,toolSha:successorSha,cloudChanges:false});
 expect(result.amendmentHash).not.toBe(f.base.amendmentHash);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
 for(let i=0;i<preserved.length;i++)expect(await readFile(path.join(f.directory,preserved[i]))).toEqual(before[i]);
 const child=JSON.parse(await readFile(path.join(f.directory,'tool-source-amendment-'+f.base.amendmentHash+'.json'),'utf8'));
 expect(child.amendmentHash).toBe(result.amendmentHash);
 const after=await loadMigrationRun(f.options);expect(after.planHash).toBe(f.planHash);expect(after.plan.gitSha).toBe(originalSha);
 expect(after.journal.checkpoints.freeze.status).toBe('complete');expect(after.journal.checkpoints.schema.status).toBe('complete');expect(after.journal.checkpoints['control-create'].status).toBe('incomplete');
 expect(after.journal.checkpoints['control-create'].result.completedAt).toBe(now.toISOString());
});

it('ordinary source verification uses only the final reviewed tool and retains original runtime identity after successor adoption',async()=>{
 const f=await frozenSuccessorFixture(), successor=await runMigrationCli(successorAdoption(f),f.dependencies);
 const loadAdapter=vi.fn(async options=>{expect(options.plan.gitSha).toBe(originalSha);expect(await options.sourceCheck()).toMatchObject({originalPlanSha:originalSha,toolSha:successorSha,amendmentHash:successor.amendmentHash});return f.adapter;});
 await expect(runMigrationCli(['audit',...flags(f)],{...f.dependencies,loadAdapter})).resolves.toMatchObject({gitSha:originalSha});
 for(const head of[toolSha,originalSha,'f'.repeat(40)]){f.gitState.head=head;await expect(runMigrationCli(['audit',...flags(f)],f.dependencies)).rejects.toThrow();}
 f.gitState.head=successorSha;f.gitState.patch='unreviewed amended tool diff';
 await expect(runMigrationCli(['apply',...flags(f),'--phase','control-create','--confirm-project','sodc-web'],f.dependencies)).rejects.toThrow();
 expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it.each([['missing',undefined],['stale','0'.repeat(64)]])('refuses %s previous-amendment binding before any provider loading',async(_name,previous)=>{
 const f=await frozenSuccessorFixture(), baseBytes=await readFile(path.join(f.directory,'tool-source-amendment.json'));
 const args=successorAdoption(f);if(previous===undefined)args.splice(-2);else args[args.length-1]=previous;
 await expect(runMigrationCli(args,f.dependencies)).rejects.toMatchObject({code:previous===undefined?'TOOL_SOURCE_PREVIOUS_REQUIRED':'TOOL_SOURCE_PREVIOUS_MISMATCH'});
 expect(await readFile(path.join(f.directory,'tool-source-amendment.json'))).toEqual(baseBytes);await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it.each(['sodc-web-beta','sodc-web-production'])('never allows successor adoption for %s',async project=>{
 const f=await frozenSuccessorFixture(),args=successorAdoption(f);
 args[args.indexOf('--project')+1]=project;args[args.indexOf('--confirm-project')+1]=project;
 await expect(runMigrationCli(args,f.dependencies)).rejects.toMatchObject({code:'TOOL_SOURCE_STRICT_DEV_ONLY'});expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it.each(['open','receipt','terminal'])('refuses successor adoption after an %s boundary',async boundary=>{
 const f=await frozenSuccessorFixture(),run=await loadMigrationRun(f.options);
 if(boundary==='terminal')run.journal.terminal={status:'COMPLETE'};
 else run.journal.checkpoints[boundary]={status:'incomplete',operationId:run.plan.phaseOperationIds[boundary],attempt:1,startedAt:now.toISOString()};
 await writeFile(path.join(f.directory,'journal.json'),JSON.stringify(run.journal));
 await expect(runMigrationCli(successorAdoption(f),f.dependencies)).rejects.toThrow();await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it('refuses a runtime application change while appending a reviewed tool successor',async()=>{
 const f=await frozenSuccessorFixture();f.gitState.raw=rawDiff('functions/src/index.ts');
 await expect(runMigrationCli(successorAdoption(f),f.dependencies)).rejects.toMatchObject({code:'TOOL_APPLICATION_SOURCE_CHANGED'});await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it('refuses a same-revision successor without publishing a poisoned immutable child',async()=>{
 const f=await frozenSuccessorFixture(),args=successorAdoption(f);f.gitState.head=toolSha;
 args[args.indexOf('--tool-sha')+1]=toolSha;
 await expect(runMigrationCli(args,f.dependencies)).rejects.toThrow();await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it('refuses completed checkpoint result drift before appending a successor',async()=>{
 const f=await frozenSuccessorFixture(),run=await loadMigrationRun(f.options);
 run.journal.checkpoints.schema.result={unreviewedResult:true};await writeFile(path.join(f.directory,'journal.json'),JSON.stringify(run.journal));
 await expect(runMigrationCli(successorAdoption(f),f.dependencies)).rejects.toThrow();await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it('refuses an unexplained later provider operation beyond the current failed phase',async()=>{
 const f=await frozenSuccessorFixture();
 await writeFile(path.join(f.directory,'provider-phase-functions.json'),JSON.stringify({projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,phase:'functions',startedAt:now.toISOString(),completedAt:now.toISOString()}),{mode:0o600});
 await expect(runMigrationCli(successorAdoption(f),f.dependencies)).rejects.toThrow();await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it.each(['project','run'])('does not replace or remove an existing %s migration lock during successor adoption',async scope=>{
 const f=await frozenSuccessorFixture(),file=path.join(scope==='project'?path.dirname(f.directory):f.directory,scope==='project'?'.migration.lock':'.phase.lock');
 const bytes=JSON.stringify({pid:123,nonce:'other-owner',purpose:'native control verification'});await writeFile(file,bytes,{mode:0o600});
 await expect(runMigrationCli(successorAdoption(f),f.dependencies)).rejects.toMatchObject({code:'TOOL_SOURCE_LOCKED'});
 expect(await readFile(file,'utf8')).toBe(bytes);await expectNoSuccessor(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});

it('parses completed-open verification as an explicit adoption-only boolean',()=>{
 const args=[...adoption({plan:{projectId:'sodc-web',runId:'reviewed-dev'}}),'--previous-amendment','1'.repeat(64),'--completed-open-verification'];
 expect(parseMigrationArguments(args).flags['completed-open-verification']).toBe(true);
 expect(()=>parseMigrationArguments([...args,'true'])).toThrow();
 expect(()=>parseMigrationArguments([...args,'--completed-open-verification'])).toThrow();
 expect(()=>parseMigrationArguments(['apply','--project','sodc-web','--run-id','reviewed-dev','--phase','open','--confirm-project','sodc-web','--completed-open-verification'])).toThrow();
});
it('locally adopts the completed-open verifier while preserving both predecessors and every completed opening/gate/scheduler byte',async()=>{
 const f=await completedOpenFixture(),beforeRun=await loadMigrationRun(f.options),base=JSON.parse(await readFile(path.join(f.directory,'tool-source-amendment.json'),'utf8'));
 const gateFiles=Object.values(beforeRun.journal.gates).map(row=>row.file),preserved=['plan.json','journal.json','provider-freeze.json','provider-old-writer-inventory.json','tool-source-amendment.json','tool-source-amendment-'+f.base.amendmentHash+'.json','provider-phase-open.json',...gateFiles,...base.amendment.history.map(row=>row.archive)];
 const before=await Promise.all(preserved.map(name=>readFile(path.join(f.directory,name)))),writes=f.providerWrites.mock.calls.length;
 const result=await runMigrationCli(completionAdoption(f),f.dependencies);
 expect(result).toMatchObject({originalPlanSha:originalSha,toolSha:completionSha,cloudChanges:false});expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();expect(f.providerWrites).toHaveBeenCalledTimes(writes);
 for(let i=0;i<preserved.length;i++)expect(await readFile(path.join(f.directory,preserved[i]))).toEqual(before[i]);
 const record=JSON.parse(await readFile(completionFile(f),'utf8'));
 expect(record.amendment).toMatchObject({schemaVersion:'sodc-authorization-tool-source-amendment/v3',completionKind:'completed-open-verifier',previousAmendmentHash:f.previous.amendmentHash,interruptedPhase:'open'});
 expect(record.amendment.completionBindings.files.filter(row=>row.name.startsWith('gates/'))).toHaveLength(6);
 expect(record.amendment.completionBindings.files.filter(row=>row.name.startsWith('scheduler-'))).toHaveLength(2);
 expect((await loadMigrationRun(f.options)).journal.checkpoints.open).toEqual(beforeRun.journal.checkpoints.open);
 await expect(runMigrationCli(completionAdoption(f),f.dependencies)).resolves.toMatchObject({amendmentHash:result.amendmentHash});
});
it('requires the explicit completion flag and completed provider result instead of broadening ordinary adoption',async()=>{
 const f=await completedOpenFixture(),args=completionAdoption(f);args.splice(args.indexOf('--completed-open-verification'),1);
 await expect(runMigrationCli(args,f.dependencies)).rejects.toMatchObject({code:'TOOL_SOURCE_OPEN_ATTEMPTED'});await expectNoCompletion(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it('refuses a completed-open flag on the first adoption without publishing a base amendment',async()=>{
 const f=await fixture();await expect(runMigrationCli([...adoption(f),'--completed-open-verification'],f.dependencies)).rejects.toMatchObject({code:'TOOL_SOURCE_COMPLETION_PREDECESSOR_REQUIRED'});
 await expect(readFile(path.join(f.directory,'tool-source-amendment.json'))).rejects.toMatchObject({code:'ENOENT'});expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it('resumes completed opening without another provider write and permits legitimate open/receipt journal progress',async()=>{
 const f=await completedOpenFixture(),adopted=await runMigrationCli(completionAdoption(f),f.dependencies),writes=f.providerWrites.mock.calls.length;
 f.adapter.verify.mockImplementation(async phase=>({ok:true,evidence:{projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,observedAt:now.toISOString(),assertions:Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,true]))}}));
 const loadAdapter=vi.fn(async options=>{expect(options.plan.gitSha).toBe(originalSha);expect(await options.sourceCheck()).toEqual({originalPlanSha:originalSha,toolSha:completionSha,amendmentHash:adopted.amendmentHash});return f.adapter;});
 await expect(runMigrationCli(['apply',...flags(f),'--phase','open','--confirm-project','sodc-web'],{...f.dependencies,loadAdapter})).resolves.toMatchObject({phase:'open',status:'complete'});
 expect(f.providerWrites).toHaveBeenCalledTimes(writes);
 await expect(runMigrationCli(['audit',...flags(f)],{...f.dependencies,loadAdapter})).resolves.toMatchObject({gitSha:originalSha});
 await expect(runMigrationCli(['apply',...flags(f),'--phase','receipt','--confirm-project','sodc-web'],{...f.dependencies,loadAdapter})).resolves.toMatchObject({phase:'receipt',status:'complete'});
 await expect(runMigrationCli(['audit',...flags(f)],{...f.dependencies,loadAdapter})).resolves.toMatchObject({gitSha:originalSha});
 const receipt=JSON.parse(await readFile(path.join(f.options.repositoryRoot,'.firebase/authorization-migration/sodc-web.json'),'utf8'));
 expect(receipt).toMatchObject({gitSha:originalSha,migrationRunId:f.plan.runId,migrationPlanHash:f.planHash});
});
it.each(['root-receipt','receipt-checkpoint','receipt-provider','unfinished-open','different-result','different-error','prior-result','baseline','gate-file','scheduler-identity','missing-scheduler','raw-oidc-credential','header-credential','foreign-open','dirty-head','old-head','runtime-diff','added-tool-file'])('refuses invalid completed-open continuation: %s',async kind=>{
 const f=await completedOpenFixture(),run=await loadMigrationRun(f.options),providerFile=path.join(f.directory,'provider-phase-open.json'),provider=JSON.parse(await readFile(providerFile,'utf8'));
 if(kind==='root-receipt')await writeFile(path.join(f.options.repositoryRoot,'.firebase/authorization-migration/sodc-web.json'),'{}',{mode:0o600});
 if(kind==='receipt-checkpoint')run.journal.checkpoints.receipt={status:'incomplete'};
 if(kind==='receipt-provider')await writeFile(path.join(f.directory,'provider-phase-receipt.json'),'{}',{mode:0o600});
 if(kind==='unfinished-open'){provider.completedAt=null;run.journal.checkpoints.open.result=provider;await writeFile(providerFile,JSON.stringify(provider));}
 if(kind==='different-result')run.journal.checkpoints.open.result={...provider,unreviewed:true};
 if(kind==='different-error')run.journal.checkpoints.open.lastError='PROVIDER_OPERATION_FAILED';
 if(kind==='prior-result')run.journal.checkpoints['strict-api'].result={changed:true};
 if(kind==='baseline')run.journal.baseline={...run.journal.baseline,changed:true};
 if(kind==='gate-file'){const entry=run.journal.gates.acceptance,file=path.join(f.directory,entry.file),value=JSON.parse(await readFile(file,'utf8'));value.details.browserReviewReference='unreviewed';await writeFile(file,JSON.stringify(value));}
 if(kind==='scheduler-identity'){const file=path.join(f.directory,'scheduler-firebase-schedule-reconcilePendingSecurityTransitions-europe-west2.json'),value=JSON.parse(await readFile(file,'utf8'));value.planHash='0'.repeat(64);await writeFile(file,JSON.stringify(value));}
 if(kind==='missing-scheduler')await unlink(path.join(f.directory,'scheduler-firebase-schedule-reconcilePendingSecurityTransitions-europe-west2.json'));
 if(['raw-oidc-credential','header-credential'].includes(kind)){const file=path.join(f.directory,'scheduler-firebase-schedule-recoverNotificationDeliveries-europe-west2.json'),value=JSON.parse(await readFile(file,'utf8'));if(kind==='raw-oidc-credential')value.job.httpTarget.oidcToken.accessToken='must-never-be-archived';else value.job.httpTarget.headers={Authorization:'Bearer '+'A'.repeat(40)};await writeFile(file,JSON.stringify(value));}
 if(kind==='foreign-open'){provider.projectId='sodc-web-production';run.journal.checkpoints.open.result=provider;await writeFile(providerFile,JSON.stringify(provider));}
 if(kind==='dirty-head')f.gitState.status=' M scripts/authorization-migration-cloud.mjs';
 if(kind==='old-head')f.gitState.head=successorSha;
 if(kind==='runtime-diff')f.gitState.raw=rawDiff('functions/src/index.ts');
 if(kind==='added-tool-file')f.gitState.raw=`:000000 100644 ${'0'.repeat(40)} ${'d'.repeat(40)} A\0scripts/authorization-migration-extra.mjs\0`;
 await writeFile(path.join(f.directory,'journal.json'),JSON.stringify(run.journal));
 await expect(runMigrationCli(completionAdoption(f),f.dependencies)).rejects.toThrow();await expectNoCompletion(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it.each(['gate-entries','scheduler-bytes','provider-bytes','prior-checkpoint'])('blocks provider loading after completed-open binding drift: %s',async kind=>{
 const f=await completedOpenFixture();await runMigrationCli(completionAdoption(f),f.dependencies);const run=await loadMigrationRun(f.options);
 if(kind==='gate-entries')run.journal.gates.acceptance.hash='0'.repeat(64);
 if(kind==='prior-checkpoint')run.journal.checkpoints['strict-api'].attempt++;
 if(kind==='scheduler-bytes'){const file=path.join(f.directory,'scheduler-firebase-schedule-recoverNotificationDeliveries-europe-west2.json'),row=JSON.parse(await readFile(file,'utf8'));row.observedAt=now.toISOString();await writeFile(file,JSON.stringify(row));}
 if(kind==='provider-bytes'){const file=path.join(f.directory,'provider-phase-open.json'),row=JSON.parse(await readFile(file,'utf8'));row.completedAt='2026-10-25T11:59:59.999Z';await writeFile(file,JSON.stringify(row));}
 await writeFile(path.join(f.directory,'journal.json'),JSON.stringify(run.journal));
 await expect(runMigrationCli(['audit',...flags(f)],f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it.each(['sodc-web-beta','sodc-web-production'])('never accepts the completed-open flag for %s',async project=>{
 const f=await completedOpenFixture(),args=completionAdoption(f);args[args.indexOf('--project')+1]=project;args[args.indexOf('--confirm-project')+1]=project;
 await expect(runMigrationCli(args,f.dependencies)).rejects.toMatchObject({code:'TOOL_SOURCE_STRICT_DEV_ONLY'});await expectNoCompletion(f);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});


// Synthetic legacy Production recovery boundary. No live journal, provider or credential reads.
const productionRecoveryAdoption=f=>['adopt-tool-source',...flags(f),'--confirm-project',f.plan.projectId,'--tool-sha',toolSha,'--production-pre-api-open-recovery','--review-reference','explicit human approval of reviewed pre-API-open scheduler recovery PR','--reason','resume exact failed Production opening; reviewed bounded repeat of the two deferred Functions'];
async function productionPreApiOpenFixture({projectId='sodc-web-production',installation='legacy'}={}){
 const f=await fixture({projectId,installation});
 for(const[gate,details]of[
  ['old-writers',{method:'cloud-run-retirement',freezeStateHash:migrationHash(f.freeze),inventoryHash:migrationHash(f.freeze.oldWriterInventory),successorRevisions:[],externalOperationsReference:'reviewed actual old and maintenance writer retirement'}],
  ['sql-review',{diffSha256:'f'.repeat(64)}],
  ['acceptance',{sourceProjectId:projectId==='sodc-web-production'?'sodc-web':projectId,backendTestReference:'same-runtime backend',browserReviewReference:'same-runtime browser limitations',notificationsReference:'reviewed notifications',schedulerVolumeReference:'reviewed volume',appCheckReference:'reviewed attestation'}],
 ])await recordMigrationGate(f.options,{schemaVersion:'sodc-authorization-migration-gate/v1',projectId,gitSha:originalSha,runId:f.plan.runId,gate,reviewedBy:'operator',observedAt:now.toISOString(),evidence:'reviewed original Production scope',details},now);
 const account='reviewed-scheduler@example.invalid';
 f.schedulerJobs=['recoverNotificationDeliveries','reconcilePendingSecurityTransitions'].map(functionName=>({functionName,job:{name:'projects/'+projectId+'/locations/europe-west2/jobs/firebase-schedule-'+functionName+'-europe-west2',schedule:'every 5 minutes',timeZone:'UTC',attemptDeadline:'300s',retryConfig:{retryCount:0},httpTarget:{uri:functionName==='reconcilePendingSecurityTransitions'?'https://europe-west2-'+projectId+'.cloudfunctions.net/'+functionName:'https://recovernotificationdeliveries-fixture-nw.a.run.app',httpMethod:'POST',oidcToken:{serviceAccountEmail:account}}}}));
 const intent=job=>({name:job.name,specHash:migrationHash({name:job.name,schedule:job.schedule,timeZone:job.timeZone,attemptDeadline:job.attemptDeadline,retryConfig:job.retryConfig,httpTarget:{uri:job.httpTarget.uri,httpMethod:'POST',oidcIdentity:{serviceAccountEmail:account}}})});
 f.deferredProofs=['getMyAuthorizationStatus','reconcilePendingSecurityTransitions'].map(name=>({name,uri:'https://'+name.toLowerCase()+'-fixture-nw.a.run.app',url:'https://europe-west2-'+projectId+'.cloudfunctions.net/'+name,serviceAccountEmail:account}));
 f.adapter.perform.mockImplementation(async phase=>{
  if(phase==='freeze')return {stateHash:migrationHash(f.freeze)};
  const result={projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,phase,startedAt:now.toISOString(),completedAt:phase==='open'?null:now.toISOString(),...(phase==='functions'?{selected:['recoverNotificationDeliveries'],functionProofs:[{name:'recoverNotificationDeliveries',uri:f.schedulerJobs[0].job.httpTarget.uri,serviceAccountEmail:account}],schedulerIntents:[intent(f.schedulerJobs[0].job)]}:{}),...(phase==='open'?{openingStarted:true}:{})};
  await writeFile(path.join(f.directory,'provider-phase-'+phase+'.json'),JSON.stringify(result),{mode:0o600});
  if(phase==='open')throw Object.assign(Error('provider Scheduler target refused before API opening'),{code:'SCHEDULER_TARGET_NOT_VERIFIED'});
  return result;
 });
 f.adapter.verify.mockImplementation(async phase=>({ok:true,evidence:{projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,observedAt:now.toISOString(),assertions:Object.fromEntries(PHASE_ASSERTIONS[phase].map(flag=>[flag,true]))}}));
 for(const phase of phasesFor(f.plan).slice(1,phasesFor(f.plan).indexOf('open')))await executeMigrationPhase(f.options,{phase,confirmProject:projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now});
 for(const {job}of f.schedulerJobs)await writeFile(path.join(f.directory,'scheduler-'+job.name.split('/').at(-1)+'.json'),JSON.stringify({projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,job}),{mode:0o600});
 await expect(executeMigrationPhase(f.options,{phase:'open',confirmProject:projectId,adapter:f.adapter,sourceCheck:async()=>{},now:()=>now})).rejects.toMatchObject({code:'SCHEDULER_TARGET_NOT_VERIFIED'});
 const run=await loadMigrationRun(f.options);expect(run.journal.checkpoints.open.result).toBeUndefined();return f;
}
async function mutateProductionRecovery(f,work){const run=await loadMigrationRun(f.options);await work(run);await writeFile(path.join(f.directory,'journal.json'),JSON.stringify(run.journal));}

it('parses only explicit literal-Production pre-API-open recovery and forwards the named boolean',()=>{
 const args=productionRecoveryAdoption({plan:{projectId:'sodc-web-production',runId:'reviewed-production'}});
 expect(parseMigrationArguments(args)).toMatchObject({command:'adopt-tool-source',flags:{project:'sodc-web-production','production-pre-api-open-recovery':true}});
 for(const extra of [['--completed-open-verification'],['--previous-amendment','1'.repeat(64)]])expect(()=>parseMigrationArguments([...args,...extra])).toThrow();
 const dev=[...args];dev[dev.indexOf('--project')+1]='sodc-web';dev[dev.indexOf('--confirm-project')+1]='sodc-web';expect(()=>parseMigrationArguments(dev)).toThrow();
});
it('publishes only the v4 Production recovery amendment; original failed attempt and all completed legacy evidence remain untouched',async()=>{
 const f=await productionPreApiOpenFixture(),before=await loadMigrationRun(f.options);
 const names=['plan.json','journal.json','provider-phase-open.json','provider-freeze.json','provider-old-writer-inventory.json',...Object.values(before.journal.checkpoints).flatMap(cp=>cp.evidenceFile?[cp.evidenceFile]:[]),...f.schedulerJobs.map(({job})=>'scheduler-'+job.name.split('/').at(-1)+'.json'),...Object.values(before.journal.gates).map(g=>g.file)];
 const bytes=await Promise.all(names.map(name=>readFile(path.join(f.directory,name))));
 const result=await runMigrationCli(productionRecoveryAdoption(f),f.dependencies);
 expect(result).toMatchObject({projectId:'sodc-web-production',originalPlanSha:originalSha,toolSha,cloudChanges:false});expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
 for(let i=0;i<names.length;i++)expect(await readFile(path.join(f.directory,names[i]))).toEqual(bytes[i]);
 const amendment=JSON.parse(await readFile(path.join(f.directory,'tool-source-amendment.json'),'utf8'));
 expect(amendment.amendment.schemaVersion).toBe('sodc-authorization-tool-source-amendment/v4');
 const after=await loadMigrationRun(f.options);expect(after.planHash).toBe(f.planHash);expect(after.plan.gitSha).toBe(originalSha);expect(after.journal.checkpoints.compatibility.status).toBe('complete');expect(after.journal.checkpoints.open).toEqual(before.journal.checkpoints.open);
});
it('valid Production recovery retries are idempotent and never load a provider',async()=>{const f=await productionPreApiOpenFixture(),a=await runMigrationCli(productionRecoveryAdoption(f),f.dependencies),file=path.join(f.directory,'tool-source-amendment.json'),bytes=await readFile(file);expect(await runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).toMatchObject({amendmentHash:a.amendmentHash});expect(await readFile(file)).toEqual(bytes);expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('keeps original release identity through audited opening and receipt progress after v4 recovery',async()=>{
 const f=await productionPreApiOpenFixture();await runMigrationCli(productionRecoveryAdoption(f),f.dependencies);const oldBytes=await readFile(path.join(f.directory,'provider-phase-open.json'));
 const loadAdapter=vi.fn(async options=>{expect(options.plan.gitSha).toBe(originalSha);expect(migrationHash(options.plan)).toBe(f.planHash);expect(await options.sourceCheck()).toMatchObject({originalPlanSha:originalSha,toolSha});return f.adapter;});const deps={...f.dependencies,loadAdapter};
 await expect(runMigrationCli(['audit',...flags(f)],deps)).resolves.toMatchObject({gitSha:originalSha});
 f.adapter.perform.mockImplementation(async phase=>{const result=phase==='open'?{...JSON.parse(oldBytes),deferredProofs:f.deferredProofs,deferredSchedulerIntents:[{name:f.schedulerJobs[1].job.name,specHash:migrationHash({name:f.schedulerJobs[1].job.name,schedule:'every 5 minutes',timeZone:'UTC',attemptDeadline:'300s',retryConfig:{retryCount:0},httpTarget:{uri:f.schedulerJobs[1].job.httpTarget.uri,httpMethod:'POST',oidcIdentity:f.schedulerJobs[1].job.httpTarget.oidcToken}})}],apiOpening:true,completedAt:now.toISOString()}:{projectId:f.plan.projectId,gitSha:originalSha,runId:f.plan.runId,planHash:f.planHash,phase,startedAt:now.toISOString(),completedAt:now.toISOString()};await writeFile(path.join(f.directory,'provider-phase-'+phase+'.json'),JSON.stringify(result),{mode:0o600});return result;});
 await expect(runMigrationCli(['apply',...flags(f),'--phase','open','--confirm-project',f.plan.projectId],deps)).resolves.toMatchObject({gitSha:originalSha,phase:'open',status:'complete'});
 await expect(runMigrationCli(['audit',...flags(f)],deps)).resolves.toMatchObject({gitSha:originalSha});
 await expect(runMigrationCli(['apply',...flags(f),'--phase','receipt','--confirm-project',f.plan.projectId],deps)).resolves.toMatchObject({gitSha:originalSha,phase:'receipt',status:'complete'});
 const receipt=JSON.parse(await readFile(path.join(f.options.repositoryRoot,'.firebase/authorization-migration/sodc-web-production.json'),'utf8'));expect(receipt.gitSha).toBe(originalSha);expect(receipt.migrationPlanHash).toBe(f.planHash);
 const ownerFile=path.join(path.dirname(f.directory),'active-run.json'),ownerBefore=await readFile(ownerFile);expect(JSON.parse(ownerBefore).status).toBe('complete');
 await expect(runMigrationCli(['audit',...flags(f)],deps)).resolves.toMatchObject({gitSha:originalSha});
 expect(await readFile(ownerFile)).toEqual(ownerBefore);
 expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it.each(['wrong error','API opening','completed provider open','missing opening marker','wrong operation','extra receipt checkpoint','terminal','abort'])('refuses Production recovery boundary drift: %s',async kind=>{
 const f=await productionPreApiOpenFixture();
 if(['API opening','completed provider open','missing opening marker'].includes(kind)){const file=path.join(f.directory,'provider-phase-open.json'),record=JSON.parse(await readFile(file,'utf8'));if(kind==='API opening')record.apiOpening=true;else if(kind==='completed provider open')record.completedAt=now.toISOString();else delete record.openingStarted;await writeFile(file,JSON.stringify(record));}
 else await mutateProductionRecovery(f,async run=>{if(kind==='wrong error')run.journal.checkpoints.open.lastError='PHASE_NOT_VERIFIED';else if(kind==='wrong operation')run.journal.checkpoints.open.operationId='other';else if(kind==='extra receipt checkpoint')run.journal.checkpoints.receipt={status:'incomplete'};else if(kind==='terminal')run.journal.terminal={status:'COMPLETE'};else run.journal.abortFreeze={status:'incomplete'};});
 await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
it.each(['sodc-web','sodc-web-beta'])('never enables the Production recovery flag for %s',async projectId=>{const f=await productionPreApiOpenFixture({projectId});await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('refuses strict Production recovery; this exception is the reviewed legacy cutover only',async()=>{const f=await productionPreApiOpenFixture({installation:'strict'});await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it.each(['functions/src/index.ts','dataconnect/api/queries.gql','firebase.json','scripts/unrelated.mjs'])('rejects Production recovery app/runtime/unrelated diffs before provider loading: %s',async filename=>{const f=await productionPreApiOpenFixture();f.gitState.raw=rawDiff(filename);await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it('rejects dirty Production tool source before provider loading',async()=>{const f=await productionPreApiOpenFixture();f.gitState.status='?? scripts/unreviewed.mjs\n';await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it.each(['project','run'])('Production recovery respects the existing %s lock',async kind=>{const f=await productionPreApiOpenFixture(),file=path.join(kind==='project'?path.dirname(f.directory):f.directory,kind==='project'?'.migration.lock':'.phase.lock');await writeFile(file,'{"owner":"other"}',{mode:0o600});await expect(runMigrationCli(productionRecoveryAdoption(f),f.dependencies)).rejects.toThrow();expect(await readFile(file,'utf8')).toBe('{"owner":"other"}');expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();});
it.each(['gate','scheduler','prior checkpoint','initial provider open'])('pins unchanged Production recovery history on ordinary audit: %s',async kind=>{
 const f=await productionPreApiOpenFixture();await runMigrationCli(productionRecoveryAdoption(f),f.dependencies);
 if(kind==='gate'){const run=await loadMigrationRun(f.options);await writeFile(path.join(f.directory,run.journal.gates.acceptance.file),'{}');}
 else if(kind==='scheduler')await writeFile(path.join(f.directory,'scheduler-'+f.schedulerJobs[1].job.name.split('/').at(-1)+'.json'),'{}');
 else if(kind==='prior checkpoint')await mutateProductionRecovery(f,async run=>{run.journal.checkpoints.backfill.attempt++;});
 else{const file=path.join(f.directory,'provider-phase-open.json'),record=JSON.parse(await readFile(file,'utf8'));record.startedAt='2026-10-25T11:59:00Z';await writeFile(file,JSON.stringify(record));}
 await expect(runMigrationCli(['audit',...flags(f)],f.dependencies)).rejects.toThrow();expect(f.dependencies.loadAdapter).not.toHaveBeenCalled();
});
