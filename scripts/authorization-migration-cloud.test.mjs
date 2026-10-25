import {test} from 'vitest';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createCloudMigrationAdapter,frozenInvokerPolicy,restoreInvokerPolicy,hasPublicInvoker,assertAdditiveSql,isPlatformIamRefusal,selectStagedFunctions,sourceHash,SECURITY_WRITERS} from './authorization-migration-cloud.mjs';
import {stableHash,denyOnboarding} from './authorization-migration-sources.mjs';
import {discoverFunctionContracts} from './deployment-check-lib.mjs';
import {assertNoCredentials} from './authorization-migration-state.mjs';
import {revisionIdentity} from './authorization-migration-retirement.mjs';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const project='sodc-web';const sha='a'.repeat(40);const at='2026-10-23T10:00:00.000Z';
const policy={version:3,etag:'original',bindings:[{role:'roles/run.invoker',members:['allUsers','allAuthenticatedUsers','serviceAccount:runtime@example.invalid']},{role:'roles/run.viewer',members:['user:operator@example.invalid']}]};
const files=async directory=>Promise.all((await readdir(directory)).filter(name=>name.endsWith('.gql')).map(async name=>({path:name,content:await readFile(path.join(directory,name),'utf8')})));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const uuid=value=>{const hash=stableHash(value);return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};

