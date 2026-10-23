import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {stableHash} from './authorization-migration-sources.mjs';
import {assertReconciliationVolumeEnvironment,createReconciliationVolumeCloud} from './reconciliation-volume-cloud.mjs';

const RUN='11111111-1111-4111-8111-111111111111';
const JOB='projects/sodc-web/locations/europe-west2/jobs/firebase-schedule-reconcilePendingSecurityTransitions-europe-west2';
const FUNCTION='projects/sodc-web/locations/europe-west2/functions/reconcilePendingSecurityTransitions';
const ROOT=path.resolve(import.meta.dirname,'..');
const directories=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(directory=>rm(directory,{recursive:true,force:true})));});

async function fixture({mode='SIMULATION',canonicalTarget=false,defaultDrain=false}={}){
  const directory=await mkdtemp(path.join(tmpdir(),'sodc-volume-provider-'));directories.push(directory);
  let now=new Date('2026-10-23T09:00:00Z');
  const draft={schemaVersion:'sodc-reconciliation-volume/v1',projectId:'sodc-web',runId:RUN,fixturePrefix:`rcv-${RUN}-`,gitSha:'a'.repeat(40),createdAt:now.toISOString(),expiresAt:new Date(+now+172800000).toISOString(),
    targets:{baseline:2000,stress:10000},fixtures:Array.from({length:3},(_,index)=>({uid:`rcv-${RUN}-${String(index).padStart(5,'0')}`,operationId:`rcv-init:${RUN}:${index}`,marker:`rcv:${RUN}`}))};
  const identities=new Map(),profiles=new Map(),states=new Map(),transitions=new Map(),rates=[],invocations=[];
  for(let index=0;index<2;index++){
    const id=`real-${index}`,email=`real-${index}@example.invalid`;
    identities.set(id,{uid:id,email,emailVerified:true,disabled:false,customClaims:{enabled:true,admin:true,securityVersion:1}});
    profiles.set(id,{id,email,membershipStatus:'REGULAR'});
    states.set(id,{userId:id,securityVersion:1,membershipStatus:'REGULAR',desiredEnabled:true,desiredAdmin:true,verificationEmail:null,accessReady:true,adminReady:true,operationId:`real-op-${index}`,syncStatus:'READY',user:{membershipStatus:'REGULAR',email}});
  }
  const control={id:'site-wide',version:1,status:'READY',readyAdminCount:2};
  const notification={id:'site-wide',mode,version:1,updatedAt:now.toISOString(),updatedBy:'real-operator'};
  const fn={name:FUNCTION,state:'ACTIVE',environment:'GEN_2',updateTime:now.toISOString(),buildConfig:{runtime:'nodejs24',entryPoint:'reconcilePendingSecurityTransitions'},
    serviceConfig:{revision:'reconcilependingsecuritytransitions-00001-abc',service:'projects/sodc-web/locations/europe-west2/services/reconcilependingsecuritytransitions',uri:'https://reconcilependingsecuritytransitions-example-ew.a.run.app',serviceAccountEmail:'sodc-web@appspot.gserviceaccount.com',timeoutSeconds:540}};
  const target=canonicalTarget?'https://europe-west2-sodc-web.cloudfunctions.net/reconcilePendingSecurityTransitions':fn.serviceConfig.uri;
  const job={name:JOB,state:'ENABLED',schedule:'every 5 minutes',timeZone:'UTC',lastAttemptTime:'2026-10-23T08:55:00Z',httpTarget:{uri:target,httpMethod:'POST',oidcToken:{serviceAccountEmail:fn.serviceConfig.serviceAccountEmail,audience:target}},retryConfig:{retryCount:0},attemptDeadline:'1800s'};
  const commands=[],logs=[],otherTables=new Map();let authFactoryCalls=0,failDbCleanup=false,uncertainDbCleanup=false,uncertainCreate=false,uncertainProfile=false,uncertainInitialize=false,uncertainAuthDelete=false,partialAuthDelete=false;
  const clone=value=>structuredClone(value);
  const provider={
    auth:{
      async listUsers(){return {users:[...identities.values()].map(clone)};},
      async getUsers(inputs){const ids=inputs.map(row=>row.uid);commands.push({kind:'authBulkRead',uids:ids});expect(ids.length).toBeLessThanOrEqual(100);return {users:ids.filter(id=>identities.has(id)).map(id=>clone(identities.get(id))),notFound:ids.filter(id=>!identities.has(id)).map(uid=>({uid}))};},
      async getUser(uid){if(!identities.has(uid))throw Object.assign(new Error('provider detail must never escape'),{code:'auth/user-not-found'});return clone(identities.get(uid));},
      async createUser(input){commands.push({kind:'authCreate',input});identities.set(input.uid,{...input,providerData:[]});if(uncertainCreate)throw new Error('lost Auth response');return clone(identities.get(input.uid));},
      async deleteUser(uid){commands.push({kind:'authDelete',uid});identities.delete(uid);},
      async deleteUsers(ids){commands.push({kind:'authBulkDelete',uids:[...ids]});const deleted=partialAuthDelete?ids.slice(0,-1):ids;for(const id of deleted)identities.delete(id);if(uncertainAuthDelete)throw new Error('lost bulk Auth response');return {successCount:deleted.length,failureCount:ids.length-deleted.length,errors:partialAuthDelete?[{index:ids.length-1,error:{code:'auth/internal-error'}}]:[]};},
    },
    dc:{async executeGraphqlRead(query,{variables={}}={}){return this.executeGraphql(query,{variables});},
      async executeGraphql(query,{variables={}}={}){
        if(query.includes('ReconciliationVolumeControl'))return {data:{govNotifyDeliveryConfiguration:clone(notification),adminSafetyControl:clone(control)}};
        if(query.includes('ReconciliationVolumeCurrentAdmins'))return {data:{userSecurityStates:[...states.values()].filter(row=>row.adminReady).map(clone)}};
        if(query.includes('ReconciliationVolumeScan')){
          const table=query.match(/\{(\w+)\(/)[1];const values=({users:[...profiles.values()],userSecurityStates:[...states.values()],securityTransitions:[...transitions.values()],callableRateLimitBuckets:rates,callableInvocations:invocations})[table]??otherTables.get(table)??[];
          return {data:{[table]:values.slice(variables.offset,variables.offset+1000).map(clone)}};
        }
        if(query.includes('ReconciliationVolumeFixture'))return {data:{user:clone(profiles.get(variables.uid)??null),userSecurityState:clone(states.get(variables.uid)??null),securityTransition:clone(transitions.get(variables.operationId)??null)}};
        if(query.includes('ReconciliationVolumeBatch')){
          commands.push({kind:'dbBatchRead',variables});return {data:{users:[...profiles.values()].filter(row=>variables.ids.includes(row.id)).map(clone),userSecurityStates:[...states.values()].filter(row=>variables.ids.includes(row.userId)).map(clone),
            securityTransitions:[...transitions.values()].filter(row=>variables.ids.includes(row.userId)||variables.operationIds.includes(row.operationId)).map(clone),callableRateLimitBuckets:rates.filter(row=>variables.ids.includes(row.userId)).slice(0,1),callableInvocations:invocations.filter(row=>variables.ids.includes(row.userId)).slice(0,1)}};
        }
        if(query.includes('ReconciliationVolumeCreateProfile')){
          commands.push({kind:'profileCreate',query,variables});
          if(profiles.has(variables.id))throw new Error('duplicate key');
          profiles.set(variables.id,{id:variables.id,firstName:'Reconciliation',lastName:'Volume fixture',email:variables.email,serviceNumber:variables.id,membershipStatus:'PENDING',createdBy:variables.marker,updatedBy:variables.marker,announcementOptOutAll:true});
          if(uncertainProfile)throw new Error('lost database response');return {data:{user_insert:{id:variables.id}}};
        }
        if(query.includes('ReconciliationVolumeCleanup')){
          commands.push({kind:'dbCleanup',query,variables});if(failDbCleanup)throw new Error('database unavailable');
          for(const uid of variables.ids){states.delete(uid);profiles.delete(uid);}
          for(let index=rates.length-1;index>=0;index--)if(variables.ids.includes(rates[index].userId))rates.splice(index,1);
          for(let index=invocations.length-1;index>=0;index--)if(variables.ids.includes(invocations[index].userId))invocations.splice(index,1);
          if(uncertainDbCleanup)throw new Error('lost cleanup response');return {data:{userSecurityState_deleteMany:variables.expectedStates,user_deleteMany:variables.expectedProfiles}};
        }
        if(query.includes('ReconciliationVolumeRateCleanup'))return {data:{callableRateLimitBuckets:rates.filter(row=>variables.ids.includes(row.userId)),callableInvocations:invocations.filter(row=>variables.ids.includes(row.userId))}};
        throw new Error('Unexpected fake database operation');
      }},
    coordinator:{async initializeUserSecurityState(input){
      commands.push({kind:'initialize',input});const user=profiles.get(input.userId);
      const state={userId:input.userId,securityVersion:1,membershipStatus:'PENDING',desiredEnabled:false,desiredAdmin:false,verificationEmail:null,accessReady:false,adminReady:false,operationId:input.operationId,syncStatus:'READY',user:{membershipStatus:'PENDING',email:user.email}};
      states.set(input.userId,state);transitions.set(input.operationId,{...state,user:undefined,actorKind:input.actorKind,actorId:input.actorId,reason:input.reason,noOp:false,startedAdminDelta:0,completedAdminDelta:0});
      identities.get(input.userId).customClaims={enabled:false,admin:false,securityVersion:1};control.version+=2;
      if(uncertainInitialize)throw new Error('lost coordinator response');
    },async synchronizeUserSecurity(operationId){commands.push({kind:'synchronize',operationId});const transition=transitions.get(operationId),state=states.get(transition.userId);transition.syncStatus=state?'READY':'SUPERSEDED';if(state)state.syncStatus='READY';}},
    accessToken:async()=> 'SECRET_ADC_TOKEN_NEVER_LOGGED',close:async()=>{commands.push({kind:'close'});},
  };
  const fetch=async(url,options)=>{
    commands.push({kind:'rest',url,method:options.method,body:options.body?JSON.parse(options.body):undefined});
    const response=data=>({ok:true,status:200,headers:{get:()=>now.toUTCString()},json:async()=>clone(data)});
    if(url===`https://cloudscheduler.googleapis.com/v1/${JOB}`)return response(job);
    if(url===`https://cloudfunctions.googleapis.com/v2/${FUNCTION}`)return response(fn);
    if(url===`https://cloudscheduler.googleapis.com/v1/${JOB}:pause`){job.state='PAUSED';return response(job);}
    if(url===`https://cloudscheduler.googleapis.com/v1/${JOB}:resume`){job.state='ENABLED';return response(job);}
    if(url==='https://logging.googleapis.com/v2/entries:list'){
      const filter=JSON.parse(options.body).filter;
      return response({entries:filter.includes('jsonPayload.message="Security reconciliation completed"')?logs.filter(row=>row.jsonPayload?.message==='Security reconciliation completed'):logs});
    }
    throw new Error('Unexpected fake REST target');
  };
  let manifest=draft;
  const baseOptions={repositoryRoot:ROOT,runDirectory:directory,fetch,adminFactory:async()=>{authFactoryCalls++;return provider;},environment:{},nodeVersion:'v24.0.0',now:()=>now};
  const receiptBase=()=>({projectId:'sodc-web',runId:RUN,manifestHash:stableHash(manifest),schedulerResource:JOB,configurationHash:manifest.baseline.scheduler.configurationHash,deploymentProofHash:manifest.baseline.deployment.proofHash,evidenceReference:'independent-provider-evidence'});
  let measurementReceipt;
  const evidence={...(defaultDrain?{}:{drain:async({drainNotBefore})=>({schemaVersion:'sodc-reconciliation-volume-drain/v1',...receiptBase(),drainNotBefore,observedAt:now.toISOString(),inFlightExecutions:0})}),measurement:async()=>measurementReceipt};
  const draftAdapter=createReconciliationVolumeCloud({...baseOptions,manifest:draft,evidence});
  const observed=await draftAdapter.observe();
  manifest={...draft,baseline:{fingerprint:observed.baselineFingerprint,counts:observed.counts,readyAdminCount:observed.readyAdminCount,scheduler:observed.scheduler,deployment:observed.deployment,notification:observed.notification}};
  const adapter=createReconciliationVolumeCloud({...baseOptions,manifest,evidence});
  return {adapter,manifest,directory,commands,identities,profiles,states,transitions,rates,invocations,otherTables,control,notification,job,fn,logs,baseOptions,receiptBase,
    get authFactoryCalls(){return authFactoryCalls;},setNow:value=>{now=new Date(value);},flags:options=>{({failDbCleanup=false,uncertainDbCleanup=false,uncertainCreate=false,uncertainProfile=false,uncertainInitialize=false,uncertainAuthDelete=false,partialAuthDelete=false}=options);},
    setReceipt:receipt=>{measurementReceipt=receipt;},completion({targetSize=3,executionId='execution_1',insertId='insert_1',completed=true,timedOut=false}={}){
      const startedAt='2026-10-23T09:00:01Z',completedAt='2026-10-23T09:00:10Z';now=new Date('2026-10-23T09:00:15Z');
      const receipt={schemaVersion:'sodc-reconciliation-volume-measurement/v1',...receiptBase(),measurementId:'volume-2000-test',targetSize,revision:fn.serviceConfig.revision,executionId,insertId,startedAt,completedAt,completed,timedOut};
      logs.push({insertId,timestamp:'2026-10-23T09:00:09Z',resource:{type:'cloud_run_revision',labels:{project_id:'sodc-web',location:'europe-west2',revision_name:fn.serviceConfig.revision}},labels:{execution_id:executionId},severity:completed?'INFO':'ERROR',
        jsonPayload:completed?{message:'Security reconciliation completed',stateAttempts:targetSize,pendingAttempts:0,failedAttempts:0,durationMs:8000}:{message:'Function execution timed out'}});
      measurementReceipt=receipt;return receipt;
    }};
}

describe('Dev-only reconciliation volume cloud adapter',()=>{
  it('constructs without credentials or transport and rejects conflicting environments before discovery',async()=>{
    const f=await fixture();let calls=0;
    const adapter=createReconciliationVolumeCloud({...f.baseOptions,manifest:f.manifest,adminFactory:async()=>{calls++;throw new Error('must not load');},environment:{GCLOUD_PROJECT:'sodc-web-production'}});
    expect(calls).toBe(0);await expect(adapter.observe()).rejects.toThrow('DEV_PROJECT_ENVIRONMENT_REQUIRED');expect(calls).toBe(0);
    expect(()=>assertReconciliationVolumeEnvironment({},'v22.0.0')).toThrow('NODE_24_REQUIRED');
    expect(()=>assertReconciliationVolumeEnvironment({FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},'v24.0.0')).toThrow('EMULATOR_OVERRIDE_FORBIDDEN');
    expect(()=>createReconciliationVolumeCloud({...f.baseOptions,manifest:{...f.manifest,projectId:'sodc-web-beta'}})).toThrow('DEV_VOLUME_MANIFEST_REQUIRED');
  });

  it.each([false,true])('accepts the exact supported scheduler URL (canonical=%s)',async canonicalTarget=>{
    const f=await fixture({canonicalTarget});const observation=await f.adapter.observe();expect(observation.baselineAuthorityPassed).toBe(true);expect(observation.controlReady).toBe(true);expect(observation.fixtures.unexpectedOwnedRows).toBe(0);
  });

  it.each(['uri','audience','account'])('rejects scheduler target %s drift',async type=>{
    const f=await fixture();if(type==='uri')f.job.httpTarget.uri='https://foreign.example/';else if(type==='audience')f.job.httpTarget.oidcToken.audience='https://foreign.example/';else f.job.httpTarget.oidcToken.serviceAccountEmail='foreign@example.invalid';
    await expect(f.adapter.observe()).rejects.toThrow('RECONCILIATION_TARGET_IDENTITY_MISMATCH');
  });

  it('creates no-email disabled fixtures through the coordinator and resumes uncertain responses',async()=>{
    const f=await fixture({mode:'TEAM_TEST'});await f.adapter.pauseScheduler();f.flags({uncertainCreate:true,uncertainProfile:true,uncertainInitialize:true});
    const owned=f.manifest.fixtures[0];await expect(f.adapter.createFixture(owned)).resolves.toEqual({ready:true});await f.adapter.createFixture(owned);
    const authCreate=f.commands.find(row=>row.kind==='authCreate');expect(authCreate.input).toEqual({uid:owned.uid,displayName:owned.marker,disabled:true,emailVerified:false});
    expect(f.commands.filter(row=>row.kind==='authCreate')).toHaveLength(1);expect(f.commands.find(row=>row.kind==='profileCreate').query).toContain('user_insert');expect(f.commands.find(row=>row.kind==='profileCreate').query).not.toContain('upsert');
    expect(f.commands.find(row=>row.kind==='initialize').input).toMatchObject({actorKind:'OPERATOR',allowAdminBootstrap:false,operationId:owned.operationId});
    const observation=await f.adapter.observe();expect(observation.notification.mode).toBe('TEAM_TEST');expect(observation.baselineAuthorityPassed).toBe(true);expect(observation.readyAdminCount).toBe(2);expect(observation.fixtures.validDeniedReady).toBe(1);
    expect(JSON.stringify(observation)).not.toContain(owned.uid);expect(JSON.stringify(observation)).not.toContain('SECRET_ADC');
  });

  it('rejects foreign fixture identities and unknown prefix artifacts',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();const owned=f.manifest.fixtures[0];f.identities.set(owned.uid,{uid:owned.uid,displayName:'foreign',disabled:true,emailVerified:false});
    await expect(f.adapter.createFixture(owned)).rejects.toThrow('FOREIGN_FIXTURE_IDENTITY');
    f.profiles.set(`${f.manifest.fixturePrefix}99999`,{id:`${f.manifest.fixturePrefix}99999`,membershipStatus:'PENDING',email:'foreign@example.invalid'});
    f.otherTables.set('announcementRecipients',[{id:'recipient',userId:owned.uid}]);const observed=await f.adapter.observe();expect(observed.fixtures.unexpectedOwnedRows).toBe(3);expect(observed.baselineAuthorityPassed).toBe(false);
  });

  it('requires unchanged notification configuration and exact administrator count before writes',async()=>{
    const f=await fixture({mode:'LIVE'});await f.adapter.pauseScheduler();f.notification.version++;
    await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('NOTIFICATION_CONFIGURATION_CHANGED');f.notification.version--;f.control.readyAdminCount--;
    await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('REAL_ADMINISTRATOR_CONTROL_CHANGED');expect(f.commands.some(row=>row.kind==='authCreate')).toBe(false);
  });

  it('keeps audit receipts, cleans exact operational rows, and restores only the captured scheduler',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);const owned=f.manifest.fixtures[0];
    f.rates.push({userId:owned.uid,functionName:'fixture',windowStart:'2026-10-23T09:00:00Z'});f.invocations.push({userId:owned.uid,functionName:'fixture'});
    await f.adapter.deleteFixtureBatch(f.manifest.fixtures);expect(f.transitions.size).toBe(1);expect(f.transitions.get(owned.operationId).syncStatus).toBe('READY');
    expect(f.identities.size).toBe(2);expect(f.profiles.size).toBe(2);expect(f.states.size).toBe(2);expect(f.rates).toEqual([]);expect(f.invocations).toEqual([]);
    const cleanup=f.commands.find(row=>row.kind==='dbCleanup');expect(cleanup.variables.ids).toEqual(f.manifest.fixtures.map(row=>row.uid));expect(cleanup.query).toContain('adminReady:{eq:false}');expect(cleanup.query).toContain('operationId:{in:$operationIds}');expect(cleanup.query).not.toContain('securityTransition_delete');expect(cleanup.query).not.toContain('adminSafety');
    await f.adapter.restoreScheduler();expect(f.job.state).toBe('ENABLED');expect(f.commands.filter(row=>row.kind==='rest'&&row.method==='POST'&&!row.url.includes('logging.googleapis.com')).map(row=>row.url)).toEqual([`https://cloudscheduler.googleapis.com/v1/${JOB}:pause`,`https://cloudscheduler.googleapis.com/v1/${JOB}:resume`]);
  });

  it('resolves an uncertain committed cleanup before Auth deletion, and never deletes Auth after failed cleanup',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);f.flags({failDbCleanup:true});
    await expect(f.adapter.deleteFixtureBatch([f.manifest.fixtures[0]])).rejects.toThrow('VOLUME_DATABASE_OPERATION_FAILED');expect(f.commands.some(row=>row.kind==='authBulkDelete')).toBe(false);
    f.flags({uncertainDbCleanup:true});await f.adapter.deleteFixtureBatch([f.manifest.fixtures[0]]);expect(f.commands.filter(row=>row.kind==='authBulkDelete')).toHaveLength(1);
    await f.adapter.deleteFixtureBatch([f.manifest.fixtures[0]]);expect(f.commands.filter(row=>row.kind==='authBulkDelete')).toHaveLength(1);
  });

  it('finishes owned pending receipts or supersedes detached receipts before cleanup',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();for(const row of f.manifest.fixtures.slice(0,2))await f.adapter.createFixture(row);
    const [a,b]=f.manifest.fixtures;f.states.get(a.uid).syncStatus='PENDING';f.transitions.get(a.operationId).syncStatus='PENDING';f.states.delete(b.uid);f.transitions.get(b.operationId).syncStatus='PENDING';
    await f.adapter.deleteFixtureBatch([a,b]);expect(f.transitions.get(a.operationId).syncStatus).toBe('READY');expect(f.transitions.get(b.operationId).syncStatus).toBe('SUPERSEDED');expect(f.commands.filter(row=>row.kind==='synchronize')).toHaveLength(2);
  });

  it('cleans batches with constant reads, skips absent-slot writes, and resolves uncertain bulk Auth deletion',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();const [a,b]=f.manifest.fixtures;await f.adapter.createFixture(a);await f.adapter.createFixture(b);f.flags({uncertainAuthDelete:true});
    const start=f.commands.length;await f.adapter.deleteFixtureBatch(f.manifest.fixtures);const calls=f.commands.slice(start);
    expect(calls.filter(row=>row.kind==='dbBatchRead')).toHaveLength(2);expect(calls.filter(row=>row.kind==='authBulkRead'&&row.uids.some(uid=>uid.startsWith(f.manifest.fixturePrefix)))).toHaveLength(3);expect(calls.filter(row=>row.kind==='authBulkDelete')).toHaveLength(1);
    expect(calls.find(row=>row.kind==='authBulkDelete').uids).toEqual([a.uid,b.uid]);expect(calls.some(row=>row.kind==='authDelete')).toBe(false);
    const again=f.commands.length;await f.adapter.deleteFixtureBatch(f.manifest.fixtures);expect(f.commands.slice(again).filter(row=>row.kind==='dbBatchRead')).toHaveLength(1);expect(f.commands.slice(again).some(row=>['dbCleanup','authBulkDelete'].includes(row.kind))).toBe(false);
    expect(f.identities.has('real-0')).toBe(true);expect(f.identities.has('real-1')).toBe(true);expect(f.transitions.size).toBe(2);
  });

  it('fails safely after partial bulk Auth deletion and resumes only the remaining owned identity',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();for(const owned of f.manifest.fixtures.slice(0,2))await f.adapter.createFixture(owned);f.flags({partialAuthDelete:true});
    await expect(f.adapter.deleteFixtureBatch(f.manifest.fixtures)).rejects.toThrow('FIXTURE_AUTH_DELETION_INCOMPLETE');expect(f.states.size).toBe(2);expect(f.profiles.size).toBe(2);expect(f.transitions.size).toBe(2);
    f.flags({});await f.adapter.deleteFixtureBatch(f.manifest.fixtures);expect(f.commands.filter(row=>row.kind==='authBulkDelete').at(-1).uids).toEqual([f.manifest.fixtures[1].uid]);expect(f.identities.size).toBe(2);
  });

  it('rejects foreign batch Auth responses and swapped UID-to-operation database pairs before deletion',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();const provider=await f.baseOptions.adminFactory(),original=provider.auth.getUsers;
    provider.auth.getUsers=async inputs=>inputs.some(row=>row.uid.startsWith(f.manifest.fixturePrefix))?({users:[structuredClone(f.identities.get('real-0'))],notFound:[]}):original(inputs);await expect(f.adapter.deleteFixtureBatch(f.manifest.fixtures)).rejects.toThrow('FOREIGN_OR_DUPLICATE_BULK_IDENTITY');expect(f.commands.some(row=>row.kind==='dbCleanup')).toBe(false);
    provider.auth.getUsers=original;for(const owned of f.manifest.fixtures.slice(0,2))await f.adapter.createFixture(owned);const [a,b]=f.manifest.fixtures;f.states.get(a.uid).operationId=b.operationId;
    await expect(f.adapter.deleteFixtureBatch([a,b])).rejects.toThrow('FOREIGN_FIXTURE_AUTHORITY');expect(f.commands.some(row=>row.kind==='authBulkDelete')).toBe(false);
  });

  it('refuses counted/foreign authority, oversized batches, and manifest deviations',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();const owned=f.manifest.fixtures[0];await f.adapter.createFixture(owned);f.states.get(owned.uid).adminReady=true;
    await expect(f.adapter.deleteFixtureBatch([owned])).rejects.toThrow('CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');expect(f.commands.some(row=>row.kind==='dbCleanup')).toBe(false);
    await expect(f.adapter.deleteFixtureBatch(Array(101).fill(owned))).rejects.toThrow('SCOPED_CLEANUP_BATCH_REQUIRED');await expect(f.adapter.createFixture({...owned,operationId:'foreign'})).rejects.toThrow('MANIFEST_FIXTURE_REQUIRED');
  });

  it('independently establishes a durable pause/drain proof and invalidates it after another attempt',async()=>{
    const f=await fixture({defaultDrain:true});await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');expect(f.job.state).toBe('PAUSED');
    const pause=JSON.parse(await readFile(path.join(f.directory,'provider-pause.json'),'utf8'));expect(pause.notBefore).toBe('2026-10-23T09:10:00.000Z');
    f.setNow('2026-10-23T09:10:01Z');const proof=await f.adapter.pauseScheduler();expect(proof).toMatchObject({quiescent:true});expect(proof.proofHash).toMatch(/^[a-f0-9]{64}$/);
    f.setNow('2026-10-23T09:30:01Z');await f.adapter.createFixture(f.manifest.fixtures[0]);f.job.lastAttemptTime='2026-10-23T09:29:00Z';
    await expect(f.adapter.createFixture(f.manifest.fixtures[1])).rejects.toThrow('PAUSE_ATTEMPT_CHANGED_CALL_PAUSE_AGAIN');await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');
    expect(f.commands.some(row=>row.kind==='rest'&&row.url.endsWith(':run'))).toBe(false);
  });

  it('renews an armed pause when PAUSED responses omit both attempt fields and never trusts the old cached drain',async()=>{
    const f=await fixture({defaultDrain:true});delete f.job.lastAttemptTime;delete f.job.scheduleTime;
    await expect(f.adapter.pauseScheduler({drainNotBefore:f.manifest.createdAt})).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');f.setNow('2026-10-23T09:10:01Z');await f.adapter.pauseScheduler({drainNotBefore:f.manifest.createdAt});
    const filename=path.join(f.directory,'provider-pause.json'),original=JSON.parse(await readFile(filename,'utf8'));
    expect(original.attemptEvidence).toEqual({lastAttemptTime:null,scheduleTime:null,informative:false});
    const anchor='2026-10-23T09:11:00.000Z',execution={measurementId:'volume-2000-stalled',notBefore:anchor,targetSize:2000};f.setNow('2026-10-23T09:12:00Z');
    // A forced dispatch has no visible timestamp or log; the durable arm must
    // still revoke the original proof and create a new provider-timed window.
    await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');
    const renewed=JSON.parse(await readFile(filename,'utf8'));expect(renewed.attemptHash).toBe(original.attemptHash);expect(renewed.captureHash).not.toBe(original.captureHash);expect(renewed.drainNotBefore).toBe(anchor);expect(renewed.pausedAt).toBe('2026-10-23T09:12:00.000Z');expect(renewed.notBefore).toBe('2026-10-23T09:22:00.000Z');expect(renewed.verifiedAt).toBeUndefined();
    await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');f.setNow('2026-10-23T09:13:00Z');
    await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');expect(JSON.parse(await readFile(filename,'utf8')).captureHash).toBe(renewed.captureHash);
    f.setNow('2026-10-23T09:22:01Z');await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('DRAIN_HANDLER_COMPLETION_REQUIRED');
    await expect(f.adapter.deleteFixtureBatch(f.manifest.fixtures)).rejects.toThrow('DRAIN_HANDLER_COMPLETION_REQUIRED');expect(f.commands.some(row=>['authCreate','dbCleanup','authBulkDelete'].includes(row.kind))).toBe(false);
  });

  it('requires the armed handler completion after a request timeout without changing its failed capacity receipt',async()=>{
    const f=await fixture({defaultDrain:true});delete f.job.lastAttemptTime;await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');f.setNow('2026-10-23T09:10:01Z');await f.adapter.pauseScheduler();
    const anchor='2026-10-23T09:11:00.000Z',execution={measurementId:'volume-2000-timeout',notBefore:anchor,targetSize:2000,executionId:'timed_out_execution'};f.setNow('2026-10-23T09:12:00Z');
    await expect(f.adapter.pauseScheduler({cleanup:true,drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');
    const capacityFile=path.join(f.directory,`measurement-${execution.measurementId}.json`),capacity=JSON.stringify({completed:false,timedOut:true,executionId:execution.executionId});await writeFile(capacityFile,capacity,{mode:0o600});
    const handler={schemaVersion:'sodc-reconciliation-volume-handler-drain/v1',...f.receiptBase(),measurementId:execution.measurementId,notBefore:anchor,targetSize:2000,revision:f.fn.serviceConfig.revision,executionId:execution.executionId,insertId:'request_timeout',startedAt:'2026-10-23T09:11:01Z',completedAt:'2026-10-23T09:12:10Z'};
    const handlerFile=path.join(f.directory,`handler-drain-${execution.measurementId}.json`);await writeFile(handlerFile,JSON.stringify(handler),{mode:0o600});
    f.logs.push({insertId:'request_timeout',timestamp:'2026-10-23T09:12:00Z',resource:{type:'cloud_run_revision',labels:{project_id:'sodc-web',location:'europe-west2',revision_name:f.fn.serviceConfig.revision}},labels:{execution_id:execution.executionId},severity:'ERROR',jsonPayload:{message:'Function execution finished with status timeout'}});
    f.setNow('2026-10-23T09:22:01Z');await expect(f.adapter.pauseScheduler({cleanup:true,drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('DRAIN_HANDLER_COMPLETION_REQUIRED');
    handler.insertId='actual_handler_completion';await writeFile(handlerFile,JSON.stringify(handler));
    f.logs.push({...structuredClone(f.logs[0]),insertId:handler.insertId,timestamp:'2026-10-23T09:12:05Z',severity:'INFO',jsonPayload:{message:'Security reconciliation completed',durationMs:64000,stateAttempts:1999,pendingAttempts:1,failedAttempts:3}});
    await expect(f.adapter.pauseScheduler({cleanup:true,drainNotBefore:anchor,drainExecution:execution})).resolves.toMatchObject({quiescent:true});
    const saved=JSON.parse(await readFile(path.join(f.directory,'provider-pause.json'),'utf8'));expect(saved.handlerCompletionHash).toMatch(/^[a-f0-9]{64}$/);expect(await readFile(capacityFile,'utf8')).toBe(capacity);
  });

  it('rejects missing armed identity, noncanonical anchors, and handler evidence from another execution',async()=>{
    const f=await fixture({defaultDrain:true}),anchor='2026-10-23T09:01:00.000Z';f.setNow('2026-10-23T09:02:00Z');
    await expect(f.adapter.pauseScheduler({drainNotBefore:'2026-10-23T09:01:00Z'})).rejects.toThrow('CANONICAL_DRAIN_ANCHOR_REQUIRED');await expect(f.adapter.pauseScheduler({drainNotBefore:anchor})).rejects.toThrow('ARMED_DRAIN_EXECUTION_REQUIRED');
    const execution={measurementId:'volume-2000-other',notBefore:anchor,targetSize:2000,executionId:'expected_execution'};
    await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:{...execution,executionId:null}})).rejects.toThrow('ARMED_DRAIN_EXECUTION_REQUIRED');
    await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');
    const handler={schemaVersion:'sodc-reconciliation-volume-handler-drain/v1',...f.receiptBase(),...execution,revision:f.fn.serviceConfig.revision,executionId:'foreign_execution',insertId:'insert',startedAt:'2026-10-23T09:01:01Z',completedAt:'2026-10-23T09:02:01Z'};
    await writeFile(path.join(f.directory,`handler-drain-${execution.measurementId}.json`),JSON.stringify(handler),{mode:0o600});f.setNow('2026-10-23T09:12:01Z');
    await expect(f.adapter.pauseScheduler({drainNotBefore:anchor,drainExecution:execution})).rejects.toThrow('DRAIN_HANDLER_COMPLETION_IDENTITY_MISMATCH');
  });

  it('rejects a visible execution without a terminal log even after the timeout grace',async()=>{
    const f=await fixture({defaultDrain:true});await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');f.setNow('2026-10-23T09:10:01Z');
    f.logs.push({insertId:'unfinished',timestamp:'2026-10-23T09:00:10Z',resource:{type:'cloud_run_revision',labels:{project_id:'sodc-web',location:'europe-west2',revision_name:f.fn.serviceConfig.revision}},labels:{execution_id:'unfinished'},jsonPayload:{message:'Current security mirror requires recovery'}});
    await expect(f.adapter.pauseScheduler()).rejects.toThrow('VISIBLE_EXECUTION_HAS_NO_TERMINAL_LOG');
  });

  it('rejects shortened drain waits and changed cached proof fields',async()=>{
    const f=await fixture({defaultDrain:true});await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');const filename=path.join(f.directory,'provider-pause.json'),original=JSON.parse(await readFile(filename,'utf8'));
    await writeFile(filename,JSON.stringify({...original,notBefore:original.pausedAt}));await expect(f.adapter.pauseScheduler()).rejects.toThrow('PAUSE_RECORD_INVALID');
    await writeFile(filename,JSON.stringify(original));f.setNow('2026-10-23T09:10:01Z');await f.adapter.pauseScheduler();const verified=JSON.parse(await readFile(filename,'utf8'));
    await writeFile(filename,JSON.stringify({...verified,verifiedAt:'trust-me'}));await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('PAUSE_VERIFICATION_RECORD_INVALID');
    await writeFile(filename,JSON.stringify({...verified,logsProofHash:'a'.repeat(64)}));await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('DRAIN_PROOF_CHANGED');
  });

  it('re-verifies provider logs in a new process even when the saved proof claims verification',async()=>{
    const f=await fixture({defaultDrain:true});await expect(f.adapter.pauseScheduler()).rejects.toThrow('WAIT_FOR_RECONCILIATION_DRAIN');f.setNow('2026-10-23T09:10:01Z');await f.adapter.pauseScheduler();
    f.logs.push({insertId:'unfinished',timestamp:'2026-10-23T09:00:10Z',resource:{type:'cloud_run_revision',labels:{project_id:'sodc-web',location:'europe-west2',revision_name:f.fn.serviceConfig.revision}},labels:{execution_id:'unfinished'},jsonPayload:{message:'Still processing'}});
    const reopened=createReconciliationVolumeCloud({...f.baseOptions,manifest:f.manifest});await expect(reopened.pauseScheduler()).rejects.toThrow('VISIBLE_EXECUTION_HAS_NO_TERMINAL_LOG');
  });

  it('reports only static query/table context when a schema read fails',async()=>{
    const f=await fixture(),provider=await f.baseOptions.adminFactory(),read=provider.dc.executeGraphqlRead;
    provider.dc.executeGraphqlRead=async function(query,options){if(query.includes('ReconciliationVolumeScan')&&query.includes('{users('))throw new Error('SECRET_TOKEN private member@example.invalid');return read.call(this,query,options);};
    await expect(f.adapter.observe()).rejects.toThrow(/^VOLUME_DATABASE_OPERATION_FAILED_RECONCILIATION_VOLUME_SCAN_USERS$/);
  });

  it('verifies actual provider completion counts and never dispatches or accepts a fabricated pass',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);f.completion();
    const measured=await f.adapter.measure({targetSize:3,measurementId:'volume-2000-test',notBefore:f.manifest.createdAt});expect(measured).toMatchObject({completed:true,providerVerified:true,stateAttempts:3,pendingAttempts:0,failedAttempts:0,durationMs:8000,notBefore:f.manifest.createdAt});expect(measured.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(measured)).not.toContain(f.manifest.fixtures[0].uid);expect(f.commands.some(row=>row.url?.endsWith(':run'))).toBe(false);
    await expect(f.adapter.measure({targetSize:3,measurementId:'volume-2000-test',notBefore:'2026-10-23T09:00:02Z'})).rejects.toThrow('MEASUREMENT_TIME_WINDOW_INVALID');
    await expect(f.adapter.measure({targetSize:3,measurementId:'volume-2000-test'})).rejects.toThrow('ARMED_MEASUREMENT_WINDOW_REQUIRED');
    f.logs[0].jsonPayload.stateAttempts=2;await expect(f.adapter.measure({targetSize:3,measurementId:'volume-2000-test',notBefore:f.manifest.createdAt})).rejects.toThrow('PROVIDER_SWEEP_COUNTS_INVALID');
  });

  it('records only an independently verified timeout and rejects cross-project log evidence',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);f.completion({completed:false,timedOut:true});
    const result=await f.adapter.measure({targetSize:3,measurementId:'volume-2000-test',notBefore:f.manifest.createdAt});expect(result).toMatchObject({completed:false,timedOut:true,providerVerified:true,stateAttempts:null});
    f.logs[0].resource.labels.project_id='sodc-web-production';await expect(f.adapter.measure({targetSize:3,measurementId:'volume-2000-test',notBefore:f.manifest.createdAt})).rejects.toThrow('PROVIDER_LOG_IDENTITY_MISMATCH');
  });

  it('keeps evidence private and refuses to recreate a retired fixture',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);await f.adapter.deleteFixtureBatch([f.manifest.fixtures[0]]);
    await expect(f.adapter.createFixture(f.manifest.fixtures[0])).rejects.toThrow('PARTIALLY_RETIRED_FIXTURE_CANNOT_BE_RECREATED');
    const other=createReconciliationVolumeCloud({...f.baseOptions,manifest:f.manifest});await writeFile(path.join(f.directory,'provider-pause.json'),'{}',{mode:0o644});await expect(other.pauseScheduler()).rejects.toThrow('PRIVATE_EVIDENCE_FILE_REQUIRED');
  });

  it('never exposes raw SDK messages through the public provider boundary',async()=>{
    const f=await fixture(),provider=await f.baseOptions.adminFactory();provider.auth.listUsers=async()=>{throw new Error('SECRET_ADC_TOKEN and private identity details');};
    await expect(f.adapter.observe()).rejects.toThrow(/^VOLUME_PROVIDER_OPERATION_FAILED$/);
  });

  it('permits scoped cleanup and scheduler restoration after a legitimate unrelated profile edit',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);f.profiles.get('real-0').firstName='Updated profile';
    const changed=await f.adapter.observe();expect(changed.currentAuthorityPassed).toBe(true);expect(changed.baselineAuthorityPassed).toBe(false);
    await f.adapter.pauseScheduler({cleanup:true});await f.adapter.deleteFixtureBatch(f.manifest.fixtures);await f.adapter.restoreScheduler();
    expect(f.profiles.get('real-0').firstName).toBe('Updated profile');expect(f.job.state).toBe('ENABLED');expect(f.control.version).toBe(3);
  });

  it('cleans only owned fixtures after a healthy real administrator-count change while setup remains strict',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);
    f.states.get('real-0').desiredAdmin=false;f.states.get('real-0').adminReady=false;f.identities.get('real-0').customClaims.admin=false;f.control.readyAdminCount=1;f.control.version++;
    const changed=await f.adapter.observe();expect(changed.currentAuthorityPassed).toBe(true);expect(changed.baselineAuthorityPassed).toBe(false);
    await expect(f.adapter.pauseScheduler()).rejects.toThrow('REAL_ADMINISTRATOR_CONTROL_CHANGED');await expect(f.adapter.createFixture(f.manifest.fixtures[1])).rejects.toThrow('REAL_ADMINISTRATOR_CONTROL_CHANGED');
    await f.adapter.pauseScheduler({cleanup:true});await f.adapter.deleteFixtureBatch(f.manifest.fixtures);await f.adapter.restoreScheduler();
    expect(f.control.readyAdminCount).toBe(1);expect(f.control.version).toBe(4);expect(f.states.get('real-0').desiredAdmin).toBe(false);expect(f.identities.get('real-0').customClaims.admin).toBe(false);expect(f.job.state).toBe('ENABLED');
  });

  it('refuses cleanup and restoration when the current counted administrator roster is unsafe',async()=>{
    const f=await fixture();await f.adapter.pauseScheduler();await f.adapter.createFixture(f.manifest.fixtures[0]);f.identities.get('real-0').disabled=true;
    const changed=await f.adapter.observe();expect(changed.currentAuthorityPassed).toBe(false);expect(changed.baselineAuthorityPassed).toBe(false);
    await expect(f.adapter.pauseScheduler({cleanup:true})).rejects.toThrow('CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');await expect(f.adapter.deleteFixtureBatch(f.manifest.fixtures)).rejects.toThrow('CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');await expect(f.adapter.restoreScheduler()).rejects.toThrow('CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');
    expect(f.identities.has(f.manifest.fixtures[0].uid)).toBe(true);expect(f.job.state).toBe('PAUSED');
  });
});
