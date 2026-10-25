import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {parseMigrationArguments, runMigrationCli} from './authorization-migration.mjs';
import {createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash, PHASE_ASSERTIONS, prepareMigrationRun, recordMigrationGate} from './authorization-migration-state.mjs';

const originalSha='a'.repeat(40), toolSha='b'.repeat(40);
const successorSha='e'.repeat(40);
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