async function setup(t,{runtime='v24.4.1',firebaseVersion='15.22.3',missingApi=false,claimsOverride={},callableRoleDenial=false,appCheckInvalid=false,scheduledTimeout=60,pendingTransitions=0,projectId=project,protectedDatabase=true,auditReady=false,fullFunctions=false,positiveQueryDenied=false,notificationJobExists=true,createJobsPaused=false}={}){
  const project=projectId;
  const directory=await mkdtemp(path.join(os.tmpdir(),'authorization-cloud-offline-'));t.onTestFinished(()=>rm(directory,{recursive:true,force:true}));
  const runDirectory=path.join(directory,'run');await mkdir(runDirectory);
  const firebaseExecutable=path.join(directory,'tools/lib/bin/firebase.js');await mkdir(path.dirname(firebaseExecutable),{recursive:true});await mkdir(path.join(directory,'tools/lib/dataconnect'),{recursive:true});await writeFile(firebaseExecutable,'');
  await writeFile(path.join(directory,'tools/lib/dataconnect/client.js'),'exports.deleteConnector=exports.deleteSchema=exports.deleteService=async()=>{throw Error("UNGUARDED_DELETE");};');
  await writeFile(path.join(directory,'tools/lib/ensureApiEnabled.js'),'exports.ensure=exports.bestEffortEnsure=exports.enableApiURI=async()=>{throw Error("UNGUARDED_ENABLE");};');
  await mkdir(path.join(directory,'tools/lib/gcp'));await writeFile(path.join(directory,'tools/lib/gcp/cloudscheduler.js'),'exports.createOrReplaceJob=async()=>{throw Error("UNGUARDED_SCHEDULER");};');
  const config=JSON.parse(await readFile(path.join(repositoryRoot,'config/deployment-check.json'),'utf8'));
  const enabled=[...new Set([...config.requiredApis,'firebaseextensions.googleapis.com','cloudtasks.googleapis.com','eventarc.googleapis.com','pubsub.googleapis.com'])].filter(api=>!missingApi||api!=='run.googleapis.com');
  const base=`projects/${project}/locations/europe-west2/services/sodc-web-service`;
  const schema=await files(path.join(repositoryRoot,'dataconnect/schema'));let api=await files(path.join(repositoryRoot,'dataconnect/api'));
  const authorization=await files(path.join(repositoryRoot,'dataconnect/authorization-service'));
  const functionNames=fullFunctions?(await discoverFunctionContracts(path.join(repositoryRoot,'functions/src'))).functions.filter(name=>!['getMyAuthorizationStatus','reconcilePendingSecurityTransitions'].includes(name)):[...SECURITY_WRITERS,'recoverNotificationDeliveries'];const functionStates=new Map();const functionSources=new Map();let deferredHook;let failNextRestore=false;const extraIdentities=[];const extraProfiles=[];
  const policies=new Map(SECURITY_WRITERS.map(name=>[name,structuredClone(policy)]));
  const jobs=notificationJobExists?[{name:`projects/${project}/locations/europe-west2/jobs/firebase-schedule-recoverNotificationDeliveries-europe-west2`,state:'ENABLED',schedule:'every 1 minutes'}]:[];
  let milliseconds=new Date(at).getTime();const commands=[];const requests=[];let authorityVersion=1,pendingCount=pendingTransitions,runtimeSyncStatus='READY',pendingOperationId,bootstrapHook;
  const runServices=new Map(),runRevisions=new Map(),functionRevisions=new Map(),functionUpdateTimes=new Map(),missingRunResources=new Set();let runServiceReadHook;
  const serviceResource=name=>`projects/${project}/locations/europe-west2/services/${name.toLowerCase()}`;
  const functionForService=service=>functionNames.find(name=>name.toLowerCase()===service.split('/').at(-1));
  function retireRevision(revision){revision.conditions[1]={type:'Active',state:'CONDITION_FAILED',revisionReason:'RETIRED'};
    if(!revision.conditions.some(condition=>condition.type==='ResourcesAvailable'))revision.conditions.push({type:'ResourcesAvailable',state:'CONDITION_RECONCILING',revisionReason:'RETIRED'});}
  function deployRevision(name,kind){
    const serviceName=serviceResource(name);const before=runServices.get(serviceName);const generation=String(Number(before?.generation??0)+1);
    if(kind==='candidate')for(const revision of runRevisions.values())if(revision.service===serviceName&&revision.name.includes('-reviewed-maintenance-'))retireRevision(revision);
    const revisionName=serviceName+'/revisions/'+name.toLowerCase()+'-'+kind+'-'+generation;
    const revision={name:revisionName,service:serviceName,uid:uuid(revisionName),generation:'1',observedGeneration:'1',reconciling:false,
      containers:[{image:`europe-west2-docker.pkg.dev/${project}/functions/${name.toLowerCase()}@sha256:${stableHash(name)}`,env:[{name:'NEVER_PERSIST',value:'secret-value'}]}],
      conditions:[{type:'Ready',state:'CONDITION_SUCCEEDED'},{type:'Active',state:'CONDITION_SUCCEEDED'}]};
    runRevisions.set(revisionName,revision);functionRevisions.set(name,revisionName.split('/').at(-1));functionUpdateTimes.set(name,new Date(milliseconds).toISOString());
    runServices.set(serviceName,{name:serviceName,uid:before?.uid??uuid(serviceName),generation,observedGeneration:generation,reconciling:false,
      latestReadyRevision:revisionName,latestCreatedRevision:revisionName,traffic:[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST',percent:100}],
      trafficStatuses:[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:revisionName,percent:100}]});return revision;
  }
  for(const name of functionNames)deployRevision(name,'original');
  async function approveSuccessors(context){
    const state=JSON.parse(await readFile(path.join(runDirectory,'provider-freeze.json'),'utf8'));
    const originals=new Set(state.oldWriterInventory.services.flatMap(service=>service.revisions.map(revision=>revision.name)));
    const successorRevisions=state.oldWriterInventory.services.flatMap(service=>[...runRevisions.values()].filter(revision=>revision.service===service.name&&!originals.has(revision.name)).map(revision=>revisionIdentity(revision,service.name)));
    context.gates['old-writers']={details:{method:'cloud-run-retirement',freezeStateHash:stableHash(state),inventoryHash:stableHash(state.oldWriterInventory),
      successorRevisions,externalOperationsReference:'reviewed-external-provider-operations-terminal'}};
  }
  async function maintainAndRetire(context,{retire=true}={}){
    const state=JSON.parse(await readFile(path.join(runDirectory,'provider-freeze.json'),'utf8'));
    for(const service of state.oldWriterInventory.services){
      for(const identity of service.revisions)if(retire)retireRevision(runRevisions.get(identity.name));
      deployRevision(functionForService(service.name),'reviewed-maintenance');
    }
    await approveSuccessors(context);
  }
  const member={id:'approved-probe',email:'private.member@example.invalid',membershipStatus:'REGULAR',requestedMembershipStatus:'REGULAR',firstName:'Sensitive',lastName:'Member',serviceNumber:'sensitive-service',mobileNumber:'07000000000'};
  const identity={uid:member.id,email:member.email,disabled:false,emailVerified:true,customClaims:{securityVersion:1,enabled:true,admin:false},passwordHash:'NEVER-PERSIST-PASSWORD-HASH'};
  const adminIdentity={uid:'existing-administrator',disabled:false,emailVerified:true,customClaims:{securityVersion:1,enabled:true,admin:true}};
  const adminProfile={id:adminIdentity.uid,membershipStatus:'REGULAR'};
  const state=()=>({userId:member.id,securityVersion:authorityVersion,membershipStatus:'REGULAR',desiredEnabled:true,desiredAdmin:false,verificationEmail:null,accessReady:runtimeSyncStatus==='READY',adminReady:false,operationId:runtimeSyncStatus==='READY'?'existing':pendingOperationId,syncStatus:runtimeSyncStatus,user:{membershipStatus:'REGULAR',email:member.email}});
  const adminFactory=async()=>({auth:{listUsers:async()=>({users:[...(auditReady?[identity,adminIdentity]:[identity]),...extraIdentities]}),verifyIdToken:async()=>({uid:member.id,aud:project,iss:`https://securetoken.google.com/${project}`,email_verified:true,iat:Math.floor(milliseconds/1000)-10,exp:Math.floor(milliseconds/1000)+3600,...claimsOverride}),getUser:async()=>identity},appCheck:{verifyToken:async()=>{if(appCheckInvalid)throw Error('secret provider error');return {appId:'reviewed-app'};}},dc:{executeGraphqlRead:async(query)=>{
    if(query.includes('MigrationControl'))return {data:{adminSafetyControl:{id:'site-wide',version:1,readyAdminCount:auditReady?1:0,status:auditReady?'READY':'BOOTSTRAP'}}};
    if(query.includes('userSecurityStates('))return {data:{userSecurityStates:auditReady?[state(),{...state(),userId:adminIdentity.uid,desiredAdmin:true,accessReady:true,adminReady:true,syncStatus:'READY',user:{membershipStatus:'REGULAR'}}]:[state()]}};
    if(query.includes('securityTransitions('))return {data:{securityTransitions:Array.from({length:pendingCount},(_,index)=>({operationId:runtimeSyncStatus==='PENDING'?pendingOperationId:'pending-'+index,userId:member.id}))}};
    if(query.includes('users('))return {data:{users:[...(auditReady?[member,adminProfile]:[member]),...extraProfiles]}};
    if(query.includes('user(id:'))return {data:{user:member}};
    throw Error('UNEXPECTED_OFFLINE_QUERY');
  }},close:async()=>{}});
  const command=async(file,args,options)=>{
    commands.push({file,args:[...args],options});assert.equal(options.shell,false);
    if(args.length===1&&args[0]==='--version')return {stdout:file==='firebase'?firebaseVersion:runtime,code:0};
    if(file==='which')return {stdout:firebaseExecutable+'\n',code:0};
    if(file==='gcloud'){
      assert.equal(args[args.indexOf('--project')+1],project);
      if(args[0]==='projects')return {stdout:JSON.stringify({projectId:project,projectNumber:'123456789'})};
      if(args[0]==='services')return {stdout:JSON.stringify(enabled.map(name=>({config:{name}})))};
      if(args[0]==='auth')return {stdout:'PRIVATE-ADC-ACCESS-TOKEN'};
      if(args[0]==='run'){
        const name=functionForService(args[3]);if(args[2]==='get-iam-policy')return {stdout:JSON.stringify(policies.get(name))};
        if(args[2]==='set-iam-policy'){const next=JSON.parse(await readFile(args[4],'utf8'));assert.equal(next.etag,policies.get(name).etag);if(failNextRestore&&hasPublicInvoker(next)){failNextRestore=false;throw Error('simulated crash before restoring policy');}policies.set(name,{...next,etag:'updated'});return {stdout:'{}'};}
      }
      if(args[0]==='scheduler'){
        const job=jobs.find(item=>item.name.endsWith('/'+args[3]));assert.ok(job);
        if(args[2]==='pause')job.state='PAUSED';if(args[2]==='resume')job.state='ENABLED';return {stdout:JSON.stringify(job)};
      }
    }
    if(args.some(arg=>arg.endsWith('/security-state-admin.ts'))){assert.equal(args[args.indexOf('--mode')+1],'bootstrap');await bootstrapHook?.(args);return {stdout:'controlled bootstrap outcome'};}
    if(args.includes('dataconnect:sql:diff'))return {stdout:JSON.stringify({status:'success',result:{projectId:project,diffs:[]}})};
    if(args.includes('deploy')){
      const only=args[args.indexOf('--only')+1];
      if(only.startsWith('functions:')){
        for(const name of only.split(',').map(item=>item.slice('functions:'.length))){
          if(!functionNames.includes(name))functionNames.push(name);if(name==='getMyAuthorizationStatus')policies.set(name,structuredClone(policy));
          deployRevision(name,'candidate');
          if(['recoverNotificationDeliveries','reconcilePendingSecurityTransitions'].includes(name)){
            const job={name:`projects/${project}/locations/europe-west2/jobs/firebase-schedule-${name}-europe-west2`,schedule:name==='recoverNotificationDeliveries'?'every 1 minutes':'every 5 minutes',timeZone:'UTC',attemptDeadline:'1800s',retryConfig:{retryCount:3},httpTarget:{uri:`https://${name}.a.run.app`,httpMethod:'POST',oidcToken:{serviceAccountEmail:`123456789-compute@developer.gserviceaccount.com`}}};
            const code="const{createRequire}=require('node:module');const r=createRequire(process.argv[1]);r('../gcp/cloudscheduler.js').createOrReplaceJob(JSON.parse(process.argv[2])).catch(()=>process.exitCode=1);";
            execFileSync(process.execPath,['--require',args[1],'-e',code,firebaseExecutable,JSON.stringify(job)],{stdio:'pipe'});
          }
        }
        if(only.includes('getMyAuthorizationStatus'))deferredHook?.();return {stdout:'functions deployed'};
      }
      assert.equal(only,'dataconnect:sodc-web-service:api');
      const sourceDirectory=path.dirname(args[args.indexOf('--config')+1]);api=await files(path.join(sourceDirectory,'dataconnect/api'));return {stdout:'deployed'};
    }
    throw Error('UNEXPECTED_OFFLINE_COMMAND');
  };
  const fetch=async(url,options)=>{
    const target=new URL(url);requests.push({hostname:target.hostname,path:target.pathname,method:options.method});
    assert.equal(options.redirect,'error');
    if(target.hostname.endsWith('.cloudfunctions.net')){assert.equal(options.method,'GET');assert.equal(options.body,undefined);return callableRoleDenial?json({error:{status:'PERMISSION_DENIED'}},403):new Response('<html><title>Error: Forbidden</title>Your client does not have permission to access this URL.</html>',{status:403,headers:{'content-type':'text/html'}});}
    if(target.hostname==='cloudscheduler.googleapis.com'&&['POST','PATCH'].includes(options.method)){const body=JSON.parse(options.body);let job=jobs.find(job=>job.name===body.name);if(job)Object.assign(job,body);else{job={...body,state:createJobsPaused?'PAUSED':'ENABLED'};jobs.push(job);}return json(job);}
    if(options.method==='POST'){
      assert.equal(target.hostname,'firebasedataconnect.googleapis.com');if(target.pathname.endsWith(':executeQuery'))return positiveQueryDenied?json({error:{status:'PERMISSION_DENIED'}},403):json({data:{user:{id:member.id}}});return json({error:{status:'PERMISSION_DENIED'}},403);
    }
    assert.equal(options.headers.Authorization,'Bearer PRIVATE-ADC-ACCESS-TOKEN');
    if(target.hostname==='run.googleapis.com'){
      const name=target.pathname.slice('/v2/'.length);
      if(missingRunResources.has(name))return json({error:{status:'NOT_FOUND'}},404);
      if(name.endsWith('/revisions'))return json({revisions:[...runRevisions.values()].filter(revision=>revision.service===name.slice(0,-'/revisions'.length))});
      if(runServices.has(name))runServiceReadHook?.(name,runServices.get(name));
      const value=runServices.get(name)??runRevisions.get(name);return value?json(value):json({error:{status:'NOT_FOUND'}},404);
    }
    if(target.hostname==='sqladmin.googleapis.com')return json({name:'sodc-web-instance',state:'RUNNABLE',region:'europe-west2',settings:{backupConfiguration:{enabled:protectedDatabase,pointInTimeRecoveryEnabled:protectedDatabase},deletionProtectionEnabled:protectedDatabase}});
    if(target.pathname.endsWith('/schemas/main'))return json({name:base+'/schemas/main',datasources:[{postgresql:{cloudSql:{instance:`projects/${project}/locations/europe-west2/instances/sodc-web-instance`}}}],source:{files:schema}});
    if(target.pathname.endsWith('/connectors/api'))return json({name:base+'/connectors/api',source:{files:api}});
    if(target.pathname.endsWith('/connectors/authorization-service'))return json({name:base+'/connectors/authorization-service',source:{files:authorization}});
    if(target.pathname.endsWith('/functions'))return json({functions:functionNames.map(name=>({name:`projects/${project}/locations/europe-west2/functions/${name}`,environment:'GEN_2',state:functionStates.get(name)??'ACTIVE',updateTime:functionUpdateTimes.get(name),buildConfig:{runtime:'nodejs24',entryPoint:name,source:{storageSource:{bucket:'source-bucket',object:functionSources.get(name)??'reviewed.zip',generation:'1'}}},serviceConfig:{service:serviceResource(name),revision:functionRevisions.get(name),uri:`https://${name}.a.run.app`,serviceAccountEmail:'123456789-compute@developer.gserviceaccount.com',timeoutSeconds:name==='recoverNotificationDeliveries'?scheduledTimeout:60,environmentVariables:{NEVER_PERSIST:'secret-value'}}}))});
    if(target.pathname.endsWith('/jobs'))return json({jobs});throw Error('UNEXPECTED_OFFLINE_METADATA');
  };
  const plan={schemaVersion:1,projectId:project,environment:'dev',gitSha:sha,runId:'offline-test',installation:'strict',operator:'reviewer',reason:'reviewed test',importAdmins:false,artifactDirectory:path.join(directory,'artifacts'),createdAt:at,phaseOperationIds:{'control-create':'stable-control',backfill:'stable-backfill',activate:'stable-activate'}};
  const adapter=createCloudMigrationAdapter({repositoryRoot,runDirectory,plan,command,fetch,adminFactory,now:()=>new Date(milliseconds)});
  const gates={backup:{details:{waiverReference:'user-dev-waiver'}},'freeze-scope':{details:{entrypoints:[...SECURITY_WRITERS],jobNames:jobs.map(job=>job.name),externalWritersReference:'approved-inventory',probeUserId:member.id,probeReference:'approved-existing-profile'}}};
  return {adapter,plan,gates,commands,requests,runDirectory,policies,jobs,member,runServices,runRevisions,missingRunResources,approveSuccessors,maintainAndRetire,deployRevision,onRunServiceRead:hook=>runServiceReadHook=hook,onBootstrap:hook=>bootstrapHook=hook,setAuthorityPending:(pending,operationId='stable-backfill:'+member.id)=>{pendingCount=pending?1:0;runtimeSyncStatus=pending?'PENDING':'READY';pendingOperationId=operationId;},context:baseline=>({baseline,gates,planHash:stableHash(plan)}),advance:seconds=>milliseconds+=seconds*1000,changeAuthority:()=>authorityVersion++,setApi:next=>api=next,getApi:()=>api,setFunctionState:(name,state)=>functionStates.set(name,state),setFunctionSource:(name,source)=>functionSources.set(name,source),onDeferredDeploy:hook=>deferredHook=hook,failRestore:()=>failNextRestore=true,addLatentAdmin:()=>{extraIdentities.push({uid:'unapproved-latent',disabled:true,emailVerified:false,customClaims:{admin:true}});extraProfiles.push({id:'unapproved-latent',membershipStatus:'PENDING'});}};
}
function withProbe(t){for(const [key,value]of Object.entries({AUTHORIZATION_MIGRATION_PROBE_TOKEN:'PRIVATE-PROBE-JWT',AUTHORIZATION_MIGRATION_PROBE_API_KEY:'PRIVATE-API-KEY',AUTHORIZATION_MIGRATION_PROBE_APP_CHECK_TOKEN:'PRIVATE-APP-CHECK'})){const before=process.env[key];process.env[key]=value;t.onTestFinished(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});}}

