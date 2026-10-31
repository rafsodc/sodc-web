import { act, cleanup, fireEvent, render, screen, waitFor } from '../../../../test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import SectionDetail from '../SectionDetail';
import {
  createSessionLifecycle,
  installSessionRuntime,
  type SessionLifecycle,
} from '../../../../shared/appShell/sessionLifecycle';
import type { SectionForUserResponse, SectionEventsForUserResponse, EventForUserResponse } from '../../../../shared/utils/firebaseFunctions/sectionAccess';
import type { SectionMember } from '../../utils/sectionHelpers';
import { SectionType, SectionUserGroupPurpose } from '@dataconnect/generated';
import * as generated from '@dataconnect/generated';
import { executeMutation } from 'firebase/data-connect';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { captureSectionEventSummaryRead, getFreshSectionEventSummaries, rememberSectionEventSummaries, removeSectionEventSummaries } from '../../../../shared/query/sectionEventSummaryCache';

const transport = vi.hoisted(() => ({
  getSectionForUser: vi.fn(),
  getSectionMembersMerged: vi.fn(),
  getSectionEventsForUser: vi.fn(),
  getEventForUser: vi.fn(),
  subscribeToUserGroup: vi.fn(),
}));
const invalidation = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => ({ userGroups: [] as { userGroup: { id: string } }[] }));
const viewRenders = vi.hoisted(() => ({ members: vi.fn(), events: vi.fn(), detail: vi.fn() }));
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_functions: unknown, name: keyof typeof transport) => {
    if (!transport[name]) throw new Error(`Unexpected callable ${name}`);
    return transport[name];
  }),
}));
vi.mock('../../../../config/firebase', () => ({
  dataConnect: {}, functions: {}, auth: { currentUser: { uid: 'read-user' } },
}));
vi.mock('../../../../shared/query/invalidation', () => ({ invalidateUserSectionAccess: invalidation }));
vi.mock('../../../../shared/query/authoritativeHooks', () => ({
  useGetUserAccessGroups: () => ({ data: { user: { userGroups: access.userGroups } }, isLoading: false }),
  useGetSectionsForUser: () => ({ data: { user: { membershipStatus: 'REGULAR', userGroups: [] }, allUserGroups: [] }, isLoading: false }),
}));
vi.mock('../AnnouncementOptOutToggle', () => ({ default: () => null }));
// Presentation is isolated; the real SectionDetail, request guard, callable client,
// sessionCallable/runSessionRead and SessionLifecycle remain in the execution path.
vi.mock('../SectionDetailViews', () => ({
  SectionDescriptionHeader: ({ isMembers, canSubscribe, userIsMember, subscribing, subscriptionRefreshFailed, onSubscribe, onUnsubscribe }: {
    isMembers: boolean; canSubscribe: boolean; userIsMember: boolean; subscribing: boolean; subscriptionRefreshFailed: boolean;
    onSubscribe: () => void; onUnsubscribe: () => void;
  }) => <div>{isMembers && canSubscribe && <button disabled={subscribing || subscriptionRefreshFailed} onClick={onSubscribe}>Subscribe</button>}{isMembers && userIsMember && <button onClick={onUnsubscribe}>Unsubscribe</button>}</div>,
  SectionMembersView: ({ paginatedMembers, loading, isError, onRefresh }: {
    paginatedMembers: SectionMember[]; loading: boolean; isError: boolean; onRefresh: () => void;
  }) => {
    viewRenders.members({ loading, isError });
    return <section aria-label="Member directory"><p>{loading ? 'Directory loading' : 'Directory ready'}</p>{isError && <p>Directory read failed</p>}{paginatedMembers.map(member => <p key={member.userId}>{member.firstName} {member.lastName}</p>)}<button onClick={onRefresh} disabled={loading}>Retry directory read</button></section>;
  },
  SectionEventsListView: ({ events, loading, isError, onRetry }: {
    events: SectionEventsForUserResponse['events']; loading: boolean; isError: boolean; onRetry: () => void;
  }) => {
    viewRenders.events({ loading, isError, titles: events.map(event => event.title) });
    return <section aria-label="Events list"><p>{loading ? 'Events loading' : 'Events ready'}</p>{isError && <p>Events read failed</p>}{events.map(event => <p key={event.id}>{event.title}</p>)}<button onClick={onRetry} disabled={loading}>Retry events read</button></section>;
  },
  SectionEventDetailView: ({ event, loading, isError, onRetry, onBookingComplete }: {
    event: EventForUserResponse['event']; loading: boolean; isError: boolean; onRetry: () => void; onBookingComplete: () => void;
  }) => {
    viewRenders.detail({ loading, isError, eventId: event?.id });
    return <section aria-label="Event detail"><p>{loading ? 'Event detail loading' : 'Event detail ready'}</p>{isError && <p>Event read failed</p>}{event && <p>{event.title}</p>}<button onClick={onRetry} disabled={loading}>Retry event read</button><button onClick={onBookingComplete} disabled={loading || !event}>Booking completed</button></section>;
  },
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const EVENT_1 = '33333333-3333-4333-8333-333333333333';
const EVENT_2 = '44444444-4444-4444-8444-444444444444';
const VIEW_GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const MEMBER_GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
function lookup(id = A, type: string | null = 'MEMBERS', subscribable = false): SectionForUserResponse {
  return { section: { id, name: `Section ${id === A ? 'A' : 'B'}`, type: type as SectionType, description: '', purposeLinks: subscribable ? [
    { purposes: [SectionUserGroupPurpose.ACCESS], userGroup: { id: VIEW_GROUP, name: 'View', subscribable: false } },
    { purposes: [SectionUserGroupPurpose.MEMBER], userGroup: { id: MEMBER_GROUP, name: 'Members', subscribable: true } },
  ] : [] }, hasAccess: true, canModerate: false };
}
function eventResult(id = EVENT_1, sectionId = A, title = 'Selected event'): EventForUserResponse {
  return { event: { id, title, section: { id: sectionId }, ticketTypes: [], startDateTime: '2030-03-01T18:00:00Z', endDateTime: '2030-03-01T22:00:00Z', bookingStartDateTime: '2030-02-01T00:00:00Z', bookingEndDateTime: '2030-02-28T23:59:59Z', maxGuestsWithoutModeratorApproval: 3 } };
}
function summaries(title: string): SectionEventsForUserResponse['events'] {
  return [{ ...eventResult().event!, title }];
}
const directory = (name: string) => ({ members: [{ id: name, firstName: name, lastName: 'Member', email: null, mobileNumber: null, rank: null, membershipStatus: 'REGULAR', sharesContactInfo: false }] });
const sdk = <T,>(data: T) => ({ data });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function mount(sectionId = A, eventId?: string) {
  let queryClient: QueryClient;
  function ObserveQueryClient() {
    const currentClient = useQueryClient();
    useEffect(() => { queryClient = currentClient; }, [currentClient]);
    return null;
  }
  const component = (nextSectionId: string, nextEventId?: string) => <MemoryRouter><ObserveQueryClient /><SectionDetail sectionId={nextSectionId} eventId={nextEventId} onBack={() => {}} /></MemoryRouter>;
  const result = render(component(sectionId, eventId));
  return { ...result, get queryClient() { return queryClient; }, change(nextSectionId: string, nextEventId?: string) { result.rerender(component(nextSectionId, nextEventId)); } };
}
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
function expectNoContentRequests() {
  expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
  expect(transport.getEventForUser).not.toHaveBeenCalled();
}
let lifecycle: SessionLifecycle;
let uninstall: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  lifecycle = createSessionLifecycle();
  lifecycle.observe('read-user');
  uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  access.userGroups = [{ userGroup: { id: VIEW_GROUP } }];
  transport.getSectionForUser.mockReset().mockImplementation(async ({ sectionId }: { sectionId: string }) => sdk(lookup(sectionId)));
  transport.getSectionMembersMerged.mockReset().mockResolvedValue(sdk(directory('Current')));
  transport.getSectionEventsForUser.mockReset().mockResolvedValue(sdk({ events: [] }));
  transport.getEventForUser.mockReset().mockImplementation(async ({ eventId }: { eventId: string }) => sdk(eventResult(eventId)));
  transport.subscribeToUserGroup.mockReset().mockResolvedValue(sdk({ success: true }));
  invalidation.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); lifecycle.retire(); uninstall(); vi.restoreAllMocks(); });

