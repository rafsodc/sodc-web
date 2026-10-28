import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "firebase-admin/app";
import type { DataConnect } from "firebase-admin/data-connect";
import type * as AdminSdk from "@dataconnect/admin-generated";

// Real Data Connect/PostgreSQL, without the ordinary mocked test setup or cloud credentials.
const functionsRoot = path.resolve(__dirname, "../../..");
const require = createRequire(path.join(functionsRoot, "package.json"));
let app: App, bookingApp: App, dc: DataConnect, bookingDc: DataConnect, sdk: typeof AdminSdk;
let f: { section: string; otherSection: string; event: string; otherEvent: string; ticket: string; group: string; unrelatedGroup: string; modGroup: string; actor: string; booker: string };
let fresh = false;
const stamp = "2030-01-01T12:00:00Z";
async function raw(source: string, variables: Record<string, unknown> = {}) { return dc.executeGraphql(source, { variables }); }
async function snapshot() { return (await raw("query Snapshot {events(orderBy:{id:ASC}) {id title sectionId} ticketTypes(orderBy:{id:ASC}) {id title eventId userGroupId} bookings(orderBy:{id:ASC}) {id approvalStatus approvalReviewedById supersededAt} bookingPaymentAdjustments {id}} ")).data; }
async function actor(kind: string) {
  const uid = `permissions-${randomUUID()}`;
  const admin = kind === "admin" || kind === "admin-without-claim";
  const status = kind === "status-moderator" ? "INDUSTRY" : kind === "restricted" ? "LOST" : "REGULAR";
  await raw(`mutation Actor($id:String!,$admin:Boolean!,$status:MembershipStatus!) @transaction {
    user_insert(data:{id:$id,firstName:"Local",lastName:"Permission fixture",email:"fixture@example.invalid",serviceNumber:$id,membershipStatus:$status,createdBy:"local-fixture",updatedBy:"local-fixture"})
    userSecurityState_insert(data:{userId:$id,securityVersion:1,membershipStatus:$status,desiredEnabled:true,desiredAdmin:$admin,accessReady:true,adminReady:$admin,syncStatus:READY,operationId:$id})
  }`, { id: uid, admin, status });
  if (!["admin", "admin-without-claim", "status-moderator", "member", "anonymous", "forged-admin", "revoked-admin"].includes(kind)) {
    await raw("mutation Join($user:String!,$group:UUID!){userUserGroup_insert(data:{userId:$user,userGroupId:$group,createdBy:\"local-fixture\",updatedBy:\"local-fixture\"})}", { user: uid, group: kind === "cross-section" ? f.unrelatedGroup : f.modGroup });
  }
  const change = kind === "stale" ? "securityVersion:2" : kind === "disabled" ? "accessReady:false,desiredEnabled:false" : kind === "pending" ? "syncStatus:PENDING" : kind === "mismatch" ? "membershipStatus:RETIRED" : kind === "revoked-admin" ? "adminReady:false" : "";
  if (change) await raw(`mutation Change($id:String!){userSecurityState_update(key:{userId:$id},data:{${change}})}`, { id: uid });
  if (kind === "missing-state") await raw("mutation RemoveState($id:String!){userSecurityState_delete(key:{userId:$id})}", { id: uid });
  return { uid, admin: admin && kind !== "admin-without-claim", options: { impersonate: { authClaims: kind === "anonymous" ? {} : { sub: uid, enabled: kind !== "disabled-claim", admin: admin && kind !== "admin-without-claim" || kind === "forged-admin" || kind === "revoked-admin", securityVersion: 1 } } } };
}
beforeAll(async () => {
  const { assertSectionPermissionsFixture } = await import(pathToFileURL(path.join(functionsRoot, "scripts/run-section-permissions-integration.mjs")).href);
  const c = await assertSectionPermissionsFixture();
  const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  const { getDataConnect } = require("firebase-admin/data-connect") as typeof import("firebase-admin/data-connect");
  sdk = require("@dataconnect/admin-generated"); app = initializeApp({ projectId: c.projectId }, "section-permissions-local");
  dc = getDataConnect(sdk.connectorConfig, app); bookingApp = initializeApp({projectId:c.projectId}, "section-permissions-booking"); bookingDc = getDataConnect({ ...sdk.connectorConfig, connector: "booking-service" }, bookingApp);
  expect((await raw("query Fresh {users(limit:1){id} sections(limit:1){id}}")).data).toEqual({users:[],sections:[]}); fresh = true;
});
beforeEach(async () => {
  if (!fresh) throw new Error("Disposable database was not verified");
  await raw("mutation Clear @transaction {bookingPaymentAdjustment_deleteMany(all:true) booking_deleteMany(all:true) ticketType_deleteMany(all:true) event_deleteMany(all:true) sectionUserGroupPurposeLink_deleteMany(all:true) userUserGroup_deleteMany(all:true) userGroup_deleteMany(all:true) section_deleteMany(all:true) userSecurityState_deleteMany(all:true) user_deleteMany(all:true)}");
  f = { section: randomUUID(), otherSection: randomUUID(), event: randomUUID(), otherEvent: randomUUID(), ticket: randomUUID(), group: randomUUID(), unrelatedGroup: randomUUID(), modGroup: randomUUID(), actor:"", booker:"" };
  await raw(`mutation Base($a:UUID!,$b:UUID!,$group:UUID!,$other:UUID!,$mod:UUID!) @transaction {
    a:section_insert(data:{id:$a,name:"Local section A",type:EVENTS,createdBy:"local-fixture",updatedBy:"local-fixture"}) b:section_insert(data:{id:$b,name:"Local section B",type:EVENTS,createdBy:"local-fixture",updatedBy:"local-fixture"})
    g:userGroup_insert(data:{id:$group,name:"Section member catalogue",membershipStatuses:[REGULAR],createdBy:"local-fixture",updatedBy:"local-fixture"})
    m:userGroup_insert(data:{id:$mod,name:"Explicit and status moderators",membershipStatuses:[INDUSTRY],createdBy:"local-fixture",updatedBy:"local-fixture"})
    o:userGroup_insert(data:{id:$other,name:"Other section only",createdBy:"local-fixture",updatedBy:"local-fixture"})
    ga:sectionUserGroupPurposeLink_insert(data:{sectionId:$a,userGroupId:$group,purposes:[ACCESS,BOOKER],createdBy:"local-fixture",updatedBy:"local-fixture"})
    ma:sectionUserGroupPurposeLink_insert(data:{sectionId:$a,userGroupId:$mod,purposes:[MODERATOR],createdBy:"local-fixture",updatedBy:"local-fixture"})
    ob:sectionUserGroupPurposeLink_insert(data:{sectionId:$b,userGroupId:$other,purposes:[MODERATOR],createdBy:"local-fixture",updatedBy:"local-fixture"})
  }`, { a:f.section,b:f.otherSection,group:f.group,other:f.unrelatedGroup,mod:f.modGroup });
  const event = "event_insert(data:{id:$id,sectionId:$section,title:\"Local event\",startDateTime:$time,endDateTime:$time,bookingStartDateTime:$time,bookingEndDateTime:$time,maxGuestsWithoutModeratorApproval:0,createdBy:\"local-fixture\",updatedBy:\"local-fixture\"})";
  for (const [id,section] of [[f.event,f.section],[f.otherEvent,f.otherSection]]) await raw(`mutation Event($id:UUID!,$section:UUID!,$time:Timestamp!){${event}}`,{id,section,time:stamp});
  await raw("mutation Ticket($id:UUID!,$event:UUID!,$group:UUID!){ticketType_insert(data:{id:$id,eventId:$event,userGroupId:$group,audience:MEMBER,title:\"Local ticket\",price:0,includesDinner:false,includesSymposium:true,createdBy:\"local-fixture\",updatedBy:\"local-fixture\"})}", {id:f.ticket,event:f.event,group:f.group});
});
afterAll(async () => { if (app) await (require("firebase-admin/app") as typeof import("firebase-admin/app")).deleteApp(app); if (bookingApp) await (require("firebase-admin/app") as typeof import("firebase-admin/app")).deleteApp(bookingApp); });
const mutationNames = ["CreateEvent", "UpdateEvent", "DeleteEvent", "CreateTicketType", "UpdateTicketType", "DeleteTicketType"] as const;
const queryNames = ["GetEventsForSection", "GetEventById", "ListEventBookingsForAdmin", "ListTicketOrdersForAdmin", "ListBookingPaymentAdjustmentsForAdmin", "ListSectionTicketAccessGroups"] as const;
function variables(operation: string): Record<string, unknown> {
  if (["GetEventsForSection","ListSectionTicketAccessGroups"].includes(operation)) return {sectionId:f.section};
  if (["ListEventBookingsForAdmin","ListTicketOrdersForAdmin","ListBookingPaymentAdjustmentsForAdmin"].includes(operation)) return {eventId:f.event};
  if (["GetEventById","DeleteEvent"].includes(operation)) return {id:f.event};
  if (operation === "DeleteTicketType") return {id:f.ticket};
  if (operation.includes("TicketType")) return {...(operation === "CreateTicketType" ? {eventId:f.event} : {id:f.ticket}),userGroupId:f.group,audience:"MEMBER",title:"Changed ticket",price:0,includesDinner:false,includesSymposium:true,sortOrder:0};
  return {...(operation === "CreateEvent" ? {sectionId:f.section} : {id:f.event}),title:"Changed event",startDateTime:stamp,endDateTime:stamp,bookingStartDateTime:stamp,bookingEndDateTime:stamp,maxGuestsWithoutModeratorApproval:0};
}
for (const kind of ["admin", "explicit-moderator", "status-moderator"]) describe(kind + " actual allowed section operations", () => {
  for (const name of [...queryNames,...mutationNames]) it(name, async () => {
    const a = await actor(kind);
    const result = mutationNames.includes(name as never) ? await dc.executeMutation(name,variables(name),a.options) : await dc.executeQuery(name,variables(name),a.options);
    expect(result.data).toBeDefined();
    expect(result.data).not.toHaveProperty("currentAuthorization"); expect(result.data).not.toHaveProperty("managementScope");
  });
});
for (const kind of ["member", "cross-section", "stale", "disabled", "disabled-claim", "pending", "mismatch", "restricted", "missing-state", "forged-admin", "admin-without-claim", "revoked-admin", "anonymous"]) describe(kind + " actual denied section boundary", () => {
  for (const name of [...queryNames,...mutationNames]) it(name + " refuses without writes", async () => {
    const a = await actor(kind), before = await snapshot();
    const operation = mutationNames.includes(name as never) ? dc.executeMutation(name,variables(name),a.options) : dc.executeQuery(name,variables(name),a.options);
    await expect(operation).rejects.toThrow(/auth|permission|ACCESS_REVOKED|SESSION_VERSION_STALE|SECTION_MODERATOR_REQUIRED/i); expect(await snapshot()).toEqual(before);
  });
});
it("rejects cross-section resource IDs even after a successful own-section read", async () => {
  const a=await actor("explicit-moderator"); await dc.executeQuery("GetEventById",{id:f.event},a.options);
  const before=await snapshot(); await expect(dc.executeMutation("UpdateEvent",{...variables("UpdateEvent"),id:f.otherEvent},a.options)).rejects.toThrow(/SECTION_MODERATOR_REQUIRED/); expect(await snapshot()).toEqual(before);
});
it("rechecks moderator membership after an earlier successful read", async () => {
  const a=await actor("explicit-moderator"); await dc.executeQuery("GetEventById",{id:f.event},a.options);
  await raw("mutation Revoke($user:String!,$group:UUID!){userUserGroup_delete(key:{userId:$user,userGroupId:$group})}",{user:a.uid,group:f.modGroup});
  const before=await snapshot(); await expect(dc.executeMutation("DeleteEvent",{id:f.event},a.options)).rejects.toThrow(/SECTION_MODERATOR_REQUIRED/); expect(await snapshot()).toEqual(before);
});
for (const kind of ["admin", "explicit-moderator"]) it(kind+" cannot select another section's ticket group",async()=>{
  const a=await actor(kind),before=await snapshot();
  for(const name of ["CreateTicketType","UpdateTicketType"]) await expect(dc.executeMutation(name,{...variables(name),userGroupId:f.unrelatedGroup},a.options)).rejects.toThrow(/SECTION_TICKET_GROUP_REQUIRED/);
  expect(await snapshot()).toEqual(before);
  const catalogue=await dc.executeQuery<{userGroups:{id:string;name:string}[]}>("ListSectionTicketAccessGroups",{sectionId:f.section},a.options);
  expect(catalogue.data.userGroups.map(g=>g.name).sort()).toEqual(["Explicit and status moderators","Section member catalogue"]);
});
it("cannot move event or ticket ownership using extra update variables",async()=>{
 const a=await actor("explicit-moderator");await expect(dc.executeMutation("UpdateEvent",{...variables("UpdateEvent"),sectionId:f.otherSection},a.options)).rejects.toThrow(/not expected/);
 await expect(dc.executeMutation("UpdateTicketType",{...variables("UpdateTicketType"),eventId:f.otherEvent},a.options)).rejects.toThrow(/not expected/);
 const data=await snapshot() as {events:{id:string;sectionId:string}[];ticketTypes:{id:string;eventId:string}[]};
 const key=(id:string)=>id.replace(/-/g, "").toLowerCase();
 expect(key(data.events.find(e=>key(e.id)===key(f.event))!.sectionId)).toBe(key(f.section));expect(key(data.ticketTypes.find(t=>key(t.id)===key(f.ticket))!.eventId)).toBe(key(f.event));
});
for(const name of ["CreateSection","UpdateSection","DeleteSection","CreateUserGroup","GrantUserGroupToSectionForPurpose","ListUsers","ListUserGroups","ListOpenPaymentReconciliationExceptions"]) it(name+" remains globally administrator-only",async()=>{
 const a=await actor("explicit-moderator");
 const args:Record<string,unknown> = name === "CreateSection" ? {name:"forbidden",type:"EVENTS"} : name === "UpdateSection" ? {id:f.section,name:"forbidden"} : name === "DeleteSection" ? {id:f.section} : name === "CreateUserGroup" ? {name:"forbidden"} : name === "GrantUserGroupToSectionForPurpose" ? {sectionId:f.section,userGroupId:f.group,purposes:["MODERATOR"]} : {};
 await expect(name.startsWith("List")?dc.executeQuery(name,args,a.options):dc.executeMutation(name,args,a.options)).rejects.toThrow(/auth|permission/i);
});
async function pendingBooking(revision=1,group=randomUUID()){
 const id=randomUUID(); const booker=await actor("member");
 await raw("mutation Pending($id:UUID!,$event:UUID!,$booker:String!,$group:UUID!,$revision:Int!,$key:String!){booking_insert(data:{id:$id,eventId:$event,bookerId:$booker,revisionGroupId:$group,revisionNumber:$revision,clientSubmissionKey:$key,status:SUBMITTED,approvalStatus:PENDING,createdBy:\"local-fixture\",updatedBy:\"local-fixture\"})}",{id,event:f.event,booker:booker.uid,group,revision,key:randomUUID()}); return {id,group};
}
for(const kind of ["admin","explicit-moderator","status-moderator","member","cross-section","stale","disabled","pending","mismatch","restricted","missing-state"]) it("approval transaction rechecks "+kind,async()=>{
 const a=await actor(kind), booking=await pendingBooking(),before=await snapshot();
 const call=sdk.updateBookingApprovalFromCallable(dc,{id:booking.id,expectedRevisionNumber:1,status:"APPROVED",reviewedById:a.uid,actorSecurityVersion:1,actorIsAdmin:a.admin});
 if(["admin","explicit-moderator","status-moderator"].includes(kind)) await expect(call).resolves.toBeDefined(); else {await expect(call).rejects.toThrow();expect(await snapshot()).toEqual(before);}
});
for(const kind of ["admin","explicit-moderator","status-moderator","member","cross-section","stale","disabled","pending"]) it("amended activation transaction rechecks "+kind,async()=>{
 const a=await actor(kind), old=await pendingBooking(),next=await pendingBooking(2,old.group);
 await raw("mutation Previous($id:UUID!){booking_update(id:$id,data:{approvalStatus:APPROVED})}",{id:old.id}); const before=await snapshot();
 const call=bookingDc.executeMutation("ActivateApprovedBookingRevisionFromCallable",{bookingId:next.id,revisionGroupId:old.group,activeBookingId:old.id,reviewedById:a.uid,actorSecurityVersion:1,actorIsAdmin:a.admin,deltaAmountMinor:0,adjustmentStatus:"NOT_REQUIRED",orchestrationKey:randomUUID()});
 if(["admin","explicit-moderator","status-moderator"].includes(kind)) await expect(call).resolves.toBeDefined();else {await expect(call).rejects.toThrow();expect(await snapshot()).toEqual(before);}
});