test('IAM freeze removes only public invokers and keeps conditional service authority',()=>{
  const original=structuredClone(policy);original.bindings.push({role:'roles/run.invoker',members:['allUsers','serviceAccount:conditional@example.invalid'],condition:{expression:'true',title:'retained'}});
  const frozen=frozenInvokerPolicy(original);assert.equal(hasPublicInvoker(frozen),false);assert.deepEqual(frozen.bindings[0].members,['serviceAccount:runtime@example.invalid']);assert.deepEqual(frozen.bindings[2].condition,{expression:'true',title:'retained'});assert.equal(hasPublicInvoker(original),true);
});
test('IAM writes require etag and refuse unreviewed public roles',()=>{assert.throws(()=>frozenInvokerPolicy({bindings:[]}),/IAM_ETAG_REQUIRED/);assert.throws(()=>frozenInvokerPolicy({etag:'a',bindings:[{role:'roles/owner',members:['allUsers']}]}),/UNEXPECTED_PUBLIC_IAM_ROLE/);assert.throws(()=>restoreInvokerPolicy({},policy),/IAM_ETAG_REQUIRED/);});
test('restore merges original public invoker conditions into fresh policy',()=>{const current=frozenInvokerPolicy(policy);current.etag='fresh';current.bindings.push({role:'roles/run.invoker',members:['user:new@example.invalid'],condition:{expression:'true',title:'new'}});const restored=restoreInvokerPolicy(current,policy);assert.equal(restored.etag,'fresh');assert.ok(restored.bindings.some(binding=>binding.members.includes('user:new@example.invalid')));assert.ok(hasPublicInvoker(restored));assert.ok(!hasPublicInvoker(current));});
test('additive SQL review allows foreign key ON DELETE but rejects destructive and procedural statements',()=>{
  assert.doesNotThrow(()=>assertAdditiveSql([{sql:'ALTER TABLE security ADD CONSTRAINT owner FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE;'}]));
  for(const sql of ['DROP TABLE users;','DELETE FROM users;','CREATE TABLE x(id INT); UPDATE users SET name=\'x\';','ALTER TABLE users ALTER COLUMN name TYPE text;','ALTER TABLE users ALTER COLUMN name SET NOT NULL;','DO $$ BEGIN EXECUTE \'something\'; END $$;'])assert.throws(()=>assertAdditiveSql([{sql}]),/SQL_REVIEW_REQUIRED/);
});
test('IAM refusal is distinct from ordinary callable role denial or malformed requests',()=>{assert.equal(isPlatformIamRefusal(403,'application/json','{"error":{"status":"PERMISSION_DENIED"}}'),false);assert.equal(isPlatformIamRefusal(401,'text/html','<html><title>Error: Forbidden</title></html>'),false);assert.equal(isPlatformIamRefusal(400,'text/html','<html>Error: Forbidden</html>'),false);assert.equal(isPlatformIamRefusal(403,'text/html','<html>ordinary application response</html>'),false);assert.equal(isPlatformIamRefusal(403,'text/html','<html><title>Error: Forbidden</title></html>'),true);});
test('new repair endpoints are deferred but existing endpoints stay in update set',()=>{const names=['grantAdmin','getMyAuthorizationStatus','reconcilePendingSecurityTransitions'];assert.deepEqual(selectStagedFunctions(names,[]),['grantAdmin']);assert.deepEqual(selectStagedFunctions(names,['getMyAuthorizationStatus']),['grantAdmin','getMyAuthorizationStatus']);});
test('source comparison ignores file ordering only',()=>{assert.equal(sourceHash([{path:'b.gql',content:'b'},{path:'a.gql',content:'a'}]),sourceHash([{path:'a.gql',content:'a'},{path:'b.gql',content:'b'}]));assert.notEqual(sourceHash([{path:'a.gql',content:'a'}]),sourceHash([{path:'a.gql',content:'a\n'}]));});
test('factory is lazy and rejects implicit/unreviewed targets',()=>{let calls=0;const options={repositoryRoot,runDirectory:'/private/tmp/offline-unused',plan:{projectId:project,gitSha:sha},command:()=>calls++};createCloudMigrationAdapter(options);assert.equal(calls,0);assert.throws(()=>createCloudMigrationAdapter({...options,plan:{projectId:'production',gitSha:sha}}),/EXPLICIT_SUPPORTED_PROJECT_REQUIRED/);assert.throws(()=>createCloudMigrationAdapter({...options,plan:{projectId:project,gitSha:'main'}}),/REVIEWED_SHA_REQUIRED/);});
for(const [name,options,code]of [['Node24',{runtime:'v22.1.0'},'NODE_24_REQUIRED'],['pinned Firebase',{firebaseVersion:'15.22.4'},'FIREBASE_15_22_3_REQUIRED'],['preenabled APIs',{missingApi:true},'REQUIRED_APIS_NOT_ENABLED']])test(name+' failure blocks before authority reads or mutations',async t=>{const fixture=await setup(t,options);await assert.rejects(fixture.adapter.observe(),new RegExp(code));assert.equal(fixture.requests.length,0);assert.equal(fixture.commands.some(item=>item.args.includes('set-iam-policy')||item.args.includes('deploy')),false);});
test('observe returns durable-safe aggregate and selected metadata, never raw member or secret records',async t=>{const fixture=await setup(t);const observed=await fixture.adapter.observe();const serialized=JSON.stringify(observed);assert.equal(observed.projectNumber,'123456789');assert.equal(observed.authority.counts.identities,1);for(const forbidden of ['private.member@example.invalid','Sensitive','sensitive-service','NEVER-PERSIST-PASSWORD-HASH','customClaims','secret-value','PRIVATE-ADC-ACCESS-TOKEN'])assert.ok(!serialized.includes(forbidden),forbidden);assert.equal(observed.databaseProtection.pointInTimeRecovery,true);});
test('inspection produces immutable reviewed SQL and sealed source artifacts without cloud mutations',async t=>{const fixture=await setup(t);const result=await fixture.adapter.perform('inspect',{planHash:stableHash(fixture.plan)});assert.equal(result.baseline.projectId,project);assert.equal(result.sqlDiff.diffSha256,stableHash([]));assert.equal(fixture.commands.some(item=>item.args.includes('set-iam-policy')||item.args.includes('deploy')),false);const verification=await fixture.adapter.verify('inspect',{result,planHash:stableHash(fixture.plan)});assert.equal(verification.ok,true);assert.equal(verification.evidence.runId,fixture.plan.runId);assert.equal(verification.evidence.planHash,stableHash(fixture.plan));});
test('freeze persists originals before mutation, preserves drain clock on retry and proves signed ingress refusals',async t=>{
  withProbe(t);const fixture=await setup(t);const baseline=await fixture.adapter.observe();const context=fixture.context(baseline);const first=await fixture.adapter.perform('freeze',context);assert.equal(fixture.policies.size,10);assert.ok([...fixture.policies.values()].every(item=>!hasPublicInvoker(item)));assert.equal(fixture.jobs[0].state,'PAUSED');assert.deepEqual(JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8')).originalPolicies,baseline.policies);
  const pre=await fixture.adapter.verify('freeze',{...context,result:first});assert.equal(pre.ok,false);assert.ok(pre.blockers.includes('drainComplete'));assert.equal(fixture.requests.some(item=>item.method==='POST'),false);
  const writes=fixture.commands.filter(item=>item.args.includes('set-iam-policy')||item.args.includes('deploy')||item.args.includes('pause')).length;fixture.advance(76);const second=await fixture.adapter.perform('freeze',context);assert.equal(second.drainUntil,first.drainUntil);assert.equal(fixture.commands.filter(item=>item.args.includes('set-iam-policy')||item.args.includes('deploy')||item.args.includes('pause')).length,writes);
  const unproven=await fixture.adapter.verify('freeze',{...context,result:second});assert.equal(unproven.ok,false);assert.ok(unproven.blockers.includes('oldWritersRetired'));assert.ok(unproven.blockers.includes('drainComplete'));
  await fixture.maintainAndRetire(context);const beforeRequests=fixture.requests.length;
  const verification=await fixture.adapter.verify('freeze',{...context,result:second});assert.equal(verification.ok,true);assert.equal(fixture.requests.slice(beforeRequests).filter(item=>item.method==='POST').length,2);assert.equal(fixture.requests.slice(beforeRequests).filter(item=>item.hostname.endsWith('.cloudfunctions.net')&&item.method==='GET').length,10);
  const savedProof=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-old-writers-proof.json'),'utf8'));
  assert.equal(verification.evidence.oldWriterProofHash,savedProof.proofHash);assert.equal(verification.evidence.oldWriterGateHash,savedProof.gateHash);
  assert.equal(savedProof.gateHash,stableHash(context.gates['old-writers']));
  const inventory=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8')).oldWriterInventory;
  assert.equal(inventory.services.length,11);assert.ok(inventory.services.some(service=>service.name.endsWith('/recovernotificationdeliveries')));
  const evidence=await readFile(path.join(fixture.runDirectory,'provider-old-writers-observed.json'),'utf8');assert.ok(!evidence.includes('secret-value'));assert.ok(!evidence.includes('NEVER_PERSIST'));
  for(const invocation of fixture.commands){assert.ok(!JSON.stringify(invocation.args).includes('PRIVATE-'));assert.equal(invocation.options.env.AUTHORIZATION_MIGRATION_PROBE_TOKEN,undefined);}
});
test('ordinary callable permission denial fails the signed freeze gate',async t=>{withProbe(t);const fixture=await setup(t,{callableRoleDenial:true});const context=fixture.context(await fixture.adapter.observe());const result=await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);fixture.advance(76);const verification=await fixture.adapter.verify('freeze',{...context,result});assert.equal(verification.ok,false);assert.ok(verification.blockers.includes('signedRefusalVerified'));assert.equal(verification.evidence.assertions.oldWritersRetired,true);});
test('wrong project token and invalid attestation block before any freeze mutation',async t=>{withProbe(t);for(const options of [{claimsOverride:{aud:'wrong-project'}},{appCheckInvalid:true}]){const fixture=await setup(t,options);const context=fixture.context(await fixture.adapter.observe());await assert.rejects(fixture.adapter.perform('freeze',context),/SIGNED_PROBE_/);assert.ok([...fixture.policies.values()].every(hasPublicInvoker));assert.equal(fixture.commands.some(item=>item.args.includes('set-iam-policy')||item.args.includes('deploy')),false);}});
test('tampering original restoration policies is detected before subsequent mutation',async t=>{withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());await fixture.adapter.perform('freeze',context);const filename=path.join(fixture.runDirectory,'provider-freeze.json');const state=JSON.parse(await readFile(filename,'utf8'));state.originalPolicies[0].policy.bindings[0].members.push('allUsers-extra');await writeFile(filename,JSON.stringify(state));await assert.rejects(fixture.adapter.perform('freeze',context),/ORIGINAL_FREEZE_SNAPSHOT_CHANGED/);});
test('a strict installation never deploys a compatibility connector',async t=>{withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);await assert.rejects(fixture.adapter.perform('compatibility',context),/STRICT_INSTALLATION_CANNOT_DOWNGRADE/);assert.ok(fixture.getApi().every(file=>!file.content.includes('this-never-existed')));assert.deepEqual(fixture.getApi(),denyOnboarding(context.baseline.api.files));});
test('drain includes the longest scheduled worker and pending durable work blocks proof',async t=>{withProbe(t);const fixture=await setup(t,{scheduledTimeout:300,pendingTransitions:1});const context=fixture.context(await fixture.adapter.observe());const result=await fixture.adapter.perform('freeze',context);assert.equal(new Date(result.drainUntil)-new Date(result.completedAt),315000);fixture.advance(400);const verification=await fixture.adapter.verify('freeze',{...context,result});assert.equal(verification.ok,false);assert.ok(verification.blockers.includes('drainComplete'));assert.equal(fixture.requests.some(item=>item.hostname.endsWith('.cloudfunctions.net')),false);});

