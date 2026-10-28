import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as db from "@dataconnect/admin-generated";
import { reviewBookingRevision } from "../../bookingApprovals";
import { requireSectionModerator } from "../../sectionAccess";
import { notifyBookingApprovedEmail } from "../../bookingEmailDispatcher";

vi.mock("../../sectionAccess", () => ({ requireSectionModerator: vi.fn() }));
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("../../bookingEmailDispatcher", () => ({
  notifyBookingApprovedEmail: vi.fn(), notifyBookingChangesRequestedEmail: vi.fn(), notifyBookingRevisionEmail: vi.fn(),
}));
const bookingId = "10000000-0000-4000-8000-000000000001";
const sectionId = "20000000-0000-4000-8000-000000000001";
const eventId = "30000000-0000-4000-8000-000000000001";
const targetQuery = vi.spyOn(db, "getBookingRevisionForApprovalFromCallable");
const revisionsQuery = vi.spyOn(db, "getBookingsForBookerAndEvent");
const write = vi.spyOn(db, "updateBookingApprovalFromCallable");
function request(admin = false) {
  return { auth: { uid: "reviewer", token: { enabled: true, admin, securityVersion: 1 } },
    data: { bookingId, expectedRevisionNumber: 1, decision: "APPROVED" } };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSectionModerator).mockResolvedValue({ canModerate: true } as never);
  targetQuery.mockResolvedValue({data:{booking:{id:bookingId,status:"SUBMITTED",approvalStatus:"PENDING",revisionNumber:1,
    revisionGroupId:bookingId,supersededAt:null,supersedesBooking:null,booker:{id:"booker"},event:{id:eventId,section:{id:sectionId}},lines:[]}}} as never);
  revisionsQuery.mockResolvedValue({data:{user:{bookings:[],ticketOrders:[]}}} as never);
  write.mockResolvedValue({data:{changed:1}} as never);
});
describe("booking approval callable authorization", () => {
  it.each([false,true])("uses verified scoped moderation and forwards authority to the transaction (admin=%s)",async(admin)=>{
    await expect(reviewBookingRevision.run(request(admin) as never)).resolves.toMatchObject({success:true});
    expect(requireSectionModerator).toHaveBeenCalledWith(sectionId,"reviewer",admin);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({reviewedById:"reviewer",actorSecurityVersion:1,actorIsAdmin:admin}));
    expect(notifyBookingApprovedEmail).toHaveBeenCalledOnce();
  });
  it("denies the wrong section before reading another member's revisions or writing",async()=>{
    vi.mocked(requireSectionModerator).mockRejectedValueOnce(new HttpsError("not-found","Resource not found"));
    await expect(reviewBookingRevision.run(request() as never)).rejects.toMatchObject({code:"not-found"});
    expect(revisionsQuery).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(notifyBookingApprovedEmail).not.toHaveBeenCalled();
  });
  it.each(["anonymous","disabled","stale"])("rejects %s before fetching the target",async(kind)=>{
    const req=request();if(kind==="anonymous") delete (req as {auth?:unknown}).auth;
    if(kind==="disabled") req.auth.token.enabled=false;if(kind==="stale") req.auth.token.securityVersion=0;
    await expect(reviewBookingRevision.run(req as never)).rejects.toThrow();expect(targetQuery).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();
  });
  it("emits no notification when transactional authorization changes after the preflight guard",async()=>{
    write.mockRejectedValueOnce(new Error("ACCESS_REVOKED"));
    await expect(reviewBookingRevision.run(request() as never)).rejects.toMatchObject({code:"permission-denied",details:{code:"ACCESS_REVOKED"}});
    expect(notifyBookingApprovedEmail).not.toHaveBeenCalled();
  });
  it("returns an actionable session error when the write observes a newer security version",async()=>{
    write.mockRejectedValueOnce(new Error("SESSION_VERSION_STALE"));
    await expect(reviewBookingRevision.run(request() as never)).rejects.toMatchObject({code:"unauthenticated",details:{code:"SESSION_VERSION_STALE"}});
    expect(notifyBookingApprovedEmail).not.toHaveBeenCalled();
  });
});