it("rolls back approval activation if the later active-revision guard fails",async()=>{
 const a=await actor("explicit-moderator"),old=await pendingBooking(),next=await pendingBooking(2,old.group),before=await snapshot();
 await expect(bookingDc.executeMutation("ActivateApprovedBookingRevisionFromCallable",{bookingId:next.id,revisionGroupId:old.group,activeBookingId:old.id,reviewedById:a.uid,actorSecurityVersion:1,actorIsAdmin:false,deltaAmountMinor:0,adjustmentStatus:"NOT_REQUIRED",orchestrationKey:randomUUID()})).rejects.toThrow(/BOOKING_APPROVAL_CONFLICT/);
 expect(await snapshot()).toEqual(before);
});
it("rechecks status-derived moderation after the group status catalogue changes",async()=>{
 const a=await actor("status-moderator");await dc.executeQuery("GetEventById",{id:f.event},a.options);
 await raw("mutation RevokeStatus($group:UUID!){userGroup_update(id:$group,data:{membershipStatuses:[]})}",{group:f.modGroup});const before=await snapshot();
 await expect(dc.executeMutation("UpdateTicketType",variables("UpdateTicketType"),a.options)).rejects.toThrow(/SECTION_MODERATOR_REQUIRED/);expect(await snapshot()).toEqual(before);
});