async function staged(t,options={}){withProbe(t);const fixture=await setup(t,{auditReady:true,fullFunctions:true,...options});const context=fixture.context(await fixture.adapter.observe());const freeze=await fixture.adapter.perform('freeze',context);context.checkpoints={freeze:{result:freeze}};await fixture.maintainAndRetire(context);fixture.advance(76);const functions=await fixture.adapter.perform('functions',context);context.checkpoints.functions={result:functions};await fixture.approveSuccessors(context);context.gates.acceptance={details:{sourceProjectId:project}};return {fixture,context};}
const mutationCount=fixture=>fixture.commands.filter(item=>item.args.includes('deploy')||item.args.includes('set-iam-policy')||item.args.includes('resume')).length;
test('pinned CLI preload denies destructive methods and API enabling without a network call',async t=>{const fixture=await setup(t);await fixture.adapter.perform('inspect',{planHash:stableHash(fixture.plan)});const guard=path.join(fixture.runDirectory,'provider-cli-guard.cjs');const code="const{createRequire}=require('node:module');const r=createRequire(process.argv[1]);const c=r('../dataconnect/client.js');const a=r('../ensureApiEnabled.js');Promise.all([c.deleteConnector().then(()=>{throw Error('accepted')},e=>{if(e.message!=='DATACONNECT_DELETION_FORBIDDEN')throw e;}),a.enableApiURI('sodc-web','run.googleapis.com').then(()=>{throw Error('accepted')},e=>{if(e.message!=='API_ENABLEMENT_FORBIDDEN')throw e;}),a.ensure('wrong-project','run.googleapis.com').then(()=>{throw Error('accepted')},e=>{if(e.message!=='API_ENABLEMENT_FORBIDDEN')throw e;}),a.ensure('123456789','run.googleapis.com')]).catch(()=>process.exitCode=1);";const runtime=fixture.commands.find(item=>item.args.includes('dataconnect:sql:diff')).args[2];execFileSync(process.execPath,['--require',guard,'-e',code,runtime],{stdio:'pipe'});});
test('SQL review mismatch blocks migration before SQL apply or schema deployment',async t=>{withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);context.reviewedSqlHash='0'.repeat(64);const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('schema',context),/FRESH_SQL_REVIEW_HASH_REQUIRED/);assert.equal(mutationCount(fixture),before);assert.equal(fixture.commands.some(item=>item.args.includes('dataconnect:sql:migrate')),false);});
test('new ineligible legacy admin role is blocked before bootstrap',async t=>{withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);fixture.addLatentAdmin();const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('backfill',context),/UNAPPROVED_LATENT_ADMIN_ROSTER/);assert.equal(mutationCount(fixture),before);assert.equal(fixture.commands.some(item=>item.args.some(arg=>arg.endsWith('security-state-admin.ts'))),false);});
test('non-Dev backup gate requires actual database resilience, beyond references',async t=>{withProbe(t);const fixture=await setup(t,{projectId:'sodc-web-beta',protectedDatabase:false});const context=fixture.context(await fixture.adapter.observe());context.gates.backup={details:{backupReference:'approved-backup',restoreTestReference:'approved-isolated-restore'}};await assert.rejects(fixture.adapter.perform('freeze',context),/DATABASE_RESILIENCE_NOT_VERIFIED/);assert.equal(mutationCount(fixture),0);});
test('open refuses staged source drift before deferred deployment or any opening mutation',async t=>{const {fixture,context}=await staged(t);fixture.setFunctionSource('grantAdmin','unreviewed.zip');const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('open',context),/OLD_WRITER_REVIEWED_SERVING_FUNCTION_REQUIRED/);assert.equal(mutationCount(fixture),before);assert.ok([...fixture.policies.values()].every(item=>!hasPublicInvoker(item)));});
test('non-active deferred function blocks API and IAM opening and keeps new scheduler absent',async t=>{const {fixture,context}=await staged(t);fixture.setFunctionState('getMyAuthorizationStatus','DEPLOYING');const beforeApi=fixture.commands.filter(item=>item.args.includes('dataconnect:sodc-web-service:api')).length;await assert.rejects(fixture.adapter.perform('open',context),/DEFERRED_BOUNDARY_NOT_VERIFIED/);assert.equal(fixture.commands.filter(item=>item.args.includes('dataconnect:sodc-web-service:api')).length,beforeApi);assert.equal(fixture.jobs.find(job=>job.name.includes('reconcilePendingSecurityTransitions')),undefined);assert.ok(SECURITY_WRITERS.every(name=>!hasPublicInvoker(fixture.policies.get(name))));});
test('staged source is rechecked after deferred deployment before opening API',async t=>{const {fixture,context}=await staged(t);fixture.onDeferredDeploy(()=>fixture.setFunctionSource('grantAdmin','changed-during-deferred.zip'));const beforeApi=fixture.commands.filter(item=>item.args.includes('dataconnect:sodc-web-service:api')).length;await assert.rejects(fixture.adapter.perform('open',context),/DEFERRED_BOUNDARY_NOT_VERIFIED/);assert.equal(fixture.commands.filter(item=>item.args.includes('dataconnect:sodc-web-service:api')).length,beforeApi);});
test('interrupted opening resumes stable deferred proof, restores original policy and independently verifies receipt',async t=>{const {fixture,context}=await staged(t);fixture.failRestore();await assert.rejects(fixture.adapter.perform('open',context),/PROVIDER_COMMAND_FAILED/);assert.deepEqual(fixture.getApi(),context.baseline.api.files);const deploymentCount=fixture.commands.filter(item=>item.args.includes('deploy')).length;const result=await fixture.adapter.perform('open',context);assert.equal(fixture.commands.filter(item=>item.args.includes('deploy')).length,deploymentCount);const verification=await fixture.adapter.verify('open',{...context,result});assert.equal(verification.ok,true);context.checkpoints.open={result};const receipt=await fixture.adapter.verify('receipt',context);assert.equal(receipt.ok,true);fixture.setFunctionSource('grantAdmin','late-change.zip');await assert.rejects(fixture.adapter.verify('receipt',context),/OLD_WRITER_REVIEWED_SERVING_FUNCTION_REQUIRED/);});
test('sealed artifacts recover when journal persistence was interrupted',async t=>{const fixture=await setup(t);const first=await fixture.adapter.perform('inspect',{planHash:stableHash(fixture.plan)});await rm(path.join(fixture.runDirectory,'provider-artifacts.json'));const second=await fixture.adapter.perform('inspect',{planHash:stableHash(fixture.plan)});assert.equal(first.sqlDiff.diffSha256,second.sqlDiff.diffSha256);assert.equal(mutationCount(fixture),0);});
test('same-credential positive query failure prevents an ambiguous onboarding refusal proof',async t=>{withProbe(t);const fixture=await setup(t,{positiveQueryDenied:true});const context=fixture.context(await fixture.adapter.observe());const result=await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);fixture.advance(76);const verified=await fixture.adapter.verify('freeze',{...context,result});assert.equal(verified.ok,false);assert.ok(verified.blockers.includes('signedRefusalVerified'));assert.equal(fixture.requests.filter(item=>item.path.endsWith(':executeMutation')).length,0);});
test('OIDC job configuration crosses the durable credential guard without recording token-shaped keys',async t=>{const {fixture,context}=await staged(t);const observed=await fixture.adapter.observe();assert.doesNotThrow(()=>assertNoCredentials(observed));assert.doesNotThrow(()=>assertNoCredentials(context.checkpoints.functions.result));assert.equal(context.checkpoints.functions.result.schedulerIntents.length,1);assert.equal(JSON.stringify(context.checkpoints.functions.result).includes('oidcToken'),false);assert.equal(fixture.jobs.find(job=>job.name.includes('reconcilePendingSecurityTransitions')),undefined);});
test('final scheduler proof rejects deadline and explicitly configured retry drift',async t=>{const {fixture,context}=await staged(t);const result=await fixture.adapter.perform('open',context);context.checkpoints.open={result};assert.equal((await fixture.adapter.verify('receipt',context)).ok,true);const job=fixture.jobs.find(job=>job.name.includes('reconcilePendingSecurityTransitions'));job.attemptDeadline='30s';assert.ok((await fixture.adapter.verify('receipt',context)).blockers.includes('schedulersVerified'));job.attemptDeadline='1800s';job.retryConfig.retryCount=99;assert.ok((await fixture.adapter.verify('receipt',context)).blockers.includes('schedulersVerified'));});
test('all newly created reviewed schedulers restore ENABLED and paused notification recovery fails receipt',async t=>{const {fixture,context}=await staged(t,{notificationJobExists:false,createJobsPaused:true});assert.equal(fixture.jobs.length,0);const result=await fixture.adapter.perform('open',context);context.checkpoints.open={result};assert.ok(fixture.jobs.every(job=>job.state==='ENABLED'));assert.equal((await fixture.adapter.verify('receipt',context)).ok,true);fixture.jobs.find(job=>job.name.includes('recoverNotificationDeliveries')).state='PAUSED';assert.ok((await fixture.adapter.verify('receipt',context)).blockers.includes('schedulersVerified'));});