describe('SectionDetail authoritative read selection', () => {
  it.each(['MEMBERS', 'EVENTS', 'DETAIL'] as const)('renders %s as loading on every frame while the newly eligible content read is pending', async surface => {
    const result = surface === 'MEMBERS' ? directory('Loaded') : surface === 'EVENTS' ? { events: [] } : eventResult();
    const pending = deferred<ReturnType<typeof sdk<typeof result>>>();
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, surface === 'MEMBERS' ? 'MEMBERS' : 'EVENTS')));
    const callable = surface === 'MEMBERS' ? transport.getSectionMembersMerged : surface === 'EVENTS' ? transport.getSectionEventsForUser : transport.getEventForUser;
    const view = surface === 'MEMBERS' ? viewRenders.members : surface === 'EVENTS' ? viewRenders.events : viewRenders.detail;
    callable.mockReturnValueOnce(pending.promise);
    mount(A, surface === 'DETAIL' ? EVENT_1 : undefined);
    await waitFor(() => expect(callable).toHaveBeenCalledOnce());
    expect(view).toHaveBeenCalled();
    // Record render props, so an empty/not-found frame before the loading effect
    // runs cannot be hidden by React Testing Library flushing that effect.
    for (const [props] of view.mock.calls) expect(props).toMatchObject({ loading: true, isError: false });
    expect(screen.getByRole('button', { name: surface === 'MEMBERS' ? 'Retry directory read' : surface === 'EVENTS' ? 'Retry events read' : 'Retry event read' })).toBeDisabled();
    await act(async () => pending.resolve(sdk(result)));
    await screen.findByText(surface === 'MEMBERS' ? 'Directory ready' : surface === 'EVENTS' ? 'Events ready' : 'Event detail ready');
    expect(view.mock.lastCall?.[0]).toMatchObject({ loading: false, isError: false });
  });

  it.each([undefined, EVENT_1])('waits for matching metadata before any content request (event=%s)', async eventId => {
    const pending = deferred<ReturnType<typeof sdk<SectionForUserResponse>>>();
    transport.getSectionForUser.mockReturnValueOnce(pending.promise);
    mount(A, eventId);
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    expectNoContentRequests();
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expectNoContentRequests();
    await act(async () => pending.resolve(sdk(lookup(A, 'EVENTS'))));
    await waitFor(() => expect(eventId ? transport.getEventForUser : transport.getSectionEventsForUser).toHaveBeenCalledOnce());
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    expect(eventId ? transport.getSectionEventsForUser : transport.getEventForUser).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'missing', 'wrong-id', 'unknown-type'] as const)('does not launch downstream reads for %s metadata', async outcome => {
    if (outcome === 'rejected') transport.getSectionForUser.mockRejectedValueOnce(new Error('Metadata unavailable'));
    else transport.getSectionForUser.mockResolvedValueOnce(sdk(outcome === 'missing' ? { ...lookup(), section: null } : lookup(outcome === 'wrong-id' ? B : A, outcome === 'unknown-type' ? null : 'EVENTS')));
    mount(A, EVENT_1);
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    await settle();
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expectNoContentRequests();
    expect(screen.queryByText('Section B')).not.toBeInTheDocument();
  });

  it('EVENTS list and profile-review events never load the directory or a selected event', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    mount();
    await screen.findByText('Events ready');
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A });
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('direct event and booking completion refresh only that event, without the full event list or directory', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    mount(A, EVENT_1);
    await screen.findByRole('heading', { name: 'Selected event', level: 4 });
    fireEvent(window, new Event('member-profile-reviewed'));
    await userEvent.click(screen.getByRole('button', { name: 'Booking completed' }));
    await waitFor(() => expect(transport.getEventForUser).toHaveBeenCalledTimes(2));
    expect(transport.getEventForUser.mock.calls.map(call => call[0])).toEqual([{ eventId: EVENT_1 }, { eventId: EVENT_1 }]);
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
  });

  it('MEMBERS reads and profile-review refreshes only its directory', async () => {
    mount();
    await screen.findByText('Current Member');
    fireEvent(window, new Event('member-profile-reviewed'));
    await waitFor(() => expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(2));
    expect(transport.getSectionMembersMerged.mock.calls.map(call => call[0])).toEqual([{ sectionId: A }, { sectionId: A }]);
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('a MEMBERS event URL does not fetch a directory or any event content', async () => {
    mount(A, EVENT_1);
    await screen.findByText('Event unavailable in this section.');
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expectNoContentRequests();
  });

  it('section retry revalidates metadata first and starts one newly eligible content request', async () => {
    transport.getSectionForUser.mockRejectedValueOnce(new Error('No metadata')).mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    mount();
    await screen.findByRole('heading', { name: 'Section unavailable' });
    expectNoContentRequests();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Events ready');
    expect(transport.getSectionForUser).toHaveBeenCalledTimes(2);
    expect(transport.getSectionEventsForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  });

  it.each(['MEMBERS', 'EVENTS', 'DETAIL'] as const)('targeted %s failure retry does not refetch metadata or irrelevant content', async surface => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, surface === 'MEMBERS' ? 'MEMBERS' : 'EVENTS')));
    const callable = surface === 'MEMBERS' ? transport.getSectionMembersMerged : surface === 'EVENTS' ? transport.getSectionEventsForUser : transport.getEventForUser;
    callable.mockRejectedValueOnce(new Error('Read unavailable'));
    mount(A, surface === 'DETAIL' ? EVENT_1 : undefined);
    const failure = surface === 'MEMBERS' ? 'Directory read failed' : surface === 'EVENTS' ? 'Events read failed' : 'Event read failed';
    const retry = surface === 'MEMBERS' ? 'Retry directory read' : surface === 'EVENTS' ? 'Retry events read' : 'Retry event read';
    await screen.findByText(failure);
    await userEvent.click(screen.getByRole('button', { name: retry }));
    await waitFor(() => expect(callable).toHaveBeenCalledTimes(2));
    await settle();
    expect(screen.queryByText(failure)).not.toBeInTheDocument();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    for (const other of [transport.getSectionMembersMerged, transport.getSectionEventsForUser, transport.getEventForUser]) if (other !== callable) expect(other).not.toHaveBeenCalled();
  });

  it('subscription saves once and read-only recovery refreshes only the MEMBERS scope', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'MEMBERS', true)));
    invalidation.mockRejectedValueOnce(new Error('Access refresh unavailable')).mockResolvedValue(undefined);
    mount();
    await screen.findByText('Current Member');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText(/Your subscription change was saved/);
    expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce();
    expect(transport.subscribeToUserGroup).toHaveBeenCalledExactlyOnceWith({ userGroupId: MEMBER_GROUP });
    await userEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    await screen.findByText('Successfully subscribed to this section.');
    expect(transport.getSectionForUser).toHaveBeenCalledTimes(3);
    expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(2);
    expect(transport.subscribeToUserGroup).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it.each(['subscribe', 'unsubscribe'] as const)('retires related EVENTS summaries before a %s write whose response is lost, without replaying it', async operation => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'MEMBERS', true)));
    if (operation === 'unsubscribe') access.userGroups.push({ userGroup: { id: MEMBER_GROUP } });
    const view = mount();
    await screen.findByText('Current Member');
    const cached = { events: summaries('Related EVENTS summary') };
    rememberSectionEventSummaries(view.queryClient, cached, captureSectionEventSummaryRead(view.queryClient, B));
    expect(getFreshSectionEventSummaries(view.queryClient, B)).toEqual(cached);
    const failLostResponse = async () => {
      // This runs at the SDK transport boundary, before the mutation can settle.
      // A server commit may already have happened even though its reply is lost.
      expect(getFreshSectionEventSummaries(view.queryClient, B)).toBeUndefined();
      throw new Error('Mutation response lost');
    };
    if (operation === 'subscribe') transport.subscribeToUserGroup.mockImplementationOnce(failLostResponse);
    else {
      vi.spyOn(generated, 'unsubscribeFromUserGroupRef').mockReturnValue({ name: 'UnsubscribeFromUserGroup', variables: { userGroupId: MEMBER_GROUP } } as never);
      vi.mocked(executeMutation).mockImplementationOnce(failLostResponse);
    }

    await userEvent.click(screen.getByRole('button', { name: operation === 'subscribe' ? 'Subscribe' : 'Unsubscribe' }));
    await screen.findByText(operation === 'subscribe' ? 'Failed to subscribe. Please try again.' : 'Failed to unsubscribe. Please try again.');
    await settle();
    expect(getFreshSectionEventSummaries(view.queryClient, B)).toBeUndefined();
    if (operation === 'subscribe') {
      expect(transport.subscribeToUserGroup).toHaveBeenCalledExactlyOnceWith({ userGroupId: MEMBER_GROUP });
      expect(executeMutation).not.toHaveBeenCalled();
    } else {
      expect(executeMutation).toHaveBeenCalledOnce();
      expect(transport.subscribeToUserGroup).not.toHaveBeenCalled();
    }
    expect(invalidation).not.toHaveBeenCalled();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('does not report subscription recovery complete when metadata recovers but its required directory read fails', async () => {
    const authorityRefresh = deferred<void>();
    transport.getSectionForUser
      .mockResolvedValueOnce(sdk(lookup(A, 'MEMBERS', true)))
      .mockRejectedValueOnce(new Error('Metadata refresh unavailable'))
      .mockResolvedValue(sdk(lookup(A, 'MEMBERS', true)));
    transport.getSectionMembersMerged
      .mockResolvedValueOnce(sdk(directory('Current')))
      .mockRejectedValueOnce(new Error('Directory refresh unavailable'))
      .mockResolvedValue(sdk(directory('Refreshed')));
    invalidation
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(authorityRefresh.promise)
      .mockResolvedValue(undefined);
    mount();
    await screen.findByText('Current Member');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText(/Your subscription change was saved/);
    expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    // Metadata has recovered and its automatic directory read has already failed
    // while the authority refresh is pending. That settled failure must satisfy
    // the wait with `false`, rather than silently starting a replacement read.
    await screen.findByText('Directory read failed');
    await act(async () => authorityRefresh.resolve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry refresh' })).toBeEnabled());
    expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Successfully subscribed to this section.')).not.toBeInTheDocument();
    expect(screen.getByText(/Your subscription change was saved/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    await screen.findByText('Successfully subscribed to this section.');
    expect(screen.getByText('Refreshed Member')).toBeInTheDocument();
    expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(3);
    expect(transport.getSectionForUser).toHaveBeenCalledTimes(4);
    expect(transport.subscribeToUserGroup).toHaveBeenCalledExactlyOnceWith({ userGroupId: MEMBER_GROUP });
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('stops directory refreshes after subscription revalidation discovers the same section is now EVENTS', async () => {
    transport.getSectionForUser.mockResolvedValueOnce(sdk(lookup(A, 'MEMBERS', true))).mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    mount();
    await screen.findByText('Current Member');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await screen.findByText('Events ready');
    const memberReads = transport.getSectionMembersMerged.mock.calls.length;
    fireEvent(window, new Event('member-profile-reviewed'));
    await userEvent.click(screen.getByRole('button', { name: 'Retry events read' }));
    await waitFor(() => expect(transport.getSectionEventsForUser).toHaveBeenCalledTimes(2));
    expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(memberReads);
    expect(transport.subscribeToUserGroup).toHaveBeenCalledOnce();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('does not start an obsolete section read after its metadata arrives behind the new section', async () => {
    const old = deferred<ReturnType<typeof sdk<SectionForUserResponse>>>();
    transport.getSectionForUser.mockReturnValueOnce(old.promise).mockResolvedValue(sdk(lookup(B, 'MEMBERS')));
    const view = mount(A);
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    view.change(B);
    await screen.findByText('Current Member');
    await act(async () => old.resolve(sdk(lookup(A, 'EVENTS'))));
    fireEvent(window, new Event('member-profile-reviewed'));
    await waitFor(() => expect(transport.getSectionMembersMerged).toHaveBeenCalledTimes(2));
    expect(transport.getSectionMembersMerged.mock.calls.every(call => call[0].sectionId === B)).toBe(true);
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(screen.queryByText('Section A')).not.toBeInTheDocument();
  });

  it.each(['resolve', 'reject'] as const)('ignores a late old directory %s after changing to an EVENTS section', async outcome => {
    const old = deferred<ReturnType<typeof sdk<ReturnType<typeof directory>>>>();
    transport.getSectionMembersMerged.mockReturnValueOnce(old.promise);
    transport.getSectionForUser.mockResolvedValueOnce(sdk(lookup(A))).mockResolvedValue(sdk(lookup(B, 'EVENTS')));
    const view = mount(A);
    await waitFor(() => expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce());
    view.change(B);
    await screen.findByText('Events ready');
    await act(async () => { if (outcome === 'resolve') old.resolve(sdk(directory('Obsolete'))); else old.reject(new Error('Obsolete failure')); });
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: B });
    expect(screen.queryByText('Obsolete Member')).not.toBeInTheDocument();
    expect(screen.queryByText('Directory read failed')).not.toBeInTheDocument();
  });

  it('switches event selection without loading a list and ignores the previous event result', async () => {
    const old = deferred<ReturnType<typeof sdk<EventForUserResponse>>>();
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    transport.getEventForUser.mockReturnValueOnce(old.promise).mockResolvedValue(sdk(eventResult(EVENT_2, A, 'Newest event')));
    const view = mount(A, EVENT_1);
    await waitFor(() => expect(transport.getEventForUser).toHaveBeenCalledOnce());
    view.change(A, EVENT_2);
    await screen.findByRole('heading', { name: 'Newest event', level: 4 });
    await act(async () => old.resolve(sdk(eventResult(EVENT_1, A, 'Obsolete event'))));
    expect(screen.queryByText('Obsolete event')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Newest event', level: 4 })).toBeInTheDocument();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  });

  it('does not render the previous event failure while the next event is pending', async () => {
    const pending = deferred<ReturnType<typeof sdk<EventForUserResponse>>>();
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    transport.getEventForUser.mockRejectedValueOnce(new Error('Previous event unavailable')).mockReturnValueOnce(pending.promise);
    const view = mount(A, EVENT_1);
    await screen.findByText('Event read failed');
    viewRenders.detail.mockClear();
    view.change(A, EVENT_2);
    await waitFor(() => expect(transport.getEventForUser).toHaveBeenCalledTimes(2));
    expect(viewRenders.detail).toHaveBeenCalled();
    for (const [props] of viewRenders.detail.mock.calls) expect(props).toEqual({ loading: true, isError: false, eventId: undefined });
    expect(screen.queryByText('Event read failed')).not.toBeInTheDocument();
    await act(async () => pending.resolve(sdk(eventResult(EVENT_2, A, 'Recovered next event'))));
    await screen.findByRole('heading', { name: 'Recovered next event', level: 4 });
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  });

  it('keeps a pending list result out of the selected event, then reuses that valid snapshot on Back', async () => {
    const old = deferred<ReturnType<typeof sdk<SectionEventsForUserResponse>>>();
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    transport.getSectionEventsForUser.mockReturnValueOnce(old.promise);
    const view = mount();
    await waitFor(() => expect(transport.getSectionEventsForUser).toHaveBeenCalledOnce());
    view.change(A, EVENT_1);
    await screen.findByRole('heading', { name: 'Selected event', level: 4 });
    await act(async () => old.resolve(sdk({ events: [{ id: EVENT_2, title: 'Pending list row' }] as SectionEventsForUserResponse['events'] })));
    expect(screen.queryByText('Pending list row')).not.toBeInTheDocument();
    expect(transport.getSectionEventsForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    view.change(A);
    await screen.findByText('Pending list row');
    expect(transport.getSectionEventsForUser).toHaveBeenCalledOnce();
    expect(transport.getEventForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
  });

  it('the real callable session boundary rejects late metadata after retirement before content reads can start', async () => {
    const pending = deferred<ReturnType<typeof sdk<SectionForUserResponse>>>();
    transport.getSectionForUser.mockReturnValueOnce(pending.promise);
    mount();
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    act(() => lifecycle.retire());
    await act(async () => pending.resolve(sdk(lookup(A))));
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expectNoContentRequests();
    expect(screen.queryByText('Current Member')).not.toBeInTheDocument();
  });

  it('the real callable session boundary cannot publish a directory completion or start another read after retirement', async () => {
    const pending = deferred<ReturnType<typeof sdk<ReturnType<typeof directory>>>>();
    transport.getSectionMembersMerged.mockReturnValueOnce(pending.promise);
    mount();
    await waitFor(() => expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce());
    act(() => lifecycle.retire());
    await act(async () => pending.resolve(sdk(directory('Retired private'))));
    fireEvent(window, new Event('member-profile-reviewed'));
    await settle();
    expect(screen.queryByText('Retired private Member')).not.toBeInTheDocument();
    expect(transport.getSectionMembersMerged).toHaveBeenCalledOnce();
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });
});

describe('SectionDetail bundled initial content', () => {
  it.each(['MEMBERS', 'EVENTS', 'EVENT'] as const)('renders bundled %s content from one callable without a fallback request', async kind => {
    const content: NonNullable<SectionForUserResponse['content']> = kind === 'MEMBERS'
      ? { kind, status: 'ready', ...directory('Bundled') }
      : kind === 'EVENTS' ? { kind, status: 'ready', events: summaries('Bundled list row') }
        : { kind, status: 'ready', ...eventResult(EVENT_1, A, 'Bundled event') };
    transport.getSectionForUser.mockResolvedValue(sdk({ ...lookup(A, kind === 'MEMBERS' ? 'MEMBERS' : 'EVENTS'), content }));
    mount(A, kind === 'EVENT' ? EVENT_1 : undefined);
    if (kind === 'EVENT') await screen.findByRole('heading', { name: 'Bundled event', level: 4 });
    else await screen.findByText(kind === 'MEMBERS' ? 'Bundled Member' : 'Bundled list row');
    expect(transport.getSectionForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A, content: kind === 'EVENT' ? 'EVENT' : 'SECTION', ...(kind === 'EVENT' ? { eventId: EVENT_1 } : {}) });
    expectNoContentRequests();
  });

  it.each(['MEMBERS', 'EVENTS', 'EVENT'] as const)('keeps metadata for a failed bundled %s read and waits for its explicit targeted retry', async kind => {
    transport.getSectionForUser.mockResolvedValue(sdk({
      ...lookup(A, kind === 'MEMBERS' ? 'MEMBERS' : 'EVENTS'), content: { kind, status: 'error' },
    }));
    mount(A, kind === 'EVENT' ? EVENT_1 : undefined);
    const failure = kind === 'MEMBERS' ? 'Directory read failed' : kind === 'EVENTS' ? 'Events read failed' : 'Event read failed';
    await screen.findByText(failure);
    expect(screen.getAllByText('Section A').length).toBeGreaterThan(0);
    expectNoContentRequests();
    await userEvent.click(screen.getByRole('button', { name: kind === 'MEMBERS' ? 'Retry directory read' : kind === 'EVENTS' ? 'Retry events read' : 'Retry event read' }));
    await screen.findByText(kind === 'MEMBERS' ? 'Directory ready' : kind === 'EVENTS' ? 'Events ready' : 'Event detail ready');
    expect(screen.queryByText(failure)).not.toBeInTheDocument();
    const callable = kind === 'MEMBERS' ? transport.getSectionMembersMerged : kind === 'EVENTS' ? transport.getSectionEventsForUser : transport.getEventForUser;
    expect(callable).toHaveBeenCalledOnce();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    for (const other of [transport.getSectionMembersMerged, transport.getSectionEventsForUser, transport.getEventForUser]) if (other !== callable) expect(other).not.toHaveBeenCalled();
  });

  it('uses exactly one type-appropriate fallback when an older backend omits optional content', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk(lookup(A, 'EVENTS')));
    transport.getSectionEventsForUser.mockResolvedValue(sdk({ events: summaries('Legacy backend row') }));
    mount();
    await screen.findByText('Legacy backend row');
    expect(transport.getSectionForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A, content: 'SECTION' });
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A });
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('does not expose supplied content when metadata denies access', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk({ section: null, hasAccess: false, canModerate: false,
      content: { kind: 'MEMBERS', status: 'ready', ...directory('Denied private') },
    }));
    mount();
    await screen.findByRole('heading', { name: 'Section unavailable' });
    expect(screen.queryByText('Denied private Member')).not.toBeInTheDocument();
    expectNoContentRequests();
  });

  it('rejects a bundled event from a different parent without a speculative retry', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk({ ...lookup(A, 'EVENTS'),
      content: { kind: 'EVENT', status: 'ready', ...eventResult(EVENT_1, B, 'Other section private event') },
    }));
    mount(A, EVENT_1);
    await screen.findByText('Event read failed');
    expect(screen.queryByText('Other section private event')).not.toBeInTheDocument();
    expectNoContentRequests();
  });

  it('reuses the list bundle on detail → Back, then clears it after booking completion', async () => {
    transport.getSectionForUser.mockResolvedValue(sdk({ ...lookup(A, 'EVENTS'),
      content: { kind: 'EVENTS', status: 'ready', events: summaries('Initial summary row') },
    }));
    transport.getSectionEventsForUser.mockResolvedValue(sdk({ events: summaries('Post-booking summary row') }));
    const view = mount();
    await screen.findByText('Initial summary row');
    view.change(A, EVENT_1);
    await screen.findByRole('heading', { name: 'Selected event', level: 4 });
    view.change(A);
    await screen.findByText('Initial summary row');
    expect(transport.getSectionEventsForUser).not.toHaveBeenCalled();
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();

    view.change(A, EVENT_1);
    await screen.findByRole('heading', { name: 'Selected event', level: 4 });
    await userEvent.click(screen.getByRole('button', { name: 'Booking completed' }));
    await waitFor(() => expect(transport.getEventForUser).toHaveBeenCalledTimes(3));
    await screen.findByText('Event detail ready');
    view.change(A);
    await screen.findByText('Post-booking summary row');
    expect(screen.queryByText('Initial summary row')).not.toBeInTheDocument();
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A });
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  });

  it('discards an invalidated pending page bundle before rendering or seeding and reads current summaries instead', async () => {
    const pending = deferred<ReturnType<typeof sdk<SectionForUserResponse>>>();
    transport.getSectionForUser.mockReturnValueOnce(pending.promise);
    const fresh = { events: summaries('Fresh post-write summary') };
    transport.getSectionEventsForUser.mockResolvedValueOnce(sdk(fresh));
    const view = mount();
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    act(() => removeSectionEventSummaries(view.queryClient));
    await act(async () => pending.resolve(sdk({ ...lookup(A, 'EVENTS'),
      content: { kind: 'EVENTS', status: 'ready', events: summaries('Stale pre-write summary') },
    })));
    await screen.findByText('Fresh post-write summary');
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A });
    expect(viewRenders.events.mock.calls.every(([props]) => !props.titles.includes('Stale pre-write summary'))).toBe(true);
    expect(screen.queryByText('Stale pre-write summary')).not.toBeInTheDocument();
    expect(getFreshSectionEventSummaries(view.queryClient, A)).toEqual(fresh);
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
    expect(transport.getEventForUser).not.toHaveBeenCalled();
  });

  it('cannot consume a deferred list bundle after navigating to an event and invalidating it with a booking', async () => {
    const pending = deferred<ReturnType<typeof sdk<SectionForUserResponse>>>();
    transport.getSectionForUser.mockReturnValueOnce(pending.promise);
    transport.getSectionEventsForUser.mockResolvedValueOnce(sdk({ events: summaries('Current after-booking summary') }));
    const view = mount();
    await waitFor(() => expect(transport.getSectionForUser).toHaveBeenCalledOnce());
    view.change(A, EVENT_1);
    await act(async () => pending.resolve(sdk({ ...lookup(A, 'EVENTS'),
      content: { kind: 'EVENTS', status: 'ready', events: summaries('Unused pre-booking bundle') },
    })));
    await screen.findByRole('heading', { name: 'Selected event', level: 4 });
    await userEvent.click(screen.getByRole('button', { name: 'Booking completed' }));
    await waitFor(() => expect(transport.getEventForUser).toHaveBeenCalledTimes(2));
    await screen.findByText('Event detail ready');
    view.change(A);
    await screen.findByText('Current after-booking summary');
    expect(transport.getSectionEventsForUser).toHaveBeenCalledExactlyOnceWith({ sectionId: A });
    expect(viewRenders.events.mock.calls.every(([props]) => !props.titles.includes('Unused pre-booking bundle'))).toBe(true);
    expect(transport.getSectionForUser).toHaveBeenCalledOnce();
    expect(transport.getSectionMembersMerged).not.toHaveBeenCalled();
  });
});
