import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,realpath,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {stableHash,classifyApi,denyOnboarding,prepareMigrationSources,verifyMigrationArtifact} from './authorization-migration-sources.mjs';
import {evaluateAuthority} from './authorization-migration-audit.mjs';
import {discoverFunctionContracts} from './deployment-check-lib.mjs';
import {captureOldWriterInventory,revisionIdentity,verifyOldWriterRetirement} from './authorization-migration-retirement.mjs';

const execFileAsync=promisify(execFile);
let adminSequence=0;
export const MIGRATION_REGION='europe-west2';
export const MIGRATION_SERVICE='sodc-web-service';
export const SECURITY_WRITERS=Object.freeze(['grantAdmin','revokeAdmin','updateMembershipStatus','resignMembership','updateUserEmail','requestEmailChange','requestEmailVerification','reconcileMyEmail','syncPendingUserClaims','confirmPotentialLostMember']);
export const DEFERRED_FUNCTIONS=Object.freeze(['getMyAuthorizationStatus','reconcilePendingSecurityTransitions']);
const SCHEDULED=Object.freeze(['recoverNotificationDeliveries','reconcilePendingSecurityTransitions']);
const PHASES=new Set(['inspect','freeze','schema','compatibility','control-create','backfill','functions','activate','strict-api','open','receipt']);
const PROJECTS=new Set(['sodc-web','sodc-web-beta','sodc-web-production']);
const PUBLIC=new Set(['allUsers','allAuthenticatedUsers']);
const REQUIRED_APIS=['firebasedataconnect.googleapis.com','sqladmin.googleapis.com','cloudfunctions.googleapis.com','run.googleapis.com','cloudscheduler.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','firebaseextensions.googleapis.com','cloudtasks.googleapis.com','eventarc.googleapis.com','pubsub.googleapis.com','storage.googleapis.com','secretmanager.googleapis.com'];
export class MigrationCloudError extends Error {constructor(code){super(code);this.name='MigrationCloudError';this.code=code;}}
const assert=(condition,code)=>{if(!condition)throw new MigrationCloudError(code);};
const date=value=>new Date(value).toISOString();
const resourceName=value=>typeof value==='string'?value.split('/').at(-1):null;
const deep=value=>JSON.parse(JSON.stringify(value));
const canonicalFiles=files=>files.map(({path:filename,content})=>({path:filename.replace(/^\.\//,''),content})).sort((a,b)=>a.path.localeCompare(b.path));
export const sourceHash=files=>stableHash(canonicalFiles(files));
export function frozenInvokerPolicy(policy){
  assert(policy?.etag,'IAM_ETAG_REQUIRED');const next=deep(policy);
  for(const binding of next.bindings??[]){
    assert(binding.role==='roles/run.invoker' || !(binding.members??[]).some(member=>PUBLIC.has(member)),'UNEXPECTED_PUBLIC_IAM_ROLE');
    if(binding.role==='roles/run.invoker')binding.members=(binding.members??[]).filter(member=>!PUBLIC.has(member));
  }
  next.bindings=(next.bindings??[]).filter(binding=>binding.members?.length);return next;
}
export function hasPublicInvoker(policy){return (policy?.bindings??[]).some(binding=>binding.role==='roles/run.invoker' && binding.members?.some(member=>PUBLIC.has(member)));}
export function restoreInvokerPolicy(current,original){
  assert(current?.etag,'IAM_ETAG_REQUIRED');const next=deep(current);next.bindings??=[];
  for(const binding of original?.bindings??[]){
    const members=binding.role==='roles/run.invoker'?(binding.members??[]).filter(member=>PUBLIC.has(member)):[];
    if(!members.length)continue;
    let target=next.bindings.find(item=>item.role===binding.role && stableHash(item.condition??null)===stableHash(binding.condition??null));
    if(!target){target={role:binding.role,members:[],...(binding.condition?{condition:binding.condition}:{})};next.bindings.push(target);}
    target.members=[...new Set([...target.members,...members])];
  }return next;
}
export function assertAdditiveSql(diffs){
  const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
  for(const sql of strings(diffs)){
    assert(!/\b(DROP|TRUNCATE|RENAME)\b/i.test(sql)&&!/(?:^|;)\s*(?:DELETE|UPDATE)\b/i.test(sql),'DESTRUCTIVE_SQL_REVIEW_REQUIRED');
    assert(!/\bALTER\s+(?:COLUMN|TYPE)\b|\bSET\s+NOT\s+NULL\b|\b(?:DO|EXECUTE|CREATE\s+(?:FUNCTION|PROCEDURE|TRIGGER))\b/i.test(sql),'NON_ADDITIVE_SQL_REVIEW_REQUIRED');
  }
}
export function isPlatformIamRefusal(status,contentType,body){return status===403&&String(contentType).includes('text/html')&&/<(?:html|title)\b/i.test(body)&&/Your client does not have permission|not have permission to access|Error: Forbidden/i.test(body);}
export function selectStagedFunctions(names,existing){return names.filter(name=>!DEFERRED_FUNCTIONS.includes(name)||existing.includes(name));}
async function commandDefault(file,args,options={}){
  try{const result=await execFileAsync(file,args,{cwd:options.cwd,env:options.env,timeout:options.timeoutMs??45_000,maxBuffer:32*1024*1024,shell:false});return {...result,code:0};}
  catch{throw new MigrationCloudError('PROVIDER_COMMAND_FAILED');}
}
async function adminDefault({projectId,repositoryRoot}){
  const require=createRequire(path.join(repositoryRoot,'functions/package.json'));
  const apps=require('firebase-admin/app');const app=apps.initializeApp({projectId,credential:apps.applicationDefault()},'migration-provider-'+process.pid+'-'+(++adminSequence));
  const auth=require('firebase-admin/auth').getAuth(app);
  const dc=require('firebase-admin/data-connect').getDataConnect({connector:'api',serviceId:MIGRATION_SERVICE,location:MIGRATION_REGION},app);
  const appCheck=require('firebase-admin/app-check').getAppCheck(app);
  return {auth,dc,appCheck,close:()=>apps.deleteApp(app)};
}
async function filesIn(directory,prefix=''){
  const result=[];for(const entry of await readdir(path.join(directory,prefix),{withFileTypes:true})){
    if(entry.isDirectory())result.push(...await filesIn(directory,path.posix.join(prefix,entry.name)));
    else if(entry.isFile()&&/\.(gql|graphql)$/.test(entry.name))result.push({path:path.posix.join(prefix,entry.name),content:await readFile(path.join(directory,prefix,entry.name),'utf8')});
  }return canonicalFiles(result);
}
function minimalFunction(fn){return {name:resourceName(fn.name),resource:fn.name,environment:fn.environment,state:fn.state,updateTime:fn.updateTime,runtime:fn.buildConfig?.runtime,entryPoint:fn.buildConfig?.entryPoint,source:fn.buildConfig?.source,revision:fn.serviceConfig?.revision,service:fn.serviceConfig?.service,uri:fn.serviceConfig?.uri,serviceAccountEmail:fn.serviceConfig?.serviceAccountEmail,timeoutSeconds:fn.serviceConfig?.timeoutSeconds??60};}
function typeFields(files,type){const block=files.map(file=>file.content).join('\n').match(new RegExp('type\\s+'+type+'\\b[^\\{]*\\{([\\s\\S]*?)^\\}','m'))?.[1];return block?new Set([...block.matchAll(/^\s+(\w+)\s*:/gm)].map(match=>match[1])):null;}

/** Cloud execution is lazy; importing/constructing an adapter performs no I/O or authentication. */
export function createCloudMigrationAdapter({repositoryRoot,runDirectory,plan,now=()=>new Date(),command=commandDefault,fetch:fetcher=globalThis.fetch,adminFactory=adminDefault}){
  assert(PROJECTS.has(plan?.projectId),'EXPLICIT_SUPPORTED_PROJECT_REQUIRED');
  assert(path.isAbsolute(repositoryRoot??'')&&path.isAbsolute(runDirectory??''),'ABSOLUTE_DIRECTORIES_REQUIRED');
  assert(/^[a-f0-9]{40}$/.test(plan.gitSha??''),'REVIEWED_SHA_REQUIRED');
  const project=plan.projectId;const base=`projects/${project}/locations/${MIGRATION_REGION}/services/${MIGRATION_SERVICE}`;
  let token;let tools;let raw;let lastObservation;
  const clock=()=>date(typeof now==='function'?now():now);
  const env=()=>{const values={...process.env,GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,CLOUDSDK_CORE_DISABLE_PROMPTS:'1',FIREBASE_CLI_DISABLE_UPDATE_CHECK:'1',CI:'1'};for(const key of Object.keys(values))if(key.startsWith('AUTHORIZATION_MIGRATION_PROBE_'))delete values[key];return values;};
  async function run(file,args,{cwd=repositoryRoot,timeoutMs=45_000,environment=env()}={}){
    assert(Array.isArray(args)&&args.every(arg=>typeof arg==='string'),'STRUCTURED_ARGUMENTS_REQUIRED');
    try{const result=await command(file,args,{cwd,env:environment,timeoutMs,shell:false});assert(result.code===undefined||result.code===0,'PROVIDER_COMMAND_FAILED');return typeof result==='string'?result:result.stdout??'';}
    catch(error){if(error instanceof MigrationCloudError)throw error;throw new MigrationCloudError('PROVIDER_COMMAND_FAILED');}
  }
  const gcloud=(args,options)=>run('gcloud',[...args,'--project',project,'--format=json','--quiet'],options).then(text=>JSON.parse(text));
  async function versions(){
    if(tools)return tools;
    assert(/^v24\./.test((await run(process.execPath,['--version'])).trim()),'NODE_24_REQUIRED');
    assert((await run('firebase',['--version'])).trim()==='15.22.3','FIREBASE_15_22_3_REQUIRED');
    const executable=await realpath((await run('which',['firebase'])).trim());
    tools={firebaseExecutable:executable,clientPath:path.resolve(path.dirname(executable),'../dataconnect/client.js'),ensureApiPath:path.resolve(path.dirname(executable),'../ensureApiEnabled.js'),schedulerPath:path.resolve(path.dirname(executable),'../gcp/cloudscheduler.js')};return tools;
  }
  async function accessToken(){if(!token)token=(await run('gcloud',['auth','print-access-token','--project',project])).trim();assert(token,'CLOUD_CREDENTIAL_REQUIRED');return token;}
  async function metadata(host,resource,allowMissing=false){
    const response=await fetcher(`https://${host}${resource}`,{method:'GET',headers:{Authorization:'Bearer '+await accessToken(),'X-Goog-User-Project':project},signal:AbortSignal.timeout(45_000),redirect:'error'});
    if(response.status===404&&allowMissing)return null;assert(response.ok,'CLOUD_METADATA_READ_FAILED');return response.json();
  }
  async function listMetadata(host,resource,key){
    const result=[];let cursor;const seen=new Set();do{const response=await metadata(host,resource+(resource.includes('?')?'&':'?')+'pageSize=1000'+(cursor?'&pageToken='+encodeURIComponent(cursor):''));assert(!response.unreachable?.length,'UNREACHABLE_CLOUD_RESOURCE');result.push(...response[key]??[]);cursor=response.nextPageToken;if(cursor){assert(!seen.has(cursor),'REPEATED_CLOUD_PAGE');seen.add(cursor);}}while(cursor);return result;
  }
  async function readAuthority(schemaFiles){
    const admin=await adminFactory({projectId:project,repositoryRoot});
    try{
      const identities=[];let cursor;const seen=new Set();do{const page=await admin.auth.listUsers(500,cursor);identities.push(...page.users);cursor=page.pageToken;if(cursor){assert(!seen.has(cursor),'REPEATED_AUTH_PAGE');seen.add(cursor);}}while(cursor);
      const query=async(text,variables)=>{const read=admin.dc.executeGraphqlRead??admin.dc.executeGraphql;return read.call(admin.dc,text,{variables});};
      const paged=async(table,selection,where='')=>{const rows=[];for(let offset=0;;offset+=1000){const response=await query(`query MigrationAudit($offset:Int!){${table}(${where}limit:1000,offset:$offset){${selection}}}`,{offset});const page=response.data?.[table];assert(Array.isArray(page),'AUTHORITY_PAGE_INVALID');rows.push(...page);if(page.length<1000)return rows;assert(offset<10_000_000,'AUTHORITY_PAGE_BOUND_EXCEEDED');}};
      const profiles=await paged('users','id email membershipStatus');
      const stateFields=typeFields(schemaFiles,'UserSecurityState');
      const selected=['securityVersion','membershipStatus','desiredEnabled','desiredAdmin','verificationEmail','accessReady','adminReady','operationId','syncStatus'].filter(field=>stateFields?.has(field));
      const states=stateFields?await paged('userSecurityStates','userId '+selected.join(' ')+' user {membershipStatus email}'):[];
      const pendingTransitions=typeFields(schemaFiles,'SecurityTransition')?await paged('securityTransitions','operationId userId','where:{syncStatus:{eq:PENDING}},'):[];
      const control=typeFields(schemaFiles,'AdminSafetyControl')?(await query('query MigrationControl{adminSafetyControl(key:{id:"site-wide"}){id version readyAdminCount status}}')).data.adminSafetyControl:null;
      return {identities,profiles,states,pendingTransitions,control};
    }finally{await admin.close?.();}
  }
  async function observe(){
    await versions();
    for(const[key,value]of Object.entries(process.env))assert(!key.endsWith('_EMULATOR_HOST')||!value,'EMULATOR_OVERRIDE_FORBIDDEN');
    for(const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT'])assert(!process.env[key]||process.env[key]===project,'PROJECT_ENVIRONMENT_CONFLICT');
    if(process.env.FIREBASE_CONFIG)assert(JSON.parse(process.env.FIREBASE_CONFIG).projectId===project,'FIREBASE_PROJECT_CONFLICT');
    const target=await gcloud(['projects','describe',project]);assert(target.projectId===project&&/^\d+$/.test(String(target.projectNumber)),'CLOUD_TARGET_IDENTITY_INVALID');
    const enabled=await gcloud(['services','list','--enabled']);const enabledApis=enabled.map(item=>item.config?.name??resourceName(item.name));
    const missingApis=REQUIRED_APIS.filter(api=>!enabledApis.includes(api));
    assert(!missingApis.length,'REQUIRED_APIS_NOT_ENABLED');
    const[schema,api,authorization,functions,jobs]=await Promise.all([
      metadata('firebasedataconnect.googleapis.com','/v1/'+base+'/schemas/main'),metadata('firebasedataconnect.googleapis.com','/v1/'+base+'/connectors/api'),metadata('firebasedataconnect.googleapis.com','/v1/'+base+'/connectors/authorization-service',true),
      listMetadata('cloudfunctions.googleapis.com',`/v2/projects/${project}/locations/${MIGRATION_REGION}/functions`,'functions'),listMetadata('cloudscheduler.googleapis.com',`/v1/projects/${project}/locations/${MIGRATION_REGION}/jobs`,'jobs')]);
    assert(schema.name===base+'/schemas/main'&&api.name===base+'/connectors/api'&&schema.source?.files?.length&&api.source?.files?.length,'DEPLOYED_SOURCES_REQUIRED');
    const postgres=schema.datasources?.find(source=>source.postgresql)?.postgresql;const instance=postgres?.cloudSql?.instance;
    let databaseProtection=null;
    if(instance){assert(instance.startsWith(`projects/${project}/`),'DATABASE_PROJECT_MISMATCH');const database=await metadata('sqladmin.googleapis.com',`/sql/v1beta4/projects/${project}/instances/${resourceName(instance)}`);assert(database.name===resourceName(instance)&&database.state==='RUNNABLE','EXISTING_RUNNABLE_DATABASE_REQUIRED');databaseProtection={instance:database.name,state:database.state,region:database.region,automatedBackups:database.settings?.backupConfiguration?.enabled===true,pointInTimeRecovery:database.settings?.backupConfiguration?.pointInTimeRecoveryEnabled===true,deletionProtection:database.settings?.deletionProtectionEnabled===true};}
    const selectedFunctions=functions.map(minimalFunction).sort((a,b)=>a.name.localeCompare(b.name));const requiredNames=[...SECURITY_WRITERS,'getMyAuthorizationStatus'];
    const policies=[];for(const fn of selectedFunctions.filter(fn=>requiredNames.includes(fn.name))){assert(fn.environment==='GEN_2'&&fn.service,'GEN_2_FREEZE_BOUNDARY_REQUIRED');const service=resourceName(fn.service);policies.push({functionName:fn.name,service,timeoutSeconds:fn.timeoutSeconds,policy:await gcloud(['run','services','get-iam-policy',service,'--region',MIGRATION_REGION])});}
    raw=await readAuthority(schema.source.files);
    const authority=evaluateAuthority({...raw,requireBackfill:false});
    const safeAuthority={passed:authority.passed,counts:authority.counts,violations:authority.violations,control:authority.control,backfillComplete:authority.backfillComplete,controlReady:authority.controlReady,private:{eligibleLegacyAdminUIDs:authority.private?.eligibleLegacyAdminUIDs??[],legacyAdminUIDs:authority.private?.legacyAdminUIDs??[],legacyAdminFingerprint:authority.private?.legacyAdminFingerprint??null,rosterFingerprint:authority.private?.rosterFingerprint??null}};
    const installation=classifyApi(api.source.files);
    const safeJobs=jobs.filter(job=>SCHEDULED.some(name=>resourceName(job.name)===`firebase-schedule-${name}-${MIGRATION_REGION}`)).map(job=>({name:job.name,state:job.state,schedule:job.schedule,timeZone:job.timeZone??null,retryConfig:job.retryConfig??{},attemptDeadline:job.attemptDeadline??null,targetFingerprint:stableHash(deep({httpTarget:job.httpTarget?{uri:job.httpTarget.uri,httpMethod:job.httpTarget.httpMethod,serviceAccount:job.httpTarget.oidcToken?.serviceAccountEmail,audience:job.httpTarget.oidcToken?.audience??null}:null,pubsubTarget:job.pubsubTarget?.topicName??null})),configurationHash:stableHash(deep({schedule:job.schedule,timeZone:job.timeZone,httpTarget:job.httpTarget,pubsubTarget:job.pubsubTarget,retryConfig:job.retryConfig,attemptDeadline:job.attemptDeadline}))})).sort((a,b)=>a.name.localeCompare(b.name));
    lastObservation={schemaVersion:'sodc-authorization-provider-observation/v1',projectId:project,projectNumber:String(target.projectNumber),gitSha:plan.gitSha,observedAt:clock(),installation,enabledApis,databaseProtection,schema:{name:schema.name,updateTime:schema.updateTime,files:canonicalFiles(schema.source.files)},api:{name:api.name,updateTime:api.updateTime,files:canonicalFiles(api.source.files)},authorization:authorization?{name:authorization.name,updateTime:authorization.updateTime,files:canonicalFiles(authorization.source?.files??[])}:null,functions:selectedFunctions,policies,jobs:safeJobs,authority:safeAuthority};
    return deep(lastObservation);
  }
  const safeFile=name=>path.join(runDirectory,name);
  async function load(name){try{return JSON.parse(await readFile(safeFile(name),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw new MigrationCloudError('PROVIDER_JOURNAL_INVALID');}}
  async function save(name,value){await mkdir(runDirectory,{recursive:true,mode:0o700});const temporary=safeFile(name+'.next');await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,safeFile(name));return value;}
  const planHash=context=>context?.planHash??stableHash(plan);
  const identity=context=>({projectId:project,gitSha:plan.gitSha,runId:plan.runId,planHash:planHash(context)});
  function checkJournal(value,context){assert(value&&value.projectId===project&&value.gitSha===plan.gitSha&&value.runId===plan.runId&&value.planHash===planHash(context),'PROVIDER_JOURNAL_IDENTITY_MISMATCH');return value;}
  async function artifacts(baseline){
    let prepared=await load('provider-artifacts.json');
    if(!prepared){
      assert(baseline&&baseline.installation===plan.installation,'BASELINE_INSTALLATION_REQUIRED');let existing=false;try{await readdir(plan.artifactDirectory);existing=true;}catch(error){if(error.code!=='ENOENT')throw error;}
      if(existing){
        prepared={directory:plan.artifactDirectory,installation:plan.installation,compatibilityFrozen:null};
        for(const[key,directory]of [['liveFrozen','live-frozen'],['strictFrozen','strict-frozen'],['strictOpen','strict-open'],...(plan.installation==='legacy'?[['compatibilityFrozen','compatibility-frozen']]:[])]){try{const artifact=await verifyMigrationArtifact({directory:path.join(plan.artifactDirectory,directory),projectId:project,gitSha:plan.gitSha,now:clock()});assert(artifact.manifest.installation===plan.installation&&artifact.manifest.kind===directory,'ARTIFACT_IDENTITY_MISMATCH');prepared[key]=artifact;}catch{throw new MigrationCloudError('INCOMPLETE_ARTIFACTS_PRESERVED_FOR_REVIEW');}}
        const live=await filesIn(path.join(prepared.liveFrozen.directory,'dataconnect/api'));assert(matches(live,denyOnboarding(baseline.api.files),'api'),'RECOVERED_ARTIFACT_BASELINE_MISMATCH');
      }else prepared=await prepareMigrationSources({repositoryRoot,artifactDirectory:plan.artifactDirectory,projectId:project,gitSha:plan.gitSha,installation:plan.installation,liveSchemaFiles:baseline.schema.files,liveApiFiles:baseline.api.files,now:clock()});
      await save('provider-artifacts.json',prepared);
    }
    for(const artifact of [prepared.liveFrozen,prepared.compatibilityFrozen,prepared.strictFrozen,prepared.strictOpen].filter(Boolean))await verifyMigrationArtifact({directory:artifact.directory,projectId:project,gitSha:plan.gitSha,now:clock()});
    return prepared;
  }
  async function guard(observed){
    const configured=JSON.parse(await readFile(path.join(repositoryRoot,'config/deployment-check.json'),'utf8'));
    assert((configured.requiredApis??[]).every(api=>observed.enabledApis.includes(api)),'REQUIRED_APIS_NOT_ENABLED');
    const runtime=await versions();const filename=safeFile('provider-cli-guard.cjs');
    // Pinned CLI internal contracts are checked at runtime; an upgrade cannot silently remove a guard.
    const content=`'use strict';\nconst client=require(${JSON.stringify(runtime.clientPath)});\nfor(const key of ['deleteConnector','deleteSchema','deleteService']){if(typeof client[key]!=='function')throw Error('PINNED_DELETE_GUARD_UNAVAILABLE');client[key]=async()=>{throw Error('DATACONNECT_DELETION_FORBIDDEN');};}\nconst apis=require(${JSON.stringify(runtime.ensureApiPath)});const approved=new Set(${JSON.stringify(observed.enabledApis)});const projects=new Set(${JSON.stringify([project,observed.projectNumber])});\nfor(const key of ['ensure','bestEffortEnsure']){if(typeof apis[key]!=='function')throw Error('PINNED_API_GUARD_UNAVAILABLE');apis[key]=async(p,uri)=>{const name=String(uri).replace(/^https?:\\/\\//,'').split('/')[0];if(!projects.has(String(p))||!approved.has(name))throw Error('API_ENABLEMENT_FORBIDDEN');return true;};}\nif(typeof apis.enableApiURI!=='function')throw Error('PINNED_API_GUARD_UNAVAILABLE');apis.enableApiURI=async()=>{throw Error('API_ENABLEMENT_FORBIDDEN');};\n`;
    const schedulerGuard=`\nconst fs=require('node:fs');const path=require('node:path');const scheduler=require(${JSON.stringify(runtime.schedulerPath)});if(typeof scheduler.createOrReplaceJob!=='function')throw Error('PINNED_SCHEDULER_GUARD_UNAVAILABLE');const originalScheduler=scheduler.createOrReplaceJob;const deferredNames=new Set(${JSON.stringify(SCHEDULED.map(name=>`projects/${project}/locations/${MIGRATION_REGION}/jobs/firebase-schedule-${name}-${MIGRATION_REGION}`))});scheduler.createOrReplaceJob=async(job)=>{if(!deferredNames.has(job.name))return originalScheduler(job);if(Object.keys(job).some(k=>!['name','timeZone','httpTarget','schedule','attemptDeadline','retryConfig'].includes(k))||!job.httpTarget||Object.keys(job.httpTarget).some(k=>!['uri','httpMethod','oidcToken'].includes(k))||!job.httpTarget.oidcToken||Object.keys(job.httpTarget.oidcToken).some(k=>!['serviceAccountEmail','audience'].includes(k)))throw Error('UNREVIEWED_SCHEDULER_SPEC');const value={projectId:${JSON.stringify(project)},gitSha:${JSON.stringify(plan.gitSha)},runId:${JSON.stringify(plan.runId)},planHash:${JSON.stringify(stableHash(plan))},job};const destination=path.join(${JSON.stringify(runDirectory)},'scheduler-'+job.name.split('/').pop()+'.json');const text=JSON.stringify(value);if(fs.existsSync(destination)){if(fs.readFileSync(destination,'utf8')!==text)throw Error('SCHEDULER_INTENT_CHANGED');return undefined;}const temporary=destination+'.next';const fd=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temporary,destination);return undefined;};\n`;
    await mkdir(runDirectory,{recursive:true,mode:0o700});await writeFile(filename,content+schedulerGuard,{mode:0o600});return filename;
  }
  async function firebase(args,observed,{cwd=repositoryRoot,timeoutMs=1_800_000}={}){
    const runtime=await versions();const preload=await guard(observed);
    return run(process.execPath,['--require',preload,runtime.firebaseExecutable,...args,'--project',project,'--non-interactive'],{cwd,timeoutMs});
  }
  async function deploy(only,artifact,observed){
    const args=['deploy','--only',only];if(artifact){await verifyMigrationArtifact({directory:artifact.directory,projectId:project,gitSha:plan.gitSha,now:clock()});args.push('--config',artifact.configPath,'--force');}
    await firebase(args,observed,{cwd:artifact?.directory??repositoryRoot});
  }
  const same=(a,b)=>sourceHash(a??[])===sourceHash(b??[]);
  const sectionFiles=(files,section)=>files.map(file=>({...file,path:file.path.replace(new RegExp('^(?:dataconnect/)?'+section+'/'),'')}));
  const matches=(actual,expected,section)=>same(sectionFiles(actual??[],section),sectionFiles(expected??[],section));
  const jobBase=name=>`firebase-schedule-${name}-${MIGRATION_REGION}`;
  const expectedJob=(snapshot,name)=>snapshot.jobs.find(job=>resourceName(job.name)===jobBase(name));
  const denied=files=>{try{return same(denyOnboarding(files),files);}catch{return false;}};
  const frozen=(observed,state)=>Boolean(state&&state.originalPolicies.every(original=>{
    const current=observed.policies.find(item=>item.functionName===original.functionName);return current&&!hasPublicInvoker(current.policy);
  })&&state.originalJobs.every(original=>observed.jobs.some(job=>job.name===original.name&&job.state==='PAUSED'))&&observed.jobs.every(job=>state.originalJobs.some(original=>original.name===job.name))&&denied(observed.api.files));
  async function freezeState(context){const state=checkJournal(await load('provider-freeze.json'),context);assert(stableHash(state.originalPolicies)===stableHash(context.baseline?.policies)&&stableHash(state.originalJobs)===stableHash(context.baseline?.jobs),'ORIGINAL_FREEZE_SNAPSHOT_CHANGED');const expected=context.checkpoints?.freeze?.result?.stateHash??context.result?.stateHash;if(expected)assert(stableHash(state)===expected,'FREEZE_JOURNAL_HASH_MISMATCH');return state;}
  function oldWriterServiceNames(observed){
    const names=new Set([...observed.policies.map(item=>item.functionName),...SCHEDULED.filter(name=>observed.functions.some(fn=>fn.name===name))]);
    const services=[...names].map(name=>{const fn=observed.functions.find(fn=>fn.name===name);assert(fn?.environment==='GEN_2'&&fn.service?.startsWith(`projects/${project}/locations/${MIGRATION_REGION}/services/`),'OLD_WRITER_SERVICE_REQUIRED');return fn.service;});
    return [...new Set(services)].sort();
  }
  async function boundedMap(items,operation){
    const result=new Array(items.length);let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{for(;;){const index=cursor++;if(index>=items.length)return;result[index]=await operation(items[index]);}}));return result;
  }
  async function readOldWriterServices(names,exactNames=[]){
    return boundedMap(names,async name=>{
      const [service,revisions]=await Promise.all([metadata('run.googleapis.com','/v2/'+name),listMetadata('run.googleapis.com','/v2/'+name+'/revisions','revisions')]);
      assert(service.name===name,'OLD_WRITER_SERVICE_SCOPE_INVALID');
      const exactRevisions=await boundedMap(exactNames.filter(revision=>revision.startsWith(name+'/revisions/')),revision=>metadata('run.googleapis.com','/v2/'+revision));
      const fresh=await metadata('run.googleapis.com','/v2/'+name);
      const binding=value=>({name:value.name,uid:value.uid,generation:value.generation,observedGeneration:value.observedGeneration,reconciling:value.reconciling??false,latestReadyRevision:value.latestReadyRevision,latestCreatedRevision:value.latestCreatedRevision,traffic:value.traffic??[],trafficStatuses:value.trafficStatuses??[]});
      assert(stableHash(binding(service))===stableHash(binding(fresh)),'OLD_WRITER_SERVICE_CHANGED_DURING_READ');
      return {service,revisions,exactRevisions};
    });
  }
  function safeRetirementObservation(services){return services.map(({service,revisions})=>({
    name:service.name,uid:service.uid,generation:service.generation,observedGeneration:service.observedGeneration,reconciling:service.reconciling??false,
    latestReadyRevision:service.latestReadyRevision,latestCreatedRevision:service.latestCreatedRevision,traffic:service.traffic??[],trafficStatuses:service.trafficStatuses??[],
    revisions:revisions.map(revision=>({...revisionIdentity(revision,service.name),generation:revision.generation,observedGeneration:revision.observedGeneration,reconciling:revision.reconciling??false,
      conditions:(revision.conditions??[]).map(({type,state,revisionReason,lastTransitionTime})=>({type,state,revisionReason:revisionReason??null,lastTransitionTime:lastTransitionTime??null}))}))
  }));}
  async function verifyOldWriters(context,state,{observed,functionProofs=context.checkpoints?.functions?.result?.functionProofs}={}){
    assert(state.oldWriterInventory?.projectId===project,'OLD_WRITER_INVENTORY_REQUIRED');
    const details=context.gates?.['old-writers']?.details;
    const names=state.oldWriterInventory.services.map(service=>service.name);
    const originals=state.oldWriterInventory.services.flatMap(service=>service.revisions.map(revision=>revision.name));
    const successors=details?.successorRevisions??[];
    let servingRevisions;
    if(functionProofs!==undefined){
      const current=observed??await observe();
      servingRevisions=state.oldWriterInventory.services.map(service=>{
        const fn=current.functions.find(item=>item.service===service.name);
        assert(fn&&provenFunction(fn,functionProofs)&&typeof fn.revision==='string'&&fn.revision,'OLD_WRITER_REVIEWED_SERVING_FUNCTION_REQUIRED');
        return fn.revision.startsWith(service.name+'/revisions/')?fn.revision:service.name+'/revisions/'+fn.revision;
      });
    }
    const snapshots=await readOldWriterServices(names,[...new Set([...originals,...successors.map(revision=>revision.name)])]);
    const evidence={...identity(context),observedAt:clock(),freezeStateHash:stableHash(state),inventoryHash:stableHash(state.oldWriterInventory),services:safeRetirementObservation(snapshots)};
    // Persist sanitized provider observations for operator review; never persist raw containers/env.
    await save('provider-old-writers-observed.json',evidence);
    assert(details,'OLD_WRITER_GATE_REQUIRED');
    assert(details.method==='cloud-run-retirement'&&details.freezeStateHash===evidence.freezeStateHash&&details.inventoryHash===evidence.inventoryHash,'OLD_WRITER_GATE_BINDING_MISMATCH');
    assert(typeof details.externalOperationsReference==='string'&&details.externalOperationsReference.trim(),'EXTERNAL_OPERATIONS_REVIEW_REQUIRED');
    let proof;
    try{proof=verifyOldWriterRetirement({inventory:state.oldWriterInventory,successors,services:snapshots,servingRevisions});}
    catch(error){throw new MigrationCloudError(/^[A-Z][A-Z0-9_]{2,100}$/.test(error.message??'')?error.message:'OLD_WRITER_RETIREMENT_NOT_VERIFIED');}
    const result={...identity(context),observedAt:clock(),method:details.method,freezeStateHash:evidence.freezeStateHash,inventoryHash:evidence.inventoryHash,gateHash:stableHash(context.gates['old-writers']),...proof};
    await save('provider-old-writers-proof.json',result);return result;
  }
  async function setPolicy(service,policy){const filename=safeFile('iam-policy.json');await writeFile(filename,JSON.stringify(policy),{mode:0o600});await gcloud(['run','services','set-iam-policy',service,filename,'--region',MIGRATION_REGION]);}
  function freezeApproval(context,observed){
    const details=context.gates?.['freeze-scope']?.details;
    assert(details&&details.externalWritersReference&&Array.isArray(details.entrypoints)&&Array.isArray(details.jobNames),'FREEZE_SCOPE_APPROVAL_REQUIRED');
    const required=[...SECURITY_WRITERS,...(observed.functions.some(fn=>fn.name==='getMyAuthorizationStatus')?['getMyAuthorizationStatus']:[])];
    assert(required.every(name=>observed.policies.some(item=>item.functionName===name)),'FREEZE_WRITER_MISSING');
    assert(required.every(name=>details.entrypoints.includes(name)),'FREEZE_ENTRYPOINT_APPROVAL_INCOMPLETE');
    assert(details.entrypoints.every(name=>required.includes(name)),'UNSUPPORTED_FREEZE_ENTRYPOINT_REQUIRES_REVIEW');
    assert(observed.jobs.every(job=>details.jobNames.includes(job.name)||details.jobNames.includes(resourceName(job.name))),'FREEZE_JOB_APPROVAL_INCOMPLETE');
    assert(details.probeUserId&&details.probeReference,'SIGNED_PROBE_APPROVAL_REQUIRED');return details;
  }
  async function performFreeze(context,observed){
    const backup=context.gates?.backup?.details;assert(backup,'BACKUP_GATE_REQUIRED');
    if(!(project==='sodc-web'&&backup.waiverReference))assert(backup.backupReference&&backup.restoreTestReference&&observed.databaseProtection?.automatedBackups&&observed.databaseProtection?.pointInTimeRecovery&&observed.databaseProtection?.deletionProtection,'DATABASE_RESILIENCE_NOT_VERIFIED');
    const approval=freezeApproval(context,observed);await validateProbe(approval);let state=await load('provider-freeze.json');
    if(!state){const prepared=await artifacts(context.baseline);assert(matches(observed.api.files,context.baseline.api.files,'api')&&matches(observed.schema.files,context.baseline.schema.files,'schema')&&stableHash(observed.policies)===stableHash(context.baseline.policies)&&stableHash(observed.jobs)===stableHash(context.baseline.jobs),'LIVE_BASELINE_CHANGED');
      assert(stableHash(observed.functions)===stableHash(context.baseline.functions),'LIVE_FUNCTION_BASELINE_CHANGED');
      const oldWriterInventory=captureOldWriterInventory({projectId:project,services:await readOldWriterServices(oldWriterServiceNames(observed))});
      await save('provider-old-writer-inventory.json',{...identity(context),capturedAt:clock(),inventory:oldWriterInventory,inventoryHash:stableHash(oldWriterInventory)});
      state=await save('provider-freeze.json',{...identity(context),startedAt:clock(),oldWriterInventory,originalPolicies:context.baseline.policies,originalJobs:context.baseline.jobs,appliedPolicies:[],pausedJobs:[],apiFrozen:false,artifact:prepared.liveFrozen});}
    state=await freezeState(context);
    assert(state.oldWriterInventory?.projectId===project,'OLD_WRITER_INVENTORY_REQUIRED');
    for(const original of state.originalPolicies){
      const current=await gcloud(['run','services','get-iam-policy',original.service,'--region',MIGRATION_REGION]);
      if(hasPublicInvoker(current))await setPolicy(original.service,frozenInvokerPolicy(current));
      if(!state.appliedPolicies.includes(original.functionName)){state.appliedPolicies.push(original.functionName);await save('provider-freeze.json',state);}
    }
    for(const job of state.originalJobs){const current=await gcloud(['scheduler','jobs','describe',resourceName(job.name),'--location',MIGRATION_REGION]);
      if(current.state!=='PAUSED')await gcloud(['scheduler','jobs','pause',resourceName(job.name),'--location',MIGRATION_REGION]);
      if(!state.pausedJobs.includes(job.name)){state.pausedJobs.push(job.name);await save('provider-freeze.json',state);}
    }
    const fresh=await observe();
    const expected=await filesIn(path.join(state.artifact.directory,'dataconnect/api'));
    if(!matches(fresh.api.files,expected,'api'))await deploy(`dataconnect:${MIGRATION_SERVICE}:api`,state.artifact,fresh);
    if(!state.completedAt){
      const currentInventory=captureOldWriterInventory({projectId:project,services:await readOldWriterServices(oldWriterServiceNames(fresh))});
      assert(stableHash(currentInventory)===stableHash(state.oldWriterInventory),'OLD_WRITER_INVENTORY_CHANGED_DURING_FREEZE');
      state.apiFrozen=true;state.completedAt=clock();const scheduled=state.originalJobs.map(job=>context.baseline.functions.find(fn=>resourceName(job.name)===jobBase(fn.name)));assert(scheduled.every(Boolean),'SCHEDULED_WORKER_TIMEOUT_UNKNOWN');state.drainTimeoutSeconds=Math.max(0,...state.originalPolicies.map(item=>Number(item.timeoutSeconds)||60),...scheduled.map(fn=>Number(fn.timeoutSeconds)||60));state.drainUntil=new Date(new Date(state.completedAt).getTime()+(state.drainTimeoutSeconds+15)*1000).toISOString();await save('provider-freeze.json',state);}
    return {startedAt:state.startedAt,completedAt:state.completedAt,drainUntil:state.drainUntil,stateHash:stableHash(state),originalPolicyCount:state.originalPolicies.length,originalJobCount:state.originalJobs.length,retirement:{freezeStateHash:stableHash(state),inventoryHash:stableHash(state.oldWriterInventory),inventoryFile:safeFile('provider-old-writer-inventory.json'),requiredMethod:'cloud-run-retirement'}};
  }
  async function validateProbe(approval){
    const jwt=process.env.AUTHORIZATION_MIGRATION_PROBE_TOKEN;const appCheck=process.env.AUTHORIZATION_MIGRATION_PROBE_APP_CHECK_TOKEN;
    assert(jwt&&appCheck&&process.env.AUTHORIZATION_MIGRATION_PROBE_API_KEY,'SIGNED_PROBE_ENVIRONMENT_REQUIRED');
    const admin=await adminFactory({projectId:project,repositoryRoot});
    try{
      let claims;try{claims=await admin.auth.verifyIdToken(jwt,true);await admin.appCheck.verifyToken(appCheck);}catch{throw new MigrationCloudError('SIGNED_PROBE_TOKEN_INVALID');}
      const seconds=new Date(clock()).getTime()/1000;
      assert(claims.aud===project&&claims.iss===`https://securetoken.google.com/${project}`&&claims.uid===approval.probeUserId&&claims.email_verified===true&&claims.admin!==true&&claims.exp>seconds&&claims.iat<=seconds+60,'SIGNED_PROBE_TARGET_INVALID');
      const user=await admin.auth.getUser(approval.probeUserId);assert(user.disabled===false&&user.emailVerified===true&&user.customClaims?.admin!==true,'SIGNED_PROBE_IDENTITY_INVALID');
      const profile=(await admin.dc.executeGraphqlRead('query MigrationApprovedProbe($id:String!){user(id:$id){id membershipStatus}}',{variables:{id:approval.probeUserId}})).data?.user;
      assert(profile?.id===approval.probeUserId&&['REGULAR','RETIRED','RESERVE','INDUSTRY','CIVIL_SERVICE'].includes(profile.membershipStatus),'APPROVED_ACTIVE_EXISTING_PROFILE_REQUIRED');
    }finally{await admin.close?.();}
  }
  async function signedRefusal(context,observed,state){
    const approval=freezeApproval(context,context.baseline);const jwt=process.env.AUTHORIZATION_MIGRATION_PROBE_TOKEN;const apiKey=process.env.AUTHORIZATION_MIGRATION_PROBE_API_KEY;
    const appCheckToken=process.env.AUTHORIZATION_MIGRATION_PROBE_APP_CHECK_TOKEN;
    assert(jwt&&apiKey&&appCheckToken,'SIGNED_PROBE_ENVIRONMENT_REQUIRED');const admin=await adminFactory({projectId:project,repositoryRoot});
    try{
      let claims;try{claims=await admin.auth.verifyIdToken(jwt,true);}catch{throw new MigrationCloudError('SIGNED_PROBE_TOKEN_INVALID');}
      const seconds=new Date(clock()).getTime()/1000;
      assert(claims.aud===project&&claims.iss===`https://securetoken.google.com/${project}`&&claims.uid===approval.probeUserId&&claims.email_verified===true&&claims.admin!==true&&claims.exp>seconds&&claims.iat<=seconds+60,'SIGNED_PROBE_TARGET_INVALID');
      try{assert(admin.appCheck?.verifyToken,'SIGNED_PROBE_APP_CHECK_REQUIRED');await admin.appCheck.verifyToken(appCheckToken);}catch{throw new MigrationCloudError('SIGNED_PROBE_APP_CHECK_INVALID');}
      const user=await admin.auth.getUser(approval.probeUserId);assert(user.uid===approval.probeUserId&&user.disabled===false&&user.emailVerified===true&&user.customClaims?.admin!==true,'SIGNED_PROBE_IDENTITY_INVALID');
      const fields=typeFields(observed.schema.files,'User');assert(fields,'SIGNED_PROBE_SCHEMA_INVALID');
      const selection=['id','email','firstName','lastName','serviceNumber','mobileNumber','membershipStatus','requestedMembershipStatus','postNominals','isRegular','isReserve','isCivilServant','isIndustry','rank','shareContactInfo','createdAt','updatedAt'].filter(field=>fields.has(field)).join(' ');
      const read=async()=>{const response=await admin.dc.executeGraphqlRead(`query MigrationProbeProfile($id:String!){user(id:$id){${selection}}}`,{variables:{id:approval.probeUserId}});return response.data?.user;};
      const before=await read();assert(before?.id===approval.probeUserId&&['REGULAR','RETIRED','RESERVE','INDUSTRY','CIVIL_SERVICE'].includes(before.membershipStatus),'APPROVED_ACTIVE_EXISTING_PROFILE_REQUIRED');
      const variables={};for(const name of ['firstName','lastName','serviceNumber','mobileNumber','postNominals','isRegular','isReserve','isCivilServant','isIndustry','rank','shareContactInfo'])if(fields.has(name))variables[name]=before[name]??null;
      variables.requestedMembershipStatus=before.requestedMembershipStatus??before.membershipStatus;
      assert(['firstName','lastName','serviceNumber','mobileNumber','requestedMembershipStatus'].every(key=>typeof variables[key]==='string'&&variables[key]),'PROBE_PROFILE_REQUIRED_VALUES_MISSING');
      const authorityFingerprint=value=>stableHash(deep({...value,identities:value.identities.map(user=>({uid:user.uid,email:user.email,emailVerified:user.emailVerified,disabled:user.disabled,customClaims:user.customClaims??{}})).sort((a,b)=>a.uid.localeCompare(b.uid)),profiles:[...value.profiles].sort((a,b)=>a.id.localeCompare(b.id)),states:[...value.states].sort((a,b)=>a.userId.localeCompare(b.userId)),pendingTransitions:[...value.pendingTransitions].sort((a,b)=>a.operationId.localeCompare(b.operationId))}));
      const beforeAuthority=authorityFingerprint(await readAuthority(observed.schema.files));
      const callables=[];
      // GET is deliberately handler-inert: the pinned callable wrapper rejects non-POST
      // before dispatch. This proves platform ingress refusal, not callable acceptance.
      for(const original of state.originalPolicies){const response=await fetcher(`https://${MIGRATION_REGION}-${project}.cloudfunctions.net/${original.functionName}`,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+jwt,'X-Firebase-AppCheck':appCheckToken},signal:AbortSignal.timeout(30_000)});const contentType=response.headers.get('content-type')??'';const text=await response.text();callables.push({functionName:original.functionName,method:'GET',httpStatus:response.status,platformDenied:isPlatformIamRefusal(response.status,contentType,text)});}
      const name=base+'/connectors/api';const url=new URL('https://firebasedataconnect.googleapis.com/v1/'+name+':executeMutation');url.searchParams.set('key',apiKey);
      assert(observed.api.files.some(file=>/query\s+CheckUserProfileExists\s+@auth\(expr:\s*"auth.token.email_verified == true"\)\s*\{\s*user\(key:\s*\{\s*id_expr:\s*"auth.uid"\s*\}\)/.test(file.content)),'REVIEWED_OWN_PROFILE_PROBE_QUERY_REQUIRED');
      const queryUrl=new URL(url);queryUrl.pathname=queryUrl.pathname.replace(/:executeMutation$/,':executeQuery');
      const positive=await fetcher(queryUrl,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Firebase-Auth-Token':jwt,'X-Firebase-AppCheck':appCheckToken},body:JSON.stringify({name,operationName:'CheckUserProfileExists',variables:{}}),signal:AbortSignal.timeout(30_000)});let ownBody;try{ownBody=await positive.json();}catch{ownBody=null;}
      const transportVerified=positive.status===200&&ownBody?.data?.user?.id===approval.probeUserId&&!ownBody.error&&!ownBody.errors;
      if(!transportVerified)return {...identity(context),observedAt:clock(),scope:'handler-inert-platform-ingress-refusal',validTargetToken:true,validAppCheckToken:true,callables,transportVerified:false,onboardingDenied:false,profileUnchanged:stableHash(before)===stableHash(await read()),authorityUnchanged:false,passed:false};
      const response=await fetcher(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Firebase-Auth-Token':jwt,'X-Firebase-AppCheck':appCheckToken},body:JSON.stringify({name,operationName:'CreateUserProfile',variables}),signal:AbortSignal.timeout(30_000)});
      let body;try{body=await response.json();}catch{body=null;}
      const permissionDenied=response.status===403&&body?.error?.status==='PERMISSION_DENIED'&&!body.data;
      const after=await read();const unchanged=stableHash(before)===stableHash(after);
      const authorityUnchanged=beforeAuthority===authorityFingerprint(await readAuthority(observed.schema.files));
      return {...identity(context),observedAt:clock(),scope:'handler-inert-platform-ingress-refusal',validTargetToken:true,validAppCheckToken:true,transportVerified,callables,onboardingDenied:permissionDenied,profileUnchanged:unchanged,authorityUnchanged,passed:callables.every(item=>item.platformDenied)&&transportVerified&&permissionDenied&&unchanged&&authorityUnchanged};
    }finally{await admin.close?.();}
  }
  async function authorityCommand(mode,phase,context){
    const operationId=plan.phaseOperationIds?.[phase];assert(typeof operationId==='string'&&operationId.length>0,'STABLE_PHASE_OPERATION_REQUIRED');
    const args=[path.join(repositoryRoot,'functions/node_modules/ts-node/dist/bin.js'),'--project',path.join(repositoryRoot,'functions/tsconfig.scripts.json'),path.join(repositoryRoot,'functions/scripts/security-state-admin.ts'),'--project',project,'--all','--mode',mode,'--apply','--confirm-project',project,'--actor',plan.operator,'--reason',plan.reason,'--operation-id',operationId];
    if(mode==='bootstrap'&&plan.importAdmins===true)args.push('--import-admins');
    assert(typeof plan.operator==='string'&&typeof plan.reason==='string','OPERATOR_INTENT_REQUIRED');await run(process.execPath,args,{cwd:path.join(repositoryRoot,'functions'),timeoutMs:1_800_000});
    return {...identity(context),operationId,mode,completedAt:clock()};
  }
  async function candidate(){return {schema:await filesIn(path.join(repositoryRoot,'dataconnect/schema')),api:await filesIn(path.join(repositoryRoot,'dataconnect/api')),authorization:await filesIn(path.join(repositoryRoot,'dataconnect/authorization-service')),contracts:await discoverFunctionContracts(path.join(repositoryRoot,'functions/src'))};}
  async function schemaDiff(artifact,observed){
    const text=await firebase(['dataconnect:sql:diff','--service',MIGRATION_SERVICE,'--location',MIGRATION_REGION,'--config',artifact.configPath,'--json'],observed,{cwd:artifact.directory});let output;try{output=JSON.parse(text);}catch{throw new MigrationCloudError('SQL_DIFF_JSON_REQUIRED');}
    const result=output.result??output;assert(result.projectId===project&&Array.isArray(result.diffs),'SQL_DIFF_TARGET_INVALID');assertAdditiveSql(result.diffs);return {diffs:result.diffs,diffSha256:stableHash(result.diffs)};
  }
  async function phaseRecord(phase,context){const name='provider-phase-'+phase+'.json';let record=await load(name);if(record)checkJournal(record,context);else record=await save(name,{...identity(context),phase,startedAt:clock(),completedAt:null});return {name,record};}
  const functionProof=fn=>deep({name:fn.name,updateTime:fn.updateTime,runtime:fn.runtime,entryPoint:fn.entryPoint,source:fn.source,revision:fn.revision,service:fn.service,uri:fn.uri,serviceAccountEmail:fn.serviceAccountEmail});
  const provenFunction=(fn,proofs)=>fn.state==='ACTIVE'&&fn.environment==='GEN_2'&&fn.runtime==='nodejs24'&&fn.entryPoint===fn.name&&fn.source&&proofs?.some(proof=>proof.name===fn.name&&stableHash(deep(functionProof(fn)))===stableHash(proof));
  async function capturedSchedulers(observed,names){
    const result=[];
    for(const name of SCHEDULED.filter(name=>names.includes(name))){
      const capture=await load('scheduler-'+jobBase(name)+'.json');assert(capture?.projectId===project&&capture.gitSha===plan.gitSha&&capture.runId===plan.runId&&capture.planHash===stableHash(plan),'REVIEWED_SCHEDULER_CAPTURE_REQUIRED');
      const job=capture.job;const fn=observed.functions.find(fn=>fn.name===name);assert(job?.name===`projects/${project}/locations/${MIGRATION_REGION}/jobs/${jobBase(name)}`&&job.httpTarget?.uri===fn?.uri&&job.httpTarget?.httpMethod==='POST'&&!job.httpTarget.headers&&!job.httpTarget.body&&!job.pubsubTarget&&job.httpTarget.oidcToken?.serviceAccountEmail===fn?.serviceAccountEmail,'SCHEDULER_TARGET_NOT_VERIFIED');
      const uri=new URL(job.httpTarget.uri);assert(uri.protocol==='https:'&&!uri.search&&!uri.hash&&typeof job.schedule==='string'&&(!job.httpTarget.oidcToken.audience||job.httpTarget.oidcToken.audience===job.httpTarget.uri),'SCHEDULER_SPEC_INVALID');
      result.push(deep({name:job.name,schedule:job.schedule,timeZone:job.timeZone??'UTC',attemptDeadline:job.attemptDeadline,retryConfig:job.retryConfig,httpTarget:{uri:job.httpTarget.uri,httpMethod:'POST',oidcIdentity:{serviceAccountEmail:job.httpTarget.oidcToken.serviceAccountEmail,...(job.httpTarget.oidcToken.audience?{audience:job.httpTarget.oidcToken.audience}:{})}}}));
    }
    return result;
  }
  const schedulerIntents=specs=>specs.map(spec=>({name:spec.name,specHash:stableHash(spec)}));
  async function resolveSchedulerIntents(observed,intents){const result=[];for(const intent of intents??[]){const name=SCHEDULED.find(name=>resourceName(intent.name)===jobBase(name));assert(name,'UNKNOWN_SCHEDULER_INTENT');const [spec]=await capturedSchedulers(observed,[name]);assert(spec.name===intent.name&&stableHash(spec)===intent.specHash,'SCHEDULER_INTENT_CHANGED');result.push(spec);}return result;}
  const schedulerMatches=(job,spec)=>Boolean(job&&job.schedule===spec.schedule&&(job.timeZone??'UTC')===spec.timeZone&&(spec.attemptDeadline===undefined||job.attemptDeadline===spec.attemptDeadline)&&Object.entries(spec.retryConfig??{}).every(([key,value])=>job.retryConfig?.[key]===value)&&job.targetFingerprint===stableHash({httpTarget:{uri:spec.httpTarget.uri,httpMethod:spec.httpTarget.httpMethod,serviceAccount:spec.httpTarget.oidcIdentity.serviceAccountEmail,audience:spec.httpTarget.oidcIdentity.audience??null},pubsubTarget:null}));
  async function applyScheduler(spec,observed){
    const body=deep(spec);body.httpTarget.oidcToken=body.httpTarget.oidcIdentity;delete body.httpTarget.oidcIdentity;
    const exists=observed.jobs.some(job=>job.name===spec.name);const mask=Object.keys(body).filter(key=>key!=='name').join(',');const endpoint=exists?`/v1/${spec.name}?updateMask=${mask}`:`/v1/projects/${project}/locations/${MIGRATION_REGION}/jobs`;
    const response=await fetcher('https://cloudscheduler.googleapis.com'+endpoint,{method:exists?'PATCH':'POST',redirect:'error',headers:{Authorization:'Bearer '+await accessToken(),'X-Goog-User-Project':project,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45_000)});assert(response.ok,'SCHEDULER_OPEN_APPLY_FAILED');const result=await response.json();assert(result.name===spec.name,'SCHEDULER_OPEN_TARGET_MISMATCH');
  }
  async function pauseOriginalJobs(state){for(const job of state.originalJobs){const current=await gcloud(['scheduler','jobs','describe',resourceName(job.name),'--location',MIGRATION_REGION]);if(current.state!=='PAUSED')await gcloud(['scheduler','jobs','pause',resourceName(job.name),'--location',MIGRATION_REGION]);}}
  async function perform(phase,context={}){
    assert(PHASES.has(phase),'UNKNOWN_MIGRATION_PHASE');
    const observed=await observe();if(phase==='inspect'){assert(observed.installation===plan.installation,'INSTALLATION_PLAN_MISMATCH');const prepared=await artifacts(observed);const diff=await schemaDiff(prepared.strictFrozen,observed);await save('provider-sql-review.json',{...identity(context),...diff});return {...identity(context),capturedAt:clock(),baseline:observed,sqlDiff:diff};}
    assert(context.baseline?.projectId===project&&context.baseline.gitSha===plan.gitSha,'DURABLE_BASELINE_REQUIRED');
    if(phase==='freeze')return performFreeze(context,observed);
    const state=await freezeState(context);
    // A completed prior checkpoint and an expired request timer never replace fresh provider proof.
    await verifyOldWriters(context,state,{observed});
    // Backfill can leave its own durable PENDING intent after a transport/Auth failure.
    // Its stable operator command must be able to resume; verification still requires READY.
    if(phase==='backfill'){
      const operationId=plan.phaseOperationIds?.backfill;
      const owned=item=>typeof item.userId==='string'&&item.userId.length>0&&item.operationId===operationId+':'+item.userId;
      assert(typeof operationId==='string'&&operationId&&raw.pendingTransitions.every(owned)&&raw.states.filter(item=>item.syncStatus!=='READY').every(item=>item.syncStatus==='PENDING'&&owned(item)),'UNREVIEWED_PENDING_BACKFILL_WORK');
    }else assert(observed.authority.counts.pendingTransitions===0&&observed.authority.violations.nonReadyStates===0,'OLD_WRITER_AUTHORITY_NOT_SETTLED');
    const prepared=await artifacts(context.baseline);
    const opening=['open','receipt'].includes(phase);
    if(!opening)assert(frozen(observed,state),'FREEZE_NOT_PRESERVED');
    const {name,record}=await phaseRecord(phase,context);if(record.completedAt)return record;
    if(phase==='schema'){
      const diff=await schemaDiff(prepared.strictFrozen,observed);await save('provider-sql-review.json',{...identity(context),...diff});
      const reviewed=context.reviewedSqlHash??context.gates?.['sql-review']?.details?.diffSha256;
      assert(reviewed===diff.diffSha256||(record.diffSha256===reviewed&&diff.diffs.length===0),'FRESH_SQL_REVIEW_HASH_REQUIRED');
      if(!record.diffSha256){record.diffSha256=diff.diffSha256;await save(name,record);}
      await firebase(['dataconnect:sql:migrate','--service',MIGRATION_SERVICE,'--location',MIGRATION_REGION,'--config',prepared.strictFrozen.configPath,'--force'],observed,{cwd:prepared.strictFrozen.directory});
      await deploy(`dataconnect:${MIGRATION_SERVICE}:schema,dataconnect:${MIGRATION_SERVICE}:authorization-service`,prepared.strictFrozen,observed);
    }else if(phase==='compatibility'){
      assert(plan.installation==='legacy'&&prepared.compatibilityFrozen,'STRICT_INSTALLATION_CANNOT_DOWNGRADE');
      if(observed.installation==='strict'){assert(matches(observed.api.files,await filesIn(path.join(prepared.strictFrozen.directory,'dataconnect/api')),'api'),'STRICT_INSTALLATION_CANNOT_DOWNGRADE');record.strongerBoundaryPreserved=true;}
      else await deploy(`dataconnect:${MIGRATION_SERVICE}:api`,prepared.compatibilityFrozen,observed);
    }else if(phase==='control-create'){
      if(!observed.authority.control)await authorityCommand('control-create',phase,context);
      else assert(observed.authority.control.status==='BOOTSTRAP'||observed.authority.control.status==='READY','CONTROL_RECOVERY_REQUIRES_REVIEW');
    }else if(phase==='backfill'){
      const allowed=context.baseline.authority.private.eligibleLegacyAdminUIDs;
      assert(observed.authority.private.eligibleLegacyAdminUIDs.every(uid=>allowed.includes(uid)),'UNAPPROVED_LEGACY_ADMIN_ROSTER');
      const allAllowed=context.baseline.authority.private.legacyAdminUIDs??[];const currentLegacy=observed.authority.private.legacyAdminUIDs;
      assert(currentLegacy.every(uid=>allAllowed.includes(uid)),'UNAPPROVED_LATENT_ADMIN_ROSTER');
      if(currentLegacy.length===allAllowed.length)assert(observed.authority.private.legacyAdminFingerprint===context.baseline.authority.private.legacyAdminFingerprint,'LEGACY_ADMIN_INTENT_CHANGED');
      assert(!allAllowed.length||plan.importAdmins===true,'EXPLICIT_ADMIN_IMPORT_REQUIRED');await authorityCommand('bootstrap',phase,context);
    }else if(phase==='functions'){
      const source=await candidate();const selected=selectStagedFunctions(source.contracts.functions,context.baseline.functions.map(fn=>fn.name));assert(selected.length>0,'FUNCTION_CONTRACTS_REQUIRED');
      try{await deploy(selected.map(item=>'functions:'+item).join(','),null,observed);}finally{await pauseOriginalJobs(state);}
      const after=await observe();assert(frozen(after,state),'FUNCTION_DEPLOY_BROKE_FREEZE');record.selected=selected;record.functionProofs=after.functions.filter(fn=>selected.includes(fn.name)).map(functionProof);record.schedulerIntents=schedulerIntents(await capturedSchedulers(after,selected));
    }else if(phase==='activate')await authorityCommand('control-activate',phase,context);
    else if(phase==='strict-api')await deploy(`dataconnect:${MIGRATION_SERVICE}:api`,prepared.strictFrozen,observed);
    else if(phase==='open'){
      assert(context.gates?.acceptance,'ACCEPTANCE_GATE_REQUIRED');assert(observed.authority.controlReady,'READY_CONTROL_REQUIRED');
      const source=await candidate();assert(matches(observed.api.files,denyOnboarding(source.api),'api')||(record.openingStarted&&matches(observed.api.files,source.api,'api')),'STRICT_FROZEN_API_REQUIRED');
      const authoritative=context.checkpoints?.functions?.result;const selected=selectStagedFunctions(source.contracts.functions,context.baseline.functions.map(fn=>fn.name));const audit=evaluateAuthority({...raw,requireBackfill:true});
      assert(matches(observed.schema.files,source.schema,'schema')&&matches(observed.authorization?.files,source.authorization,'authorization-service')&&audit.passed&&audit.controlReady&&audit.counts.pendingTransitions===0,'OPEN_AUTHORITY_OR_SCHEMA_NOT_VERIFIED');
      assert(authoritative&&selected.every(name=>observed.functions.some(fn=>fn.name===name&&provenFunction(fn,authoritative.functionProofs))),'OPEN_REVIEWED_FUNCTIONS_NOT_VERIFIED');
      if(!record.apiOpening)assert(frozen(observed,state),'OPEN_FREEZE_NOT_PRESERVED');
      if(!record.openingStarted){record.openingStarted=true;await save(name,record);}
      const missing=DEFERRED_FUNCTIONS.filter(item=>!context.baseline.functions.some(fn=>fn.name===item));
      if(missing.length&&!record.deferredProofs){
        await deploy(missing.map(item=>'functions:'+item).join(','),null,observed);const after=await observe();
        assert(frozen(after,state),'DEFERRED_DEPLOY_BROKE_FREEZE');record.deferredProofs=after.functions.filter(fn=>missing.includes(fn.name)).map(functionProof);record.deferredSchedulerIntents=schedulerIntents(await capturedSchedulers(after,missing));await save(name,record);
      }
      const beforeOpen=await observe();const beforeAudit=evaluateAuthority({...raw,requireBackfill:true});
      assert(missing.every(name=>beforeOpen.functions.some(fn=>fn.name===name&&provenFunction(fn,record.deferredProofs)))&&selected.every(name=>beforeOpen.functions.some(fn=>fn.name===name&&provenFunction(fn,authoritative.functionProofs)))&&beforeAudit.passed&&beforeAudit.controlReady&&matches(beforeOpen.schema.files,source.schema,'schema')&&matches(beforeOpen.authorization?.files,source.authorization,'authorization-service'),'DEFERRED_BOUNDARY_NOT_VERIFIED');
      const reviewedSchedulers=await resolveSchedulerIntents(beforeOpen,[...authoritative.schedulerIntents??[],...record.deferredSchedulerIntents??[]]);
      await verifyOldWriters(context,state,{observed:beforeOpen,functionProofs:authoritative.functionProofs});
      if(!record.apiOpening){assert(frozen(beforeOpen,state),'OPEN_FREEZE_NOT_PRESERVED');record.apiOpening=true;await save(name,record);}
      // Only the reviewed strict connector is reopened; no Hosting or unrelated deployment.
      assert(prepared.strictOpen,'REVIEWED_OPEN_API_ARTIFACT_REQUIRED');
      if(!matches(observed.api.files,source.api,'api'))await deploy(`dataconnect:${MIGRATION_SERVICE}:api`,prepared.strictOpen,await observe());
      await verifyOldWriters(context,state);
      for(const original of state.originalPolicies){const current=await gcloud(['run','services','get-iam-policy',original.service,'--region',MIGRATION_REGION]);await setPolicy(original.service,restoreInvokerPolicy(current,original.policy));}
      await verifyOldWriters(context,state);
      for(const spec of reviewedSchedulers)await applyScheduler(spec,await observe());
      for(const original of state.originalJobs){const current=await gcloud(['scheduler','jobs','describe',resourceName(original.name),'--location',MIGRATION_REGION]);assert(['ENABLED','PAUSED'].includes(original.state),'UNSUPPORTED_ORIGINAL_JOB_STATE');if(current.state!==original.state)await gcloud(['scheduler','jobs',original.state==='PAUSED'?'pause':'resume',resourceName(original.name),'--location',MIGRATION_REGION]);}
      for(const spec of reviewedSchedulers){const desired=context.baseline.jobs.find(job=>job.name===spec.name)?.state??'ENABLED';assert(['ENABLED','PAUSED'].includes(desired),'UNSUPPORTED_ORIGINAL_JOB_STATE');const current=await gcloud(['scheduler','jobs','describe',resourceName(spec.name),'--location',MIGRATION_REGION]);if(current.state!==desired)await gcloud(['scheduler','jobs',desired==='PAUSED'?'pause':'resume',resourceName(spec.name),'--location',MIGRATION_REGION]);}
    }else if(phase!=='receipt')throw new MigrationCloudError('UNKNOWN_MIGRATION_PHASE');
    record.completedAt=clock();await save(name,record);return record;
  }
  async function verify(phase,context={}){
    assert(PHASES.has(phase),'UNKNOWN_MIGRATION_PHASE');
    const observed=await observe();const assertions={};const set=(key,value)=>assertions[key]=Boolean(value);let state;let oldWriterProof;
    if(phase==='inspect'){set('targetVerified',observed.projectId===project&&observed.installation===plan.installation);set('baselineCaptured',Boolean(context.result?.capturedAt));}
    else{
      state=await freezeState(context);const source=await candidate();const audit=evaluateAuthority({...raw,requireBackfill:true});
      const stagedRecord=phase==='functions'?context.result:context.checkpoints?.functions?.result;const openRecord=phase==='open'?context.result:context.checkpoints?.open?.result;const proofs=[...stagedRecord?.functionProofs??[],...openRecord?.deferredProofs??[]];
      const fullFunctions=source.contracts.functions.every(name=>observed.functions.some(fn=>fn.name===name&&provenFunction(fn,proofs)));
      const strictOpen=matches(observed.api.files,source.api,'api');const strictFrozen=matches(observed.api.files,denyOnboarding(source.api),'api');
      const restored=state.originalPolicies.every(original=>{const current=observed.policies.find(item=>item.functionName===original.functionName);if(!current)return false;const originalPublic=original.policy.bindings.filter(binding=>binding.role==='roles/run.invoker').flatMap(binding=>(binding.members??[]).filter(member=>PUBLIC.has(member)).map(member=>stableHash({member,condition:binding.condition??null})));const currentPublic=current.policy.bindings.filter(binding=>binding.role==='roles/run.invoker').flatMap(binding=>(binding.members??[]).filter(member=>PUBLIC.has(member)).map(member=>stableHash({member,condition:binding.condition??null})));return stableHash(originalPublic.sort())===stableHash(currentPublic.sort());});
      const securityOriginally=expectedJob(context.baseline,'reconcilePendingSecurityTransitions');
      const reviewedSchedulers=await resolveSchedulerIntents(observed,[...stagedRecord?.schedulerIntents??[],...openRecord?.deferredSchedulerIntents??[]]);
      const schedulers=state.originalJobs.every(original=>observed.jobs.some(job=>job.name===original.name&&job.state===original.state))&&expectedJob(observed,'reconcilePendingSecurityTransitions')?.state===(securityOriginally?.state??'ENABLED')&&reviewedSchedulers.every(spec=>{const job=observed.jobs.find(job=>job.name===spec.name);return schedulerMatches(job,spec)&&job.state===(context.baseline.jobs.find(original=>original.name===spec.name)?.state??'ENABLED');});
      if(phase!=='freeze')oldWriterProof=await verifyOldWriters(context,state,{observed,functionProofs:stagedRecord?.functionProofs});
      if(phase==='freeze'){
        const waitComplete=Boolean(state.drainUntil)&&new Date(clock())>=new Date(state.drainUntil);
        const authoritySettled=observed.authority.counts.pendingTransitions===0&&observed.authority.violations.nonReadyStates===0;
        set('serverFreezeVerified',frozen(observed,state));set('onboardingDenied',denied(observed.api.files));set('jobsBlocked',state.originalJobs.every(job=>observed.jobs.some(item=>item.name===job.name&&item.state==='PAUSED')));
        let retirement=null;
        if(waitComplete&&authoritySettled&&assertions.serverFreezeVerified){
          try{retirement=await verifyOldWriters(context,state);}catch(error){if(!(error instanceof MigrationCloudError))throw error;await save('provider-old-writers-blocked.json',{...identity(context),observedAt:clock(),code:error.code});}
        }
        oldWriterProof=retirement;set('oldWritersRetired',Boolean(retirement));set('drainComplete',waitComplete&&authoritySettled&&Boolean(retirement));
        let proof=null;if(waitComplete&&authoritySettled&&assertions.serverFreezeVerified){proof=await signedRefusal(context,observed,state);await save('provider-freeze-proof.json',proof);}set('signedRefusalVerified',proof?.passed);
      }else if(phase==='schema'){set('schemaMatches',matches(observed.schema.files,source.schema,'schema'));set('authorizationConnectorMatches',matches(observed.authorization?.files,source.authorization,'authorization-service'));set('freezePreserved',frozen(observed,state));}
      else if(phase==='compatibility'){const prepared=await artifacts(context.baseline);set('compatibilityMatches',plan.installation==='legacy'&&Boolean(prepared.compatibilityFrozen)&&(matches(observed.api.files,await filesIn(path.join(prepared.compatibilityFrozen.directory,'dataconnect/api')),'api')||matches(observed.api.files,await filesIn(path.join(prepared.strictFrozen.directory,'dataconnect/api')),'api')));set('onboardingDenied',denied(observed.api.files));set('freezePreserved',frozen(observed,state));}
      else if(phase==='control-create'){set('controlExists',Boolean(observed.authority.control));set('freezePreserved',frozen(observed,state));}
      else if(phase==='backfill'){set('backfillComplete',audit.backfillComplete);set('mirrorsCurrent',audit.violations.authMirrorMismatch===0);set('administratorsVerified',audit.passed&&audit.counts.readyAdministrators>0);set('freezePreserved',frozen(observed,state));}
      else if(phase==='functions'){
        const selected=selectStagedFunctions(source.contracts.functions,context.baseline.functions.map(fn=>fn.name));const record=context.result;
        set('functionsMatch',selected.every(name=>observed.functions.some(fn=>fn.name===name&&provenFunction(fn,record?.functionProofs)&&new Date(fn.updateTime)>=new Date(record?.startedAt))));
        set('freezePreserved',frozen(observed,state));set('repairEndpointsDeferred',DEFERRED_FUNCTIONS.every(name=>context.baseline.functions.some(fn=>fn.name===name)||!observed.functions.some(fn=>fn.name===name)));
      }else if(phase==='activate'){set('controlReady',audit.controlReady);set('administratorsVerified',audit.passed&&audit.counts.readyAdministrators>0);set('freezePreserved',frozen(observed,state));}
      else if(phase==='strict-api'){set('strictApiReady',strictFrozen);set('legacyWritersAbsent',!observed.api.files.some(file=>/\bmutation\s+ConfirmPotentialLost(?:WithSecurityState)?\s*\(/.test(file.content)));set('freezePreserved',frozen(observed,state));}
      else if(['open','receipt'].includes(phase)){set('schemaMatches',matches(observed.schema.files,source.schema,'schema'));set('authorizationConnectorMatches',matches(observed.authorization?.files,source.authorization,'authorization-service'));set('strictApiReady',strictOpen);set('adminSafetyControlReady',audit.controlReady);set('functionsMatch',fullFunctions);if(phase==='receipt')set('backfillComplete',audit.backfillComplete);set('invokersRestored',restored);set('schedulersVerified',schedulers);}
      else throw new MigrationCloudError('UNKNOWN_MIGRATION_PHASE');
    }
    const blockers=Object.entries(assertions).filter(([,value])=>!value).map(([key])=>key);return {ok:blockers.length===0,observed,evidence:{...identity(context),observedAt:clock(),assertions,...oldWriterProof?{oldWriterProofHash:oldWriterProof.proofHash,oldWriterGateHash:oldWriterProof.gateHash}:{}},blockers};
  }
  const guarded=method=>async(...args)=>{try{return await method(...args);}catch(error){if(error instanceof MigrationCloudError)throw error;throw new MigrationCloudError('PROVIDER_OPERATION_FAILED');}};
  return {observe:guarded(observe),perform:guarded(perform),verify:guarded(verify)};
}