test('missing old-writer gate blocks every post-freeze mutation despite an elapsed timer and zero pending rows',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  const freeze=await fixture.adapter.perform('freeze',context);context.checkpoints={freeze:{result:freeze}};fixture.advance(3600);
  const verified=await fixture.adapter.verify('freeze',{...context,result:freeze});assert.equal(verified.ok,false);
  assert.ok(verified.blockers.includes('oldWritersRetired'));assert.ok(verified.blockers.includes('drainComplete'));
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('control-create',context),/OLD_WRITER_GATE_REQUIRED/);
  assert.equal(mutationCount(fixture),before);
});

test('an admitted old handler can remain active after timeout and a typed gate cannot override it',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  const freeze=await fixture.adapter.perform('freeze',context);context.checkpoints={freeze:{result:freeze}};
  await fixture.maintainAndRetire(context,{retire:false});fixture.advance(3600);
  const verified=await fixture.adapter.verify('freeze',{...context,result:freeze});assert.equal(verified.ok,false);
  assert.equal(verified.observed.authority.counts.pendingTransitions,0);assert.equal(verified.observed.authority.violations.nonReadyStates,0);
  assert.ok(verified.blockers.includes('oldWritersRetired'));assert.ok(verified.blockers.includes('drainComplete'));
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('schema',context),/OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED/);
  assert.equal(mutationCount(fixture),before);
});