it("retains a legacy ticket group's safe id/name option without exposing its membership",async()=>{
 const legacy=randomUUID(),a=await actor("explicit-moderator");
 await raw("mutation LegacyGroup($id:UUID!,$ticket:UUID!){userGroup_insert(data:{id:$id,name:\"Legacy ticket group\",createdBy:\"local-fixture\",updatedBy:\"local-fixture\"}) ticketType_update(id:$ticket,data:{userGroupId:$id})}",{id:legacy,ticket:f.ticket});
 const catalogue=await dc.executeQuery<{userGroups:{id:string;name:string}[]}>("ListSectionTicketAccessGroups",{sectionId:f.section},a.options);
 expect(catalogue.data.userGroups.find(g=>g.name==="Legacy ticket group")).toBeDefined();
 expect(catalogue.data.userGroups.every(g=>Object.keys(g).sort().join(",")==="id,name")).toBe(true);
 await expect(dc.executeMutation("UpdateTicketType",{...variables("UpdateTicketType"),userGroupId:legacy},a.options)).resolves.toBeDefined();
});
it("keeps both service-only booking decisions inaccessible even to forged client actor variables",async()=>{
 const a=await actor("explicit-moderator"),admin=await actor("admin"),old=await pendingBooking(),next=await pendingBooking(2,old.group),before=await snapshot();
 await expect(sdk.updateBookingApprovalFromCallable(dc,{id:old.id,expectedRevisionNumber:1,status:"APPROVED",reviewedById:admin.uid,actorSecurityVersion:1,actorIsAdmin:true},a.options)).rejects.toThrow(/auth|permission/i);
 await expect(bookingDc.executeMutation("ActivateApprovedBookingRevisionFromCallable",{bookingId:next.id,revisionGroupId:old.group,activeBookingId:old.id,reviewedById:admin.uid,actorSecurityVersion:1,actorIsAdmin:true,deltaAmountMinor:0,adjustmentStatus:"NOT_REQUIRED",orchestrationKey:randomUUID()},a.options)).rejects.toThrow(/auth|permission/i);
 expect(await snapshot()).toEqual(before);
});
