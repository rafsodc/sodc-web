import {createRequire} from 'node:module';
import {lstat,open,readFile,rename,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {stableHash} from './authorization-migration-sources.mjs';
import {evaluateAuthority} from './authorization-migration-audit.mjs';

const PROJECT='sodc-web';
const REGION='europe-west2';
const FUNCTION='reconcilePendingSecurityTransitions';
const JOB=`projects/${PROJECT}/locations/${REGION}/jobs/firebase-schedule-${FUNCTION}-${REGION}`;
const FUNCTION_RESOURCE=`projects/${PROJECT}/locations/${REGION}/functions/${FUNCTION}`;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const TERMINAL=new Set(['READY','SUPERSEDED']);
const clone=value=>JSON.parse(JSON.stringify(value));
const assert=(condition,code)=>{if(!condition)throw new ReconciliationVolumeCloudError(code);};
const sorted=(rows,key)=>rows.map(clone).sort((a,b)=>a[key].localeCompare(b[key]));
const clockDate=value=>new Date(typeof value==='function'?value():value).toISOString();
const canonicalTimestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

export class ReconciliationVolumeCloudError extends Error {
  constructor(code){super(code);this.name='ReconciliationVolumeCloudError';this.code=code;}
}

export function assertReconciliationVolumeEnvironment(environment=process.env,nodeVersion=process.version){
  assert(/^v24\./.test(nodeVersion),'NODE_24_REQUIRED');
  for(const key of ['GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT'])assert(!environment[key]||environment[key]===PROJECT,'DEV_PROJECT_ENVIRONMENT_REQUIRED');
  for(const[key,value]of Object.entries(environment))assert(!key.endsWith('_EMULATOR_HOST')||!value,'EMULATOR_OVERRIDE_FORBIDDEN');
  if(environment.FIREBASE_CONFIG){let config;try{config=JSON.parse(environment.FIREBASE_CONFIG);}catch{throw new ReconciliationVolumeCloudError('FIREBASE_CONFIG_INVALID');}assert(config?.projectId===PROJECT,'DEV_FIREBASE_CONFIG_REQUIRED');}
}

function validateManifest(manifest){
  assert(manifest?.schemaVersion==='sodc-reconciliation-volume/v1'&&manifest.projectId===PROJECT,'DEV_VOLUME_MANIFEST_REQUIRED');
  assert(UUID.test(manifest.runId??'')&&manifest.fixturePrefix===`rcv-${manifest.runId}-`&&/^[a-f0-9]{40}$/.test(manifest.gitSha??''),'VOLUME_MANIFEST_IDENTITY_INVALID');
  const created=Date.parse(manifest.createdAt),expiry=Date.parse(manifest.expiresAt);
  assert(Number.isFinite(created)&&Number.isFinite(expiry)&&expiry>created&&expiry-created<=48*60*60*1000,'VOLUME_MANIFEST_EXPIRY_INVALID');
  assert(Array.isArray(manifest.fixtures)&&manifest.fixtures.length>0&&manifest.fixtures.length<=10000,'VOLUME_FIXTURE_BOUND_REQUIRED');
  const ids=new Set(),operations=new Set();
  for(const fixture of manifest.fixtures){
    assert(fixture&&Object.keys(fixture).every(key=>['uid','operationId','marker'].includes(key))&&fixture.marker===`rcv:${manifest.runId}`&&
      new RegExp(`^rcv-${manifest.runId}-[0-9]{5}$`).test(fixture.uid??'')&&new RegExp(`^rcv-init:${manifest.runId}:[0-9]+$`).test(fixture.operationId??'')&&!ids.has(fixture.uid)&&!operations.has(fixture.operationId),'VOLUME_FIXTURE_IDENTITY_INVALID');
    ids.add(fixture.uid);operations.add(fixture.operationId);
  }
  if(manifest.baseline){const b=manifest.baseline;assert(HASH.test(b.fingerprint??'')&&Number.isSafeInteger(b.readyAdminCount)&&b.readyAdminCount>0&&
    ['identities','profiles','states'].every(key=>Number.isSafeInteger(b.counts?.[key])&&b.counts[key]>=0)&&b.scheduler?.resource===JOB&&['ENABLED','PAUSED'].includes(b.scheduler.state)&&HASH.test(b.scheduler.configurationHash??'')&&
    typeof b.deployment?.revision==='string'&&b.deployment.revision.length>0&&HASH.test(b.deployment.proofHash??'')&&['LIVE','TEAM_TEST','SIMULATION'].includes(b.notification?.mode)&&HASH.test(b.notification.configurationHash??''),'VOLUME_BASELINE_INVALID');}
  return clone(manifest);
}

/** Credentials and Firebase imports are deliberately deferred until the first observation. */
async function adminDefault({repositoryRoot}){
  const require=createRequire(path.join(repositoryRoot,'functions/package.json'));
  const apps=require('firebase-admin/app');
  assert(!apps.getApps().some(app=>app.name==='[DEFAULT]'||app.name==='current-authorization-data-connect'),'ISOLATED_PROVIDER_PROCESS_REQUIRED');
  const previous=new Set(apps.getApps().map(app=>app.name));
  const credential=apps.applicationDefault();
  const app=apps.initializeApp({projectId:PROJECT,credential});
  const apiApp=apps.initializeApp({projectId:PROJECT,credential},`reconciliation-volume-api-${process.pid}`);
  const auth=require('firebase-admin/auth').getAuth(app);
  const dc=require('firebase-admin/data-connect').getDataConnect({connector:'api',serviceId:'sodc-web-service',location:REGION},apiApp);
  const client=await new (require('google-auth-library').GoogleAuth)({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
  let coordinator;
  return {auth,dc,accessToken:async()=> (await client.getAccessToken()).token,
    async getCoordinator(){
      if(!coordinator){
        for(const file of ['currentAuthorizationTransitions','securityRepository','validation','constants']){
          const [source,compiled]=await Promise.all([stat(path.join(repositoryRoot,`functions/src/${file}.ts`)),stat(path.join(repositoryRoot,`functions/lib/${file}.js`))]);
          assert(compiled.mtimeMs>=source.mtimeMs,'BUILD_CURRENT_FUNCTIONS_BEFORE_VOLUME_SETUP');
        }
        coordinator=require(path.join(repositoryRoot,'functions/lib/currentAuthorizationTransitions.js'));
      }
      return coordinator;
    },
    close:async()=>{await Promise.all(apps.getApps().filter(item=>!previous.has(item.name)).map(item=>apps.deleteApp(item)));}};
}

const schedulerConfiguration=job=>({schedule:job.schedule,timeZone:job.timeZone??'UTC',httpTarget:job.httpTarget??null,pubsubTarget:job.pubsubTarget??null,appEngineHttpTarget:job.appEngineHttpTarget??null,retryConfig:job.retryConfig??{},attemptDeadline:job.attemptDeadline??null});
const deploymentProof=fn=>({name:fn.name,state:fn.state,environment:fn.environment,updateTime:fn.updateTime,buildConfig:fn.buildConfig,
  revision:fn.serviceConfig?.revision,service:fn.serviceConfig?.service,uri:fn.serviceConfig?.uri,serviceAccountEmail:fn.serviceConfig?.serviceAccountEmail,timeoutSeconds:fn.serviceConfig?.timeoutSeconds});
const expectedProfile=fixture=>({id:fixture.uid,firstName:'Reconciliation',lastName:'Volume fixture',email:`${fixture.uid}@example.invalid`,serviceNumber:fixture.uid,membershipStatus:'PENDING',createdBy:fixture.marker,updatedBy:fixture.marker,announcementOptOutAll:true});
const profileOwned=(profile,fixture)=>profile&&Object.entries(expectedProfile(fixture)).every(([key,value])=>profile[key]===value);
const identityOwned=(identity,fixture)=>identity&&identity.uid===fixture.uid&&identity.displayName===fixture.marker&&identity.disabled===true&&identity.emailVerified===false&&!identity.email&&!identity.phoneNumber&&!identity.passwordHash&&!identity.passwordSalt&&!(identity.multiFactor?.enrolledFactors??[]).length&&!(identity.providerData??[]).length&&
  Object.entries(identity.customClaims??{}).every(([key,value])=>['enabled','admin'].includes(key)?value===false:key==='securityVersion'&&value===1);
const stateOwned=(state,fixture,ready=false)=>state&&state.userId===fixture.uid&&state.operationId===fixture.operationId&&state.securityVersion===1&&state.membershipStatus==='PENDING'&&
  state.desiredEnabled===false&&state.desiredAdmin===false&&state.accessReady===false&&state.adminReady===false&&state.verificationEmail==null&&
  (ready?state.syncStatus==='READY':['READY','PENDING'].includes(state.syncStatus));
const transitionOwned=(row,fixture)=>row&&row.operationId===fixture.operationId&&row.userId===fixture.uid&&row.securityVersion===1&&row.membershipStatus==='PENDING'&&row.desiredEnabled===false&&row.desiredAdmin===false&&
  row.actorKind==='OPERATOR'&&row.actorId===fixture.marker&&row.reason==='Dev reconciliation volume fixture'&&row.noOp===false&&row.verificationEmail==null&&row.startedAdminDelta===0&&row.completedAdminDelta===0;

/** No cloud call, credential discovery, logging, fixture write or subprocess occurs at construction. */
export function createReconciliationVolumeCloud({repositoryRoot,runDirectory,manifest,fetch:fetcher=globalThis.fetch,adminFactory=adminDefault,
  environment=process.env,nodeVersion=process.version,now=()=>new Date(),evidence={}}){
  assert(path.isAbsolute(repositoryRoot??'')&&path.isAbsolute(runDirectory??''),'ABSOLUTE_PROVIDER_DIRECTORIES_REQUIRED');
  const plan=validateManifest(manifest),manifestHash=stableHash(plan),allowed=new Map(plan.fixtures.map(row=>[row.uid,row]));
  let adminPromise,closed=false,lastObservation,drainCache,requiredDrainAnchor=plan.createdAt,requiredDrainExecution=null;
  const clock=()=>clockDate(now);
  function requireDrainAnchor(anchor){
    assert(canonicalTimestamp(anchor)&&Date.parse(anchor)>=Date.parse(plan.createdAt)&&Date.parse(anchor)<=Date.parse(clock())+1000,'CANONICAL_DRAIN_ANCHOR_REQUIRED');
    if(Date.parse(anchor)>Date.parse(requiredDrainAnchor)){requiredDrainAnchor=anchor;requiredDrainExecution=null;drainCache=undefined;}
    return requiredDrainAnchor;
  }
  function validateDrainExecution(execution,anchor){
    assert(execution&&Object.keys(execution).every(key=>['measurementId','notBefore','targetSize','executionId'].includes(key))&&
      typeof execution.measurementId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(execution.measurementId)&&execution.notBefore===anchor&&Number.isSafeInteger(execution.targetSize)&&execution.targetSize>=2&&execution.targetSize<=10000&&
      (execution.executionId===undefined||typeof execution.executionId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(execution.executionId)),'ARMED_DRAIN_EXECUTION_REQUIRED');
    return clone(execution);
  }
  function requireDrainExecution(execution){
    if(execution){const validated=validateDrainExecution(execution,requiredDrainAnchor);if(stableHash(validated)!==stableHash(requiredDrainExecution)){requiredDrainExecution=validated;drainCache=undefined;}}
    assert(Date.parse(requiredDrainAnchor)===Date.parse(plan.createdAt)||requiredDrainExecution,'ARMED_DRAIN_EXECUTION_REQUIRED');
  }
  const guard=()=>{assert(!closed,'VOLUME_PROVIDER_CLOSED');assertReconciliationVolumeEnvironment(environment,nodeVersion);};
  async function admin(){guard();adminPromise??=adminFactory({repositoryRoot,projectId:PROJECT,manifest:clone(plan)});return adminPromise;}
  async function graphql(query,variables={},read=true){
    const operations=new Set(['ReconciliationVolumeControl','ReconciliationVolumeScan','ReconciliationVolumeFixture','ReconciliationVolumeCreateProfile','ReconciliationVolumeCleanup','ReconciliationVolumeRateCleanup','ReconciliationVolumeBatch','ReconciliationVolumeCurrentAdmins']);
    const tables=new Set(['users','userSecurityStates','securityTransitions','callableRateLimitBuckets','callableInvocations','notificationDeliveries','notifyDeliveryReceipts','legacyUserIdentities','userUserGroups','sectionAnnouncementOptOuts','bookings','bookingPlaces','bookingLines','ticketOrders','potentialLostReviews','announcementRecipients']);
    const operation=query.match(/^(?:query|mutation)\s+(\w+)/)?.[1],table=operation==='ReconciliationVolumeScan'?query.match(/\{(\w+)\(/)?.[1]:null;
    const label=[operations.has(operation)?operation:'UnknownOperation',...(table?[tables.has(table)?table:'UnknownTable']:[])].join('_').replace(/([a-z0-9])([A-Z])/g,'$1_$2').toUpperCase();
    try{const provider=await admin(),method=read?(provider.dc.executeGraphqlRead??provider.dc.executeGraphql):provider.dc.executeGraphql;
      const result=await method.call(provider.dc,query,{variables});assert(result?.data&&!result.errors?.length,`VOLUME_DATABASE_RESPONSE_INVALID_${label}`);return result.data;
    }catch(error){if(error instanceof ReconciliationVolumeCloudError)throw error;throw new ReconciliationVolumeCloudError(`VOLUME_DATABASE_OPERATION_FAILED_${label}`);}
  }
  async function request(host,resource,{method='GET',body,withDate=false}={}){
    try{const provider=await admin(),token=await provider.accessToken();assert(typeof token==='string'&&token.length>0,'PROVIDER_ACCESS_TOKEN_REQUIRED');
      const response=await fetcher(`https://${host}${resource}`,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':PROJECT,...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
      assert(response.ok,'VOLUME_PROVIDER_REQUEST_FAILED');const data=await response.json();
      if(withDate){const value=response.headers?.get('date');assert(Number.isFinite(Date.parse(value)),'PROVIDER_OBSERVATION_DATE_REQUIRED');return {data,observedAt:new Date(value).toISOString()};}return data;
    }catch(error){if(error instanceof ReconciliationVolumeCloudError)throw error;throw new ReconciliationVolumeCloudError('VOLUME_PROVIDER_REQUEST_FAILED');}
  }
  async function metadata(){
    const [jobRead,fn]=await Promise.all([request('cloudscheduler.googleapis.com',`/v1/${JOB}`,{withDate:true}),request('cloudfunctions.googleapis.com',`/v2/${FUNCTION_RESOURCE}`)]);
    const job=jobRead.data;
    assert(job.name===JOB&&['ENABLED','PAUSED'].includes(job.state)&&job.httpTarget?.httpMethod==='POST'&&!job.pubsubTarget&&!job.appEngineHttpTarget,'EXACT_RECONCILIATION_HTTP_JOB_REQUIRED');
    assert(fn.name===FUNCTION_RESOURCE&&fn.state==='ACTIVE'&&fn.environment==='GEN_2'&&typeof fn.serviceConfig?.revision==='string'&&fn.serviceConfig.timeoutSeconds===540,'ACTIVE_RECONCILIATION_DEPLOYMENT_REQUIRED');
    assert([fn.serviceConfig.uri,`https://${REGION}-${PROJECT}.cloudfunctions.net/${FUNCTION}`].includes(job.httpTarget.uri)&&job.httpTarget.oidcToken?.serviceAccountEmail===fn.serviceConfig.serviceAccountEmail&&(!job.httpTarget.oidcToken.audience||job.httpTarget.oidcToken.audience===job.httpTarget.uri),'RECONCILIATION_TARGET_IDENTITY_MISMATCH');
    const timestamp=field=>{const value=job[field];assert(value==null||(typeof value==='string'&&Number.isFinite(Date.parse(value))),'SCHEDULER_ATTEMPT_TIMESTAMP_INVALID');return value==null?null:new Date(value).toISOString();};
    const attemptEvidence={lastAttemptTime:timestamp('lastAttemptTime'),scheduleTime:timestamp('scheduleTime')};
    attemptEvidence.informative=Boolean(attemptEvidence.lastAttemptTime||attemptEvidence.scheduleTime);
    const result={scheduler:{resource:JOB,state:job.state,configurationHash:stableHash(schedulerConfiguration(job))},deployment:{revision:fn.serviceConfig.revision,proofHash:stableHash(deploymentProof(fn))},
      providerObservedAt:jobRead.observedAt,attemptEvidence,attemptHash:stableHash(attemptEvidence)};
    if(plan.baseline)assert(result.scheduler.configurationHash===plan.baseline.scheduler.configurationHash&&result.deployment.proofHash===plan.baseline.deployment.proofHash&&result.deployment.revision===plan.baseline.deployment.revision,'VOLUME_DEPLOYMENT_OR_SCHEDULER_DRIFT');
    return result;
  }
  async function paged(table,selection,orderBy,where=''){
    const rows=[];for(let offset=0;offset<=1000000;offset+=1000){const result=await graphql(`query ReconciliationVolumeScan($offset:Int!){${table}(${where}orderBy:{${orderBy}:ASC},limit:1000,offset:$offset){${selection}}}`,{offset});
      assert(Array.isArray(result[table]),'VOLUME_DATABASE_PAGE_INVALID');rows.push(...result[table]);if(result[table].length<1000)return rows;}
    throw new ReconciliationVolumeCloudError('VOLUME_SCAN_BOUND_EXCEEDED');
  }
  async function configuration(){const data=await graphql('query ReconciliationVolumeControl{govNotifyDeliveryConfiguration(key:{id:"site-wide"}){id mode version updatedAt updatedBy} adminSafetyControl(key:{id:"site-wide"}){id version readyAdminCount status}}');
    const mode=data.govNotifyDeliveryConfiguration?.mode;assert(['LIVE','TEAM_TEST','SIMULATION'].includes(mode),'KNOWN_NOTIFICATION_MODE_REQUIRED');
    return {notifySimulation:mode==='SIMULATION',notification:{mode,configurationHash:stableHash(data.govNotifyDeliveryConfiguration)},control:data.adminSafetyControl};}
  async function authUsers(){const rows=[],seen=new Set();let pageToken;do{const page=await(await admin()).auth.listUsers(1000,pageToken);assert(Array.isArray(page.users),'VOLUME_AUTH_PAGE_INVALID');rows.push(...page.users);pageToken=page.pageToken;
    if(pageToken){assert(!seen.has(pageToken),'VOLUME_AUTH_PAGE_REPEATED');seen.add(pageToken);}assert(rows.length<=1000000,'VOLUME_AUTH_SCAN_BOUND_EXCEEDED');}while(pageToken);return rows;}
  async function observe(){
    guard();const [meta,settings,identities,profiles,states,transitions,rateRows,invocations,notifications,receipts,otherRows]=await Promise.all([
      metadata(),configuration(),authUsers(),paged('users','id firstName lastName email serviceNumber membershipStatus createdBy updatedBy announcementOptOutAll','id'),
      paged('userSecurityStates','userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail accessReady adminReady operationId syncStatus user{membershipStatus email}','userId'),
      paged('securityTransitions','operationId userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail actorId actorKind reason noOp syncStatus startedAdminDelta completedAdminDelta','operationId'),
      paged('callableRateLimitBuckets','userId functionName windowStart','userId'),paged('callableInvocations','userId functionName','userId'),
      paged('notificationDeliveries','id userId recipientUserId','id'),paged('notifyDeliveryReceipts','id userId','id'),
      Promise.all([['legacyUserIdentities','userId','userId'],['userUserGroups','userId userGroupId','userId'],['sectionAnnouncementOptOuts','userId sectionId','userId'],['bookings','id bookerId approvalReviewedById','id'],
        ['bookingPlaces','id bookerId','id'],['bookingLines','id guestUserId','id'],['ticketOrders','id userId','id'],['potentialLostReviews','id userId','id'],['announcementRecipients','id userId','id']].map(([table,fields,order])=>paged(table,fields,order)))]);
    const ownId=id=>typeof id==='string'&&id.startsWith(plan.fixturePrefix);
    const real={identities:identities.filter(row=>!allowed.has(row.uid)),profiles:profiles.filter(row=>!allowed.has(row.id)),states:states.filter(row=>!allowed.has(row.userId)),pendingTransitions:transitions.filter(row=>!allowed.has(row.userId)&&row.syncStatus==='PENDING'),control:settings.control};
    const audit=evaluateAuthority({...real,requireBackfill:true});
    const fingerprint=stableHash({identities:sorted(real.identities.map(row=>({uid:row.uid,email:row.email??null,emailVerified:row.emailVerified,disabled:row.disabled,customClaims:row.customClaims??{},tokensValidAfterTime:row.tokensValidAfterTime??null})),'uid'),
      profiles:sorted(real.profiles,'id'),states:sorted(real.states,'userId'),control:{status:settings.control?.status,readyAdminCount:settings.control?.readyAdminCount}});
    const byIdentity=new Map(identities.map(row=>[row.uid,row])),byProfile=new Map(profiles.map(row=>[row.id,row])),byState=new Map(states.map(row=>[row.userId,row])),byTransition=new Map(transitions.map(row=>[row.operationId,row]));
    let validDeniedReady=0,unexpectedOwnedRows=0;
    for(const fixture of plan.fixtures){
      const identity=byIdentity.get(fixture.uid),profile=byProfile.get(fixture.uid),state=byState.get(fixture.uid),transition=byTransition.get(fixture.operationId);
      if(identityOwned(identity,fixture)&&profileOwned(profile,fixture)&&stateOwned(state,fixture,true)&&transitionOwned(transition,fixture)&&transition.syncStatus==='READY'&&identity.customClaims?.securityVersion===1&&identity.customClaims?.enabled===false&&identity.customClaims?.admin===false)validDeniedReady++;
      if((identity&&!identityOwned(identity,fixture))||(profile&&!profileOwned(profile,fixture))||(state&&!stateOwned(state,fixture))||(transition&&!transitionOwned(transition,fixture)))unexpectedOwnedRows++;
    }
    unexpectedOwnedRows+=identities.filter(row=>ownId(row.uid)&&!allowed.has(row.uid)).length+profiles.filter(row=>ownId(row.id)&&!allowed.has(row.id)).length+states.filter(row=>ownId(row.userId)&&!allowed.has(row.userId)).length;
    unexpectedOwnedRows+=transitions.filter(row=>(ownId(row.userId)||row.operationId?.startsWith(`rcv-init:${plan.runId}:`))&&(!allowed.has(row.userId)||allowed.get(row.userId).operationId!==row.operationId)).length;
    unexpectedOwnedRows+=[...rateRows,...invocations].filter(row=>ownId(row.userId)&&!allowed.has(row.userId)).length;
    const notificationRows=notifications.filter(row=>ownId(row.userId)||ownId(row.recipientUserId)).length,receiptRows=receipts.filter(row=>ownId(row.userId)).length;
    unexpectedOwnedRows+=notificationRows+receiptRows+otherRows.flat().filter(row=>Object.values(row).some(ownId)).length;
    lastObservation={projectId:PROJECT,notifySimulation:settings.notifySimulation,currentAuthorityPassed:audit.passed,baselineAuthorityPassed:audit.passed&&(!plan.baseline||fingerprint===plan.baseline.fingerprint),controlReady:audit.controlReady,
      readyAdminCount:settings.control?.readyAdminCount??0,pendingTransitions:transitions.filter(row=>row.syncStatus==='PENDING').length,baselineFingerprint:fingerprint,
      notification:settings.notification,counts:{identities:identities.length,profiles:profiles.length,states:states.length},scheduler:meta.scheduler,deployment:meta.deployment,
      fixtures:{identities:identities.filter(row=>allowed.has(row.uid)).length,profiles:profiles.filter(row=>allowed.has(row.id)).length,states:states.filter(row=>allowed.has(row.userId)).length,
        validDeniedReady,nonterminalTransitions:transitions.filter(row=>allowed.has(row.userId)&&!TERMINAL.has(row.syncStatus)).length,unexpectedOwnedRows,
        rateRows:rateRows.filter(row=>allowed.has(row.userId)).length,invocations:invocations.filter(row=>allowed.has(row.userId)).length,notificationRows,receiptRows}};
    return clone(lastObservation);
  }
  function fixtureArgument(fixture){const owned=allowed.get(fixture?.uid);assert(owned&&stableHash(owned)===stableHash(fixture),'MANIFEST_FIXTURE_REQUIRED');return owned;}
  async function receiptFile(name,optional=false){try{const filename=path.join(runDirectory,name),info=await lstat(filename);assert(info.isFile()&&!info.isSymbolicLink()&&(info.mode&0o077)===0,'PRIVATE_EVIDENCE_FILE_REQUIRED');return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(optional&&error?.code==='ENOENT')return null;if(error instanceof ReconciliationVolumeCloudError)throw error;throw new ReconciliationVolumeCloudError('PROVIDER_EVIDENCE_REQUIRED');}}
  function pauseCapture(record){const capture=clone(record);delete capture.captureHash;delete capture.verifiedAt;delete capture.logsProofHash;delete capture.handlerCompletionHash;return capture;}
  async function savePause(record){const directory=await lstat(runDirectory);assert(directory.isDirectory()&&!directory.isSymbolicLink()&&(directory.mode&0o077)===0,'PRIVATE_RUN_DIRECTORY_REQUIRED');
    const capture=pauseCapture(record);assert(record.captureHash===stableHash(capture),'PAUSE_CAPTURE_HASH_MISMATCH');
    const captureName=`provider-pause-capture-${record.captureHash}.json`,existing=await receiptFile(captureName,true);
    if(existing)assert(stableHash(existing)===record.captureHash,'IMMUTABLE_PAUSE_CAPTURE_CHANGED');
    else{const immutable=await open(path.join(runDirectory,captureName),'wx',0o600);try{await immutable.writeFile(JSON.stringify(capture)+'\n');await immutable.sync();}finally{await immutable.close();}}
    const next=path.join(runDirectory,`provider-pause-${randomUUID()}.next`),file=await open(next,'wx',0o600);try{await file.writeFile(JSON.stringify(record)+'\n');await file.sync();}finally{await file.close();}await rename(next,path.join(runDirectory,'provider-pause.json'));}
  function receiptIdentity(receipt,schema){assert(receipt?.schemaVersion===schema&&receipt.projectId===PROJECT&&receipt.runId===plan.runId&&receipt.manifestHash===manifestHash&&receipt.schedulerResource===JOB&&
    receipt.configurationHash===plan.baseline.scheduler.configurationHash&&receipt.deploymentProofHash===plan.baseline.deployment.proofHash&&typeof receipt.evidenceReference==='string'&&receipt.evidenceReference.length>0,'PROVIDER_EVIDENCE_IDENTITY_MISMATCH');}
  async function validatePause(record,meta){
    receiptIdentity(record,'sodc-reconciliation-volume-pause/v1');
    const keys=['schemaVersion','projectId','runId','manifestHash','schedulerResource','configurationHash','deploymentProofHash','evidenceReference','attemptHash','attemptEvidence','drainNotBefore','drainExecution','pausedAt','notBefore','captureHash','verifiedAt','logsProofHash','handlerCompletionHash'];
    assert(Object.keys(record).every(key=>keys.includes(key))&&HASH.test(record.attemptHash??'')&&HASH.test(record.captureHash??'')&&canonicalTimestamp(record.pausedAt)&&canonicalTimestamp(record.notBefore)&&canonicalTimestamp(record.drainNotBefore)&&
      Date.parse(record.drainNotBefore)>=Date.parse(plan.createdAt)&&Date.parse(record.pausedAt)>=Date.parse(record.drainNotBefore)&&Date.parse(record.pausedAt)<=Date.parse(meta.providerObservedAt)&&Date.parse(record.notBefore)===Date.parse(record.pausedAt)+600000,'PAUSE_RECORD_INVALID');
    assert(record.drainExecution===null||record.drainExecution&&validateDrainExecution(record.drainExecution,record.drainNotBefore),'PAUSE_DRAIN_EXECUTION_INVALID');
    assert(Date.parse(record.drainNotBefore)===Date.parse(plan.createdAt)||record.drainExecution,'PAUSE_DRAIN_EXECUTION_INVALID');
    const attempt=record.attemptEvidence;
    assert(attempt&&Object.keys(attempt).length===3&&Object.keys(attempt).every(key=>['lastAttemptTime','scheduleTime','informative'].includes(key))&&
      [attempt.lastAttemptTime,attempt.scheduleTime].every(value=>value===null||canonicalTimestamp(value))&&attempt.informative===Boolean(attempt.lastAttemptTime||attempt.scheduleTime)&&stableHash(attempt)===record.attemptHash,'PAUSE_ATTEMPT_EVIDENCE_INVALID');
    assert((record.verifiedAt===undefined&&record.logsProofHash===undefined&&record.handlerCompletionHash===undefined)||(canonicalTimestamp(record.verifiedAt)&&Date.parse(record.verifiedAt)>=Date.parse(record.notBefore)&&Date.parse(record.verifiedAt)<=Date.parse(meta.providerObservedAt)&&HASH.test(record.logsProofHash??'')&&
      (record.drainExecution?HASH.test(record.handlerCompletionHash??''):record.handlerCompletionHash===undefined)),'PAUSE_VERIFICATION_RECORD_INVALID');
    assert(stableHash(pauseCapture(record))===record.captureHash,'PAUSE_CAPTURE_HASH_MISMATCH');
    const capture=await receiptFile(`provider-pause-capture-${record.captureHash}.json`);assert(stableHash(capture)===record.captureHash,'IMMUTABLE_PAUSE_CAPTURE_CHANGED');
    return record;
  }
  async function handlerDrainProof(execution){
    const receipt=await receiptFile(`handler-drain-${execution.measurementId}.json`,true);assert(receipt,'DRAIN_HANDLER_COMPLETION_REQUIRED');
    receiptIdentity(receipt,'sodc-reconciliation-volume-handler-drain/v1');
    assert(receipt.measurementId===execution.measurementId&&receipt.notBefore===execution.notBefore&&receipt.targetSize===execution.targetSize&&receipt.revision===plan.baseline.deployment.revision&&
      typeof receipt.executionId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(receipt.executionId)&&(!execution.executionId||receipt.executionId===execution.executionId)&&typeof receipt.insertId==='string'&&receipt.insertId.length>0,'DRAIN_HANDLER_COMPLETION_IDENTITY_MISMATCH');
    const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)&&Number.isFinite(Date.parse(value));
    assert(timestamp(receipt.startedAt)&&timestamp(receipt.completedAt)&&Date.parse(receipt.startedAt)>=Date.parse(execution.notBefore)&&Date.parse(receipt.completedAt)>=Date.parse(receipt.startedAt)&&Date.parse(receipt.completedAt)<=Date.parse(clock())+1000,'DRAIN_HANDLER_COMPLETION_WINDOW_INVALID');
    const entries=await logsQuery({executionId:receipt.executionId,from:receipt.startedAt,to:receipt.completedAt,completionOnly:true});
    assert(entries.length===1&&entries[0].insertId===receipt.insertId&&entries[0].jsonPayload?.message==='Security reconciliation completed','DRAIN_HANDLER_COMPLETION_REQUIRED');
    const fields=entries[0].jsonPayload;
    assert(['stateAttempts','pendingAttempts','failedAttempts'].every(key=>Number.isSafeInteger(fields[key])&&fields[key]>=0)&&Number.isFinite(fields.durationMs)&&fields.durationMs>=0,'DRAIN_HANDLER_COMPLETION_FIELDS_INVALID');
    // Completion proves the handler has left its loop. Failed work and a prior
    // request timeout remain capacity findings; they never become a passing run.
    return stableHash({receipt,entry:{insertId:entries[0].insertId,timestamp:entries[0].timestamp,resource:entries[0].resource,labels:entries[0].labels,fields}});
  }
  async function drain(meta){
    if(evidence.drain){const proof=await evidence.drain({drainNotBefore:requiredDrainAnchor,drainExecution:requiredDrainExecution});receiptIdentity(proof,'sodc-reconciliation-volume-drain/v1');
      assert(proof.drainNotBefore===requiredDrainAnchor&&proof.inFlightExecutions===0&&Number.isFinite(Date.parse(proof.observedAt))&&Date.parse(proof.observedAt)<=Date.parse(clock())+1000&&Date.parse(clock())-Date.parse(proof.observedAt)<=300000,'RECENT_QUIESCENT_SCHEDULER_PROOF_REQUIRED');return {quiescent:true,proofHash:stableHash(proof)};}
    const record=await validatePause(await receiptFile('provider-pause.json'),meta);
    if(Date.parse(record.drainNotBefore)>Date.parse(requiredDrainAnchor)){requireDrainAnchor(record.drainNotBefore);requireDrainExecution(record.drainExecution);}
    else if(!requiredDrainExecution&&record.drainExecution)requireDrainExecution(record.drainExecution);
    assert(Date.parse(record.drainNotBefore)>=Date.parse(requiredDrainAnchor)&&Date.parse(record.pausedAt)>=Date.parse(requiredDrainAnchor)&&stableHash(record.drainExecution)===stableHash(requiredDrainExecution),'POST_MEASUREMENT_PAUSE_REQUIRED');
    // PAUSED jobs can omit both attempt timestamps, even after a forced run.
    // A matching hash is supporting evidence only; the durable armed-window
    // anchor and a new provider-stamped timeout window are always required.
    assert(meta.scheduler.state==='PAUSED'&&record.attemptHash===meta.attemptHash,'PAUSE_ATTEMPT_CHANGED_CALL_PAUSE_AGAIN');
    assert(Date.parse(meta.providerObservedAt)>=Date.parse(record.notBefore),'WAIT_FOR_RECONCILIATION_DRAIN');
    if(drainCache?.captureHash===record.captureHash){assert(drainCache.recordHash===stableHash(record),'DRAIN_PROOF_CHANGED');return {quiescent:true,proofHash:drainCache.proofHash};}
    // A saved verification is audit evidence, never permission to skip fresh
    // provider verification in another process. Cache only this process's proof.
    {
      const handlerCompletionHash=record.drainExecution?await handlerDrainProof(record.drainExecution):undefined;
      const entries=await logsQuery({from:new Date(Date.parse(record.pausedAt)-540000).toISOString(),to:meta.providerObservedAt});
      // A request timeout does not terminate its container or handler. Every
      // visible execution needs the actual application's completion message;
      // forced epochs additionally require the exact armed completion proof.
      const executions=new Map();for(const entry of entries){const id=entry.labels?.execution_id;if(id){const group=executions.get(id)??[];group.push(entry);executions.set(id,group);}}
      for(const group of executions.values())assert(group.some(entry=>entry.jsonPayload?.message==='Security reconciliation completed'),'VISIBLE_EXECUTION_HAS_NO_TERMINAL_LOG');
      record.verifiedAt=meta.providerObservedAt;record.logsProofHash=stableHash(entries.map(entry=>({insertId:entry.insertId,timestamp:entry.timestamp,executionId:entry.labels?.execution_id??null,message:entry.jsonPayload?.message??entry.textPayload??null})));
      if(handlerCompletionHash)record.handlerCompletionHash=handlerCompletionHash;
      await savePause(record);
    }
    const proofHash=stableHash(record);drainCache={captureHash:record.captureHash,recordHash:proofHash,proofHash};return {quiescent:true,proofHash};
  }
  async function boundary({expiredCleanup=false,requireDrain=true}={}){
    guard();assert(plan.baseline,'FINAL_VOLUME_BASELINE_REQUIRED');
    if(!expiredCleanup)assert(Date.parse(clock())<=Date.parse(plan.expiresAt),'VOLUME_MANIFEST_EXPIRED');
    const [settings,meta]=await Promise.all([configuration(),metadata()]);
    assert(stableHash(settings.notification)===stableHash(plan.baseline.notification),'NOTIFICATION_CONFIGURATION_CHANGED');
    if(expiredCleanup){assert(settings.control?.status==='READY'&&Number.isSafeInteger(settings.control.readyAdminCount)&&settings.control.readyAdminCount>=1,'CURRENT_ADMINISTRATOR_CONTROL_UNSAFE');await currentAdministrators(settings.control);}
    else assert(settings.control?.status==='READY'&&settings.control.readyAdminCount===plan.baseline.readyAdminCount,'REAL_ADMINISTRATOR_CONTROL_CHANGED');
    assert(meta.scheduler.state==='PAUSED','PAUSED_RECONCILIATION_REQUIRED');
    if(requireDrain)await drain(meta);return meta;
  }
  async function pauseScheduler({cleanup=false,drainNotBefore=plan.createdAt,drainExecution}={}){
    guard();assert(plan.baseline,'FINAL_VOLUME_BASELINE_REQUIRED');
    requireDrainAnchor(drainNotBefore);
    requireDrainExecution(drainExecution);
    const settings=await configuration();assert(stableHash(settings.notification)===stableHash(plan.baseline.notification),'NOTIFICATION_CONFIGURATION_CHANGED');
    if(cleanup){assert(settings.control?.status==='READY'&&Number.isSafeInteger(settings.control.readyAdminCount)&&settings.control.readyAdminCount>=1,'CURRENT_ADMINISTRATOR_CONTROL_UNSAFE');await currentAdministrators(settings.control);}
    else assert(settings.control?.status==='READY'&&settings.control.readyAdminCount===plan.baseline.readyAdminCount,'REAL_ADMINISTRATOR_CONTROL_CHANGED');
    const before=await metadata();if(before.scheduler.state!=='PAUSED')await request('cloudscheduler.googleapis.com',`/v1/${JOB}:pause`,{method:'POST',body:{}});
    const after=await metadata();assert(after.scheduler.state==='PAUSED','SCHEDULER_PAUSE_NOT_VERIFIED');
    if(!evidence.drain){let record=await receiptFile('provider-pause.json',true);
      if(record){await validatePause(record,after);if(Date.parse(record.drainNotBefore)>Date.parse(requiredDrainAnchor)){requireDrainAnchor(record.drainNotBefore);requireDrainExecution(record.drainExecution);}else if(!requiredDrainExecution&&record.drainExecution)requireDrainExecution(record.drainExecution);}
      if(!record||record.attemptHash!==after.attemptHash||Date.parse(record.drainNotBefore)<Date.parse(requiredDrainAnchor)||Date.parse(record.pausedAt)<Date.parse(requiredDrainAnchor)||stableHash(record.drainExecution)!==stableHash(requiredDrainExecution)){
        assert(Date.parse(after.providerObservedAt)>=Date.parse(requiredDrainAnchor),'WAIT_FOR_POST_ANCHOR_PROVIDER_OBSERVATION');
        record={schemaVersion:'sodc-reconciliation-volume-pause/v1',projectId:PROJECT,runId:plan.runId,manifestHash,schedulerResource:JOB,configurationHash:after.scheduler.configurationHash,
        deploymentProofHash:after.deployment.proofHash,evidenceReference:'Provider-confirmed PAUSED job after the latest durable measurement arm; forced epochs require actual handler completion in addition to the 600-second observation window',attemptHash:after.attemptHash,attemptEvidence:after.attemptEvidence,drainNotBefore:requiredDrainAnchor,drainExecution:requiredDrainExecution,pausedAt:after.providerObservedAt,notBefore:new Date(Date.parse(after.providerObservedAt)+600000).toISOString()};
        record.captureHash=stableHash(record);drainCache=undefined;await savePause(record);}}
    return drain(after);
  }
  async function restoreScheduler(){
    await boundary({expiredCleanup:true});const observed=await observe();
    assert(observed.currentAuthorityPassed&&observed.fixtures.identities===0&&observed.fixtures.profiles===0&&observed.fixtures.states===0&&observed.fixtures.rateRows===0&&observed.fixtures.invocations===0&&observed.fixtures.nonterminalTransitions===0&&observed.fixtures.unexpectedOwnedRows===0,'COMPLETE_FIXTURE_CLEANUP_REQUIRED');
    if(plan.baseline.scheduler.state==='ENABLED')await request('cloudscheduler.googleapis.com',`/v1/${JOB}:resume`,{method:'POST',body:{}});
    const after=await metadata();assert(after.scheduler.state===plan.baseline.scheduler.state,'ORIGINAL_SCHEDULER_STATE_NOT_RESTORED');return after.scheduler;
  }
  async function identity(uid){try{return await(await admin()).auth.getUser(uid);}catch(error){if(error?.code==='auth/user-not-found')return null;throw new ReconciliationVolumeCloudError('FIXTURE_IDENTITY_READ_FAILED');}}
  async function identitiesFor(fixtures){
    const requested=new Set(fixtures.map(row=>row.uid)),result=await(await admin()).auth.getUsers(fixtures.map(row=>({uid:row.uid}))),found=new Map(),missing=new Set();
    assert(Array.isArray(result?.users)&&Array.isArray(result.notFound),'FIXTURE_BULK_IDENTITIES_RESPONSE_INVALID');
    for(const user of result.users){assert(requested.has(user?.uid)&&!found.has(user.uid),'FOREIGN_OR_DUPLICATE_BULK_IDENTITY');found.set(user.uid,user);}
    for(const row of result.notFound){assert(requested.has(row?.uid)&&!missing.has(row.uid)&&!found.has(row.uid),'FOREIGN_OR_DUPLICATE_BULK_IDENTITY');missing.add(row.uid);}
    assert(found.size+missing.size===requested.size,'FIXTURE_BULK_IDENTITIES_INCOMPLETE');return found;
  }
  async function currentAdministrators(control){
    const data=await graphql('query ReconciliationVolumeCurrentAdmins{userSecurityStates(where:{adminReady:{eq:true}},limit:1001){userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail accessReady adminReady operationId syncStatus user{membershipStatus email}}}');
    const states=data.userSecurityStates;assert(Array.isArray(states)&&states.length>0&&states.length<1001&&states.every(row=>!allowed.has(row.userId)),'CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');
    const identities=[];for(let offset=0;offset<states.length;offset+=100)identities.push(...(await identitiesFor(states.slice(offset,offset+100).map(row=>({uid:row.userId})))).values());
    const profiles=states.map(row=>({id:row.userId,email:row.user?.email,membershipStatus:row.user?.membershipStatus}));
    assert(evaluateAuthority({identities,profiles,states,pendingTransitions:0,control,requireBackfill:true}).passed,'CURRENT_ADMINISTRATOR_ROSTER_UNSAFE');
  }
  async function fixtureBatchRows(fixtures){
    const ids=fixtures.map(row=>row.uid),operationIds=fixtures.map(row=>row.operationId),requested=new Map(fixtures.map(row=>[row.uid,row]));
    const data=await graphql('query ReconciliationVolumeBatch($ids:[String!]!,$operationIds:[String!]!){'+
      'users(where:{id:{in:$ids}},limit:101){id firstName lastName email serviceNumber membershipStatus createdBy updatedBy announcementOptOutAll} '+
      'userSecurityStates(where:{userId:{in:$ids}},limit:101){userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail accessReady adminReady operationId syncStatus} '+
      'securityTransitions(where:{_or:[{userId:{in:$ids}},{operationId:{in:$operationIds}}]},limit:201){operationId userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail actorId actorKind reason noOp syncStatus startedAdminDelta completedAdminDelta} '+
      'callableRateLimitBuckets(where:{userId:{in:$ids}},limit:1){userId} callableInvocations(where:{userId:{in:$ids}},limit:1){userId}}',{ids,operationIds});
    const maps={};for(const [table,key]of [['users','id'],['userSecurityStates','userId'],['securityTransitions','operationId']]){
      const rows=data[table],map=new Map();assert(Array.isArray(rows)&&rows.length<=fixtures.length,'SCOPED_DATABASE_BATCH_INVALID');
      for(const row of rows){const uid=table==='users'?row.id:row.userId;assert(requested.has(uid)&&!map.has(row[key])&&(table!=='securityTransitions'||requested.get(uid).operationId===row.operationId),'FOREIGN_OR_DUPLICATE_DATABASE_BATCH_ROW');map.set(row[key],row);}maps[table]=map;
    }
    for(const table of ['callableRateLimitBuckets','callableInvocations'])assert(Array.isArray(data[table])&&data[table].length<=1&&data[table].every(row=>requested.has(row.userId)),'SCOPED_RATE_BATCH_INVALID');
    return {...maps,rates:data.callableRateLimitBuckets,invocations:data.callableInvocations};
  }
  function validateFixtureBatch(fixtures,users,rows,{ready=false}={}){
    for(const fixture of fixtures){const user=users.get(fixture.uid),profile=rows.users.get(fixture.uid),state=rows.userSecurityStates.get(fixture.uid),transition=rows.securityTransitions.get(fixture.operationId);
      assert(!user||identityOwned(user,fixture),'FOREIGN_FIXTURE_IDENTITY');assert(!profile||profileOwned(profile,fixture),'FOREIGN_FIXTURE_PROFILE');assert(!state||stateOwned(state,fixture,ready),'FOREIGN_FIXTURE_AUTHORITY');assert(!transition||transitionOwned(transition,fixture),'FOREIGN_FIXTURE_TRANSITION');
      assert(!state||transition,'FIXTURE_AUDIT_RECEIPT_REQUIRED');if(ready)assert(!transition||TERMINAL.has(transition.syncStatus),'TERMINAL_FIXTURE_RECEIPT_REQUIRED');
    }
  }
  async function fixtureRows(fixture){const data=await graphql('query ReconciliationVolumeFixture($uid:String!,$operationId:String!){user(id:$uid){id firstName lastName email serviceNumber membershipStatus createdBy updatedBy announcementOptOutAll} userSecurityState(key:{userId:$uid}){userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail accessReady adminReady operationId syncStatus} securityTransition(key:{operationId:$operationId}){operationId userId securityVersion membershipStatus desiredEnabled desiredAdmin verificationEmail actorId actorKind reason noOp syncStatus startedAdminDelta completedAdminDelta}}',{uid:fixture.uid,operationId:fixture.operationId});return {profile:data.user,state:data.userSecurityState,transition:data.securityTransition};}
  async function coordinator(){const provider=await admin();return provider.getCoordinator?provider.getCoordinator():provider.coordinator;}
  async function createFixture(input){
    const fixture=fixtureArgument(input);await boundary();let current=await identity(fixture.uid);let rows=await fixtureRows(fixture);
    assert(!current||identityOwned(current,fixture),'FOREIGN_FIXTURE_IDENTITY');assert(!rows.profile||profileOwned(rows.profile,fixture),'FOREIGN_FIXTURE_PROFILE');
    assert(!rows.state||stateOwned(rows.state,fixture),'FOREIGN_FIXTURE_AUTHORITY');assert(!rows.transition||transitionOwned(rows.transition,fixture),'FOREIGN_FIXTURE_TRANSITION');
    assert(!rows.transition||rows.transition.syncStatus!=='SUPERSEDED','RETIRED_FIXTURE_CANNOT_BE_RECREATED');
    if(!current){assert(!rows.profile&&!rows.state&&!rows.transition,'PARTIALLY_RETIRED_FIXTURE_CANNOT_BE_RECREATED');try{await(await admin()).auth.createUser({uid:fixture.uid,displayName:fixture.marker,disabled:true,emailVerified:false});}catch{current=await identity(fixture.uid);assert(identityOwned(current,fixture),'FIXTURE_AUTH_CREATION_UNCERTAIN');}}
    if(!rows.profile){
      const fields=expectedProfile(fixture);try{await graphql('mutation ReconciliationVolumeCreateProfile($id:String!,$email:String!,$marker:String!,$now:Timestamp!){user_insert(data:{id:$id,firstName:"Reconciliation",lastName:"Volume fixture",email:$email,serviceNumber:$id,membershipStatus:PENDING,announcementOptOutAll:true,createdBy_expr:"vars.marker",updatedBy_expr:"vars.marker",createdAt:$now,updatedAt:$now})}',{id:fixture.uid,email:fields.email,marker:fixture.marker,now:clock()},false);}catch{rows=await fixtureRows(fixture);assert(profileOwned(rows.profile,fixture),'FIXTURE_PROFILE_CREATION_UNCERTAIN');}
    }
    try{const sync=await coordinator();assert(typeof sync?.initializeUserSecurityState==='function','BUILT_COORDINATOR_REQUIRED');await sync.initializeUserSecurityState({userId:fixture.uid,actorId:fixture.marker,actorKind:'OPERATOR',operationId:fixture.operationId,reason:'Dev reconciliation volume fixture',allowAdminBootstrap:false});}
    catch{rows=await fixtureRows(fixture);assert(stateOwned(rows.state,fixture,true)&&transitionOwned(rows.transition,fixture)&&rows.transition.syncStatus==='READY','FIXTURE_COORDINATOR_SETUP_INCOMPLETE');}
    [current,rows]=await Promise.all([identity(fixture.uid),fixtureRows(fixture)]);
    assert(identityOwned(current,fixture)&&current.customClaims?.enabled===false&&current.customClaims?.admin===false&&current.customClaims?.securityVersion===1&&profileOwned(rows.profile,fixture)&&stateOwned(rows.state,fixture,true)&&transitionOwned(rows.transition,fixture)&&rows.transition.syncStatus==='READY','DENIED_READY_FIXTURE_REQUIRED');
    return {ready:true};
  }
  async function deleteFixtureBatch(inputs){
    assert(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=100,'SCOPED_CLEANUP_BATCH_REQUIRED');const fixtures=inputs.map(fixtureArgument);assert(new Set(fixtures.map(row=>row.uid)).size===fixtures.length,'DUPLICATE_CLEANUP_FIXTURE');
    await boundary({expiredCleanup:true});let [users,rows]=await Promise.all([identitiesFor(fixtures),fixtureBatchRows(fixtures)]);validateFixtureBatch(fixtures,users,rows);
    const pending=fixtures.filter(fixture=>{const transition=rows.securityTransitions.get(fixture.operationId);return transition&&!TERMINAL.has(transition.syncStatus);});
    if(pending.length){const sync=await coordinator();assert(typeof sync?.synchronizeUserSecurity==='function','BUILT_COORDINATOR_REQUIRED');for(const fixture of pending)await sync.synchronizeUserSecurity(fixture.operationId);rows=await fixtureBatchRows(fixtures);}
    validateFixtureBatch(fixtures,users,rows,{ready:true});const expectedStates=rows.userSecurityStates.size,expectedProfiles=rows.users.size;
    const ids=fixtures.map(row=>row.uid),operationIds=fixtures.map(row=>row.operationId);
    const pairDefinitions=fixtures.map((_,index)=>`$uid${index}:String!,$operation${index}:String!`).join(',');
    const pairs=fixtures.map((_,index)=>`{userId:{eq:$uid${index}},operationId:{eq:$operation${index}}}`).join(',');
    const pairVariables=Object.fromEntries(fixtures.flatMap((row,index)=>[[`uid${index}`,row.uid],[`operation${index}`,row.operationId]]));
    const cleanup=`mutation ReconciliationVolumeCleanup($ids:[String!]!,$operationIds:[String!]!,$marker:String!,$expectedStates:Int!,$expectedProfiles:Int!,${pairDefinitions}) @transaction {`+
      `userSecurityState_deleteMany(where:{userId:{in:$ids},operationId:{in:$operationIds},_or:[${pairs}],securityVersion:{eq:1},membershipStatus:{eq:PENDING},desiredEnabled:{eq:false},desiredAdmin:{eq:false},accessReady:{eq:false},adminReady:{eq:false},syncStatus:{eq:READY}}) @check(expr:"this == vars.expectedStates",message:"FIXTURE_CLEANUP_CONFLICT") `+
      'callableRateLimitBucket_deleteMany(where:{userId:{in:$ids}}) callableInvocation_deleteMany(where:{userId:{in:$ids}}) '+
      'user_deleteMany(where:{id:{in:$ids},createdBy:{eq:$marker},updatedBy:{eq:$marker},membershipStatus:{eq:PENDING}}) @check(expr:"this == vars.expectedProfiles",message:"FIXTURE_PROFILE_CLEANUP_CONFLICT")}';
    // Skip writes for wholly absent slots. A committed-but-lost response is
    // resolved with one exact batch read before any Auth deletion.
    if(expectedStates||expectedProfiles||rows.rates.length||rows.invocations.length){let failure;
      try{await graphql(cleanup,{ids,operationIds,marker:`rcv:${plan.runId}`,expectedStates,expectedProfiles,...pairVariables},false);}catch(error){failure=error;}
      rows=await fixtureBatchRows(fixtures);validateFixtureBatch(fixtures,users,rows,{ready:true});
      if(rows.userSecurityStates.size||rows.users.size){if(failure)throw failure;throw new ReconciliationVolumeCloudError('DATABASE_CLEANUP_NOT_VERIFIED');}
    }
    assert(rows.rates.length===0&&rows.invocations.length===0,'RATE_CLEANUP_NOT_VERIFIED');
    users=await identitiesFor(fixtures);validateFixtureBatch(fixtures,users,rows,{ready:true});
    const authIds=[...users.keys()];if(authIds.length){try{await(await admin()).auth.deleteUsers(authIds);}catch{/* Resolve partial/uncertain bulk deletion by exact read-back. */}}
    assert((await identitiesFor(fixtures)).size===0,'FIXTURE_AUTH_DELETION_INCOMPLETE');
    return {deleted:fixtures.length,auditReceiptsRetained:true};
  }
  async function logsQuery({executionId,from,to,completionOnly=false}){
    const entries=[],seen=new Set();let pageToken;
    do{const response=await request('logging.googleapis.com','/v2/entries:list',{method:'POST',body:{resourceNames:[`projects/${PROJECT}`],filter:
      `resource.type="cloud_run_revision" AND resource.labels.project_id="${PROJECT}" AND resource.labels.location="${REGION}" AND resource.labels.revision_name="${plan.baseline.deployment.revision}"${executionId?` AND labels.execution_id="${executionId}"`:''}${completionOnly?' AND jsonPayload.message="Security reconciliation completed"':''} AND timestamp>="${from}" AND timestamp<="${to}"`,orderBy:'timestamp asc',pageSize:1000,...(pageToken?{pageToken}:{})}});
      assert(Array.isArray(response.entries??[]),'PROVIDER_LOG_PAGE_INVALID');
      for(const entry of response.entries??[])assert(entry.resource?.type==='cloud_run_revision'&&entry.resource.labels?.project_id===PROJECT&&entry.resource.labels.location===REGION&&entry.resource.labels.revision_name===plan.baseline.deployment.revision&&Date.parse(entry.timestamp)>=Date.parse(from)&&Date.parse(entry.timestamp)<=Date.parse(to)&&(!executionId||entry.labels?.execution_id===executionId)&&(!completionOnly||entry.jsonPayload?.message==='Security reconciliation completed'),'PROVIDER_LOG_IDENTITY_MISMATCH');
      entries.push(...response.entries??[]);pageToken=response.nextPageToken;if(pageToken){assert(!seen.has(pageToken),'PROVIDER_LOG_PAGE_REPEATED');seen.add(pageToken);}assert(entries.length<=10000,'PROVIDER_LOG_BOUND_EXCEEDED');
    }while(pageToken);return entries;
  }
  async function measure({targetSize,measurementId,notBefore}){
    // This only verifies an already finished invocation. That invocation changes
    // lastAttemptTime, so cleanup establishes a new drain proof afterwards.
    await boundary({requireDrain:false});assert(Number.isSafeInteger(targetSize)&&targetSize>=2&&targetSize<=10000&&/^[A-Za-z0-9_-]{1,64}$/.test(measurementId??''),'MEASUREMENT_IDENTITY_INVALID');
    assert(typeof notBefore==='string'&&Number.isFinite(Date.parse(notBefore))&&Date.parse(notBefore)>=Date.parse(plan.createdAt)&&Date.parse(notBefore)<=Date.parse(clock())+1000,'ARMED_MEASUREMENT_WINDOW_REQUIRED');
    requireDrainAnchor(new Date(notBefore).toISOString());
    const receipt=evidence.measurement?await evidence.measurement({targetSize,measurementId,notBefore}):await receiptFile(`measurement-${measurementId}.json`);
    receiptIdentity(receipt,'sodc-reconciliation-volume-measurement/v1');
    assert(receipt.measurementId===measurementId&&receipt.targetSize===targetSize&&receipt.revision===plan.baseline.deployment.revision&&/^[A-Za-z0-9_-]{1,128}$/.test(receipt.executionId??'')&&typeof receipt.insertId==='string','MEASUREMENT_RECEIPT_IDENTITY_MISMATCH');
    const start=Date.parse(receipt.startedAt),end=Date.parse(receipt.completedAt);
    assert(Number.isFinite(start)&&Number.isFinite(end)&&start>=Date.parse(notBefore)&&end>=start&&end<=Date.parse(clock())+1000&&end-start<=20*60*1000,'MEASUREMENT_TIME_WINDOW_INVALID');
    const before=await observe();assert(before.baselineAuthorityPassed&&before.counts.states===targetSize&&before.fixtures.validDeniedReady===targetSize-plan.baseline.counts.states&&before.fixtures.unexpectedOwnedRows===0&&before.pendingTransitions===0,'EXACT_MEASUREMENT_ROSTER_REQUIRED');
    const entries=await logsQuery({executionId:receipt.executionId,from:receipt.startedAt,to:receipt.completedAt});
    for(const entry of entries)assert(entry.resource?.labels?.project_id===PROJECT&&entry.resource.labels.revision_name===receipt.revision&&entry.labels?.execution_id===receipt.executionId&&Date.parse(entry.timestamp)>=start&&Date.parse(entry.timestamp)<=end,'PROVIDER_LOG_IDENTITY_MISMATCH');
    const completed=entries.filter(entry=>entry.jsonPayload?.message==='Security reconciliation completed');
    const selected=entries.find(entry=>entry.insertId===receipt.insertId);assert(selected,'MEASUREMENT_PROVIDER_LOG_REQUIRED');
    let result;
    if(receipt.completed===false&&receipt.timedOut===true){
      assert(completed.length===0&&['ERROR','CRITICAL','ALERT','EMERGENCY'].includes(selected.severity)&&/timed? out|timeout|deadline exceeded/i.test(selected.jsonPayload?.message??selected.textPayload??''),'INDEPENDENT_TIMEOUT_LOG_REQUIRED');
      result={completed:false,timedOut:true,durationMs:end-start,stateAttempts:null,pendingAttempts:null,failedAttempts:null};
    }else{
      assert(receipt.completed===true&&completed.length===1&&completed[0].insertId===receipt.insertId&&!entries.some(entry=>['WARNING','ERROR','CRITICAL','ALERT','EMERGENCY'].includes(entry.severity)),'ONE_SUCCESSFUL_PROVIDER_COMPLETION_REQUIRED');
      const fields=selected.jsonPayload;assert(fields.stateAttempts===targetSize&&fields.pendingAttempts===0&&fields.failedAttempts===0&&Number.isFinite(fields.durationMs)&&fields.durationMs>=0&&fields.durationMs<=end-start+1000,'PROVIDER_SWEEP_COUNTS_INVALID');
      result={completed:true,timedOut:false,durationMs:fields.durationMs,stateAttempts:fields.stateAttempts,pendingAttempts:fields.pendingAttempts,failedAttempts:fields.failedAttempts};
    }
    const after=await observe();assert(after.baselineAuthorityPassed&&after.counts.states===targetSize&&after.fixtures.validDeniedReady===before.fixtures.validDeniedReady&&after.pendingTransitions===0,'MEASUREMENT_CHANGED_AUTHORITY');
    return {projectId:PROJECT,runId:plan.runId,measurementId,targetSize,notBefore,revision:receipt.revision,executionId:receipt.executionId,startedAt:receipt.startedAt,completedAt:receipt.completedAt,
      ...result,providerVerified:true,evidenceHash:stableHash({receipt,entries:entries.map(entry=>({insertId:entry.insertId,timestamp:entry.timestamp,severity:entry.severity,payload:entry.jsonPayload??entry.textPayload}))})};
  }
  // Provider exceptions may contain request objects, identities or credentials.
  // Only aggregate, deliberately assigned error codes cross this boundary.
  const safe=operation=>async(...args)=>{try{return await operation(...args);}catch(error){if(error instanceof ReconciliationVolumeCloudError)throw error;throw new ReconciliationVolumeCloudError('VOLUME_PROVIDER_OPERATION_FAILED');}};
  return {observe:safe(observe),pauseScheduler:safe(pauseScheduler),restoreScheduler:safe(restoreScheduler),createFixture:safe(createFixture),deleteFixtureBatch:safe(deleteFixtureBatch),measure:safe(measure),
    close:safe(async()=>{if(closed)return;closed=true;if(adminPromise)await(await adminPromise).close?.();})};
}