for(const field of ['freezeStateHash','inventoryHash'])test('old-writer '+field+' mismatch refuses before any later provider write',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);context.gates['old-writers'].details[field]='0'.repeat(64);
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('strict-api',context),/OLD_WRITER_GATE_BINDING_MISMATCH/);
  assert.equal(mutationCount(fixture),before);
});

test('a missing exact original revision GET is not retirement proof',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);
  const state=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8'));
  fixture.missingRunResources.add(state.oldWriterInventory.services[0].revisions[0].name);
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('strict-api',context),/CLOUD_METADATA_READ_FAILED/);
  assert.equal(mutationCount(fixture),before);
});

test('an unreviewed successor appearing after the gate stops schema or authority mutation',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);
  fixture.deployRevision('grantAdmin','unknown-external-deployment');
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('strict-api',context),/OLD_WRITER_REVISION_SET_CHANGED/);
  assert.equal(mutationCount(fixture),before);
});

for(const [label,change]of [
  ['generation',service=>{service.generation=String(Number(service.generation)+1);service.observedGeneration=service.generation;}],
  ['latest revision',(service,original)=>{service.latestCreatedRevision=original;}],
  ['traffic',(service,original)=>{service.traffic.push({type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:original,percent:0,tag:'old'});}],
])test('a mid-read '+label+' change prevents cutover before any provider mutation',async t=>{
  withProbe(t);const fixture=await setup(t);const context=fixture.context(await fixture.adapter.observe());
  await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);
  const state=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8'));
  const target=state.oldWriterInventory.services[0];let reads=0;
  fixture.onRunServiceRead((name,service)=>{if(name===target.name&&++reads===2)change(service,target.revisions[0].name);});
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('strict-api',context),/OLD_WRITER_SERVICE_CHANGED_DURING_READ/);
  assert.equal(reads,2);assert.equal(mutationCount(fixture),before);
});

test('candidate deployment requires a separate successor review and retry never redeploys completed Functions',async t=>{
  withProbe(t);const fixture=await setup(t,{auditReady:true,fullFunctions:true});const context=fixture.context(await fixture.adapter.observe());
  const freeze=await fixture.adapter.perform('freeze',context);context.checkpoints={freeze:{result:freeze}};
  await fixture.maintainAndRetire(context);fixture.advance(76);
  const functions=await fixture.adapter.perform('functions',context);context.checkpoints.functions={result:functions};
  await assert.rejects(fixture.adapter.verify('functions',{...context,result:functions}),/OLD_WRITER_REVIEWED_SERVING_REVISIONS_REQUIRED/);
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('functions',context),/OLD_WRITER_REVIEWED_SERVING_REVISIONS_REQUIRED/);
  assert.equal(mutationCount(fixture),before);
  await fixture.approveSuccessors(context);
  const retried=await fixture.adapter.perform('functions',context);assert.deepEqual(retried,functions);
  assert.equal(mutationCount(fixture),before);assert.equal((await fixture.adapter.verify('functions',{...context,result:retried})).ok,true);
});

test('a completed strict API checkpoint cannot skip fresh original-revision proof on retry',async t=>{
  const {fixture,context}=await staged(t);const result=await fixture.adapter.perform('strict-api',context);
  assert.ok(result.completedAt);const state=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8'));
  const original=fixture.runRevisions.get(state.oldWriterInventory.services[0].revisions[0].name);
  original.conditions[1]={type:'Active',state:'CONDITION_SUCCEEDED'};
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('strict-api',context),/OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED/);
  assert.equal(mutationCount(fixture),before);
});

test('final receipt independently rechecks original retirement after successful opening',async t=>{
  const {fixture,context}=await staged(t);const result=await fixture.adapter.perform('open',context);context.checkpoints.open={result};
  assert.equal((await fixture.adapter.verify('receipt',context)).ok,true);
  const state=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8'));
  fixture.runRevisions.get(state.oldWriterInventory.services[0].revisions[0].name).conditions[1]={type:'Active',state:'CONDITION_SUCCEEDED'};
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.verify('receipt',context),/OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED/);
  await assert.rejects(fixture.adapter.perform('receipt',context),/OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED/);
  assert.equal(mutationCount(fixture),before);
});

function reviewedMaintenance(fixture,context){
  const service=[...fixture.runServices.values()].find(service=>service.name.endsWith('/grantadmin'));
  const revisions=[...fixture.runRevisions.values()].filter(revision=>revision.service===service.name);
  const original=revisions.find(revision=>revision.name.includes('-original-'));
  const maintenance=revisions.find(revision=>revision.name.includes('-reviewed-maintenance-'));
  const candidate=revisions.find(revision=>revision.name===service.latestCreatedRevision);
  assert.ok(original&&maintenance&&candidate);assert.equal(original.conditions[1].revisionReason,'RETIRED');
  assert.equal(context.checkpoints.functions.result.functionProofs.find(fn=>fn.name==='grantAdmin').revision,candidate.name.split('/').at(-1));
  assert.ok(context.gates['old-writers'].details.successorRevisions.some(revision=>revision.name===maintenance.name));
  assert.ok(context.gates['old-writers'].details.successorRevisions.some(revision=>revision.name===candidate.name));
  return {service,original,maintenance,candidate};
}

for(const [name,mutate,code]of [
  ['live maintenance despite candidate-only routing',({maintenance})=>{maintenance.conditions[1]={type:'Active',state:'CONDITION_SUCCEEDED'};},'OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED'],
  ['live maintenance serving all traffic and a tag',({service,maintenance})=>{maintenance.conditions[1]={type:'Active',state:'CONDITION_SUCCEEDED'};service.traffic=[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:maintenance.name,percent:100,tag:'legacy'}];service.trafficStatuses=structuredClone(service.traffic);},'OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED'],
  ['retired maintenance still configured for all traffic',({service,maintenance})=>{service.traffic=[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:maintenance.name,percent:100}];service.trafficStatuses=structuredClone(service.traffic);},'OLD_WRITER_OLD_TRAFFIC_OR_TAG'],
  ['retired maintenance retaining a zero-percent tag',({service,maintenance})=>{service.traffic.push({type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:maintenance.name,percent:0,tag:'legacy'});},'OLD_WRITER_OLD_TRAFFIC_OR_TAG'],
])test('opening rejects '+name+' before API, IAM or Scheduler reopening',async t=>{
  const {fixture,context}=await staged(t);const topology=reviewedMaintenance(fixture,context);mutate(topology);
  const before=mutationCount(fixture);const closedApi=structuredClone(fixture.getApi());
  await assert.rejects(fixture.adapter.perform('open',context),new RegExp(code));
  assert.equal(mutationCount(fixture),before);assert.deepEqual(fixture.getApi(),closedApi);
  assert.ok([...fixture.policies.values()].every(policy=>!hasPublicInvoker(policy)));assert.ok(fixture.jobs.every(job=>job.state==='PAUSED'));
});

test('opening succeeds only with source-bound candidate routing and retired maintenance predecessors',async t=>{
  const {fixture,context}=await staged(t);const topology=reviewedMaintenance(fixture,context);
  assert.equal(topology.maintenance.conditions[1].revisionReason,'RETIRED');
  assert.equal(topology.service.latestReadyRevision,topology.candidate.name);
  assert.ok(topology.service.trafficStatuses.every(target=>target.revision===topology.candidate.name));
  const result=await fixture.adapter.perform('open',context);context.checkpoints.open={result};
  const verification=await fixture.adapter.verify('receipt',context);assert.equal(verification.ok,true);
  const saved=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-old-writers-proof.json'),'utf8'));
  assert.equal(verification.evidence.oldWriterProofHash,saved.proofHash);assert.equal(verification.evidence.oldWriterGateHash,saved.gateHash);
});

test('backfill resumes its own committed pending work with the same operation while later phases remain blocked',async t=>{
  withProbe(t);const fixture=await setup(t,{auditReady:true});const context=fixture.context(await fixture.adapter.observe());
  const freeze=await fixture.adapter.perform('freeze',context);context.checkpoints={freeze:{result:freeze}};
  await fixture.maintainAndRetire(context);fixture.advance(76);assert.equal((await fixture.adapter.verify('freeze',{...context,result:freeze})).ok,true);
  let bootstrapCalls=0;
  fixture.onBootstrap(()=>{bootstrapCalls++;if(bootstrapCalls===1){fixture.setAuthorityPending(true);throw Error('transport failed after durable pending commit');}fixture.setAuthorityPending(false);});
  await assert.rejects(fixture.adapter.perform('backfill',context),/PROVIDER_COMMAND_FAILED/);assert.equal(bootstrapCalls,1);
  const pending=await fixture.adapter.observe();assert.equal(pending.authority.counts.pendingTransitions,1);assert.equal(pending.authority.violations.nonReadyStates,1);
  assert.equal((await fixture.adapter.verify('backfill',context)).ok,false);
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('functions',context),/OLD_WRITER_AUTHORITY_NOT_SETTLED/);
  assert.equal(mutationCount(fixture),before);assert.equal(bootstrapCalls,1);

  // The narrow resume exception does not waive fresh retirement or the frozen boundary.
  const frozenState=JSON.parse(await readFile(path.join(fixture.runDirectory,'provider-freeze.json'),'utf8'));
  const original=fixture.runRevisions.get(frozenState.oldWriterInventory.services[0].revisions[0].name);
  const retiredCondition=structuredClone(original.conditions[1]);original.conditions[1]={type:'Active',state:'CONDITION_SUCCEEDED'};
  await assert.rejects(fixture.adapter.perform('backfill',context),/OLD_WRITER_POSITIVE_RETIREMENT_REQUIRED/);assert.equal(bootstrapCalls,1);
  original.conditions[1]=retiredCondition;
  const frozenPolicy=structuredClone(fixture.policies.get('grantAdmin'));
  fixture.policies.get('grantAdmin').bindings.push({role:'roles/run.invoker',members:['allUsers']});
  await assert.rejects(fixture.adapter.perform('backfill',context),/FREEZE_NOT_PRESERVED/);assert.equal(bootstrapCalls,1);
  fixture.policies.set('grantAdmin',frozenPolicy);

  const result=await fixture.adapter.perform('backfill',context);assert.equal(bootstrapCalls,2);assert.ok(result.completedAt);
  assert.equal((await fixture.adapter.verify('backfill',{...context,result})).ok,true);
  const invocations=fixture.commands.filter(command=>command.args.some(arg=>arg.endsWith('/security-state-admin.ts')));
  assert.equal(invocations.length,2);assert.deepEqual(invocations.map(command=>command.args[command.args.indexOf('--operation-id')+1]),['stable-backfill','stable-backfill']);
  assert.deepEqual(invocations[0].args,invocations[1].args);
});

test('backfill cannot use its retry exception to absorb unrelated pending work',async t=>{
  withProbe(t);const fixture=await setup(t,{auditReady:true});const context=fixture.context(await fixture.adapter.observe());
  await fixture.adapter.perform('freeze',context);await fixture.maintainAndRetire(context);
  fixture.setAuthorityPending(true,'another-cutover:'+fixture.member.id);let bootstrapCalls=0;fixture.onBootstrap(()=>bootstrapCalls++);
  const before=mutationCount(fixture);await assert.rejects(fixture.adapter.perform('backfill',context),/UNREVIEWED_PENDING_BACKFILL_WORK/);
  assert.equal(bootstrapCalls,0);assert.equal(mutationCount(fixture),before);
  assert.equal(fixture.commands.some(command=>command.args.some(arg=>arg.endsWith('/security-state-admin.ts'))),false);
});
