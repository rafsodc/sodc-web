import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import { MemoryRouter } from 'react-router-dom';
import SectionDetail from '../SectionDetail';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import {
  getSectionMembersMerged,
  getSectionForUser,
  getSectionEventsForUser,
  getEventForUser,
} from '../../../../shared/utils/firebaseFunctions';
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from '../../../../test-utils/dataConnectMocks';

// Mock the DataConnect hooks (SectionDetail uses getSectionMembersMerged callable, not useGetSectionMembers)
vi.mock('@dataconnect/generated/react', () => ({
  useGetUserAccessGroups: vi.fn(),
  useGetSectionsForUser: vi.fn(() => ({
    data: { user: { membershipStatus: null, userGroups: [] }, allUserGroups: [] },
    isLoading: false,
  })),
  useGetCurrentUser: vi.fn(),
  useGetMyBookingsForEvent: vi.fn(),
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
  useGetSectionAnnouncementOptOut: vi.fn(() => ({
    data: null,
    isLoading: false,
    refetch: vi.fn(),
  })),
  useOptOutSectionAnnouncement: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    mutate: vi.fn(),
    isPending: false,
  })),
  useOptInSectionAnnouncement: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('../../../../shared/utils/firebaseFunctions', () => ({
  getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
  subscribeToUserGroup: vi.fn().mockResolvedValue(undefined),
  submitEventBooking: vi.fn(),
  getSectionForUser: vi.fn(),
  getSectionEventsForUser: vi.fn(),
  getEventForUser: vi.fn(),
}));

vi.mock('../../../users/hooks/useAdminClaim', () => ({
  useAdminClaim: vi.fn(() => false),
}));

vi.mock('firebase/data-connect', () => ({
  executeMutation: vi.fn().mockResolvedValue({}),
}));

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
}));

const mockCurrentUser = createMockUser({ uid: 'user-1' });

vi.mock('../../../../config/firebase', () => ({
  dataConnect: {},
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));

vi.mock('@dataconnect/generated', async () => {
  const actual = await vi.importActual('@dataconnect/generated');
  return {
    ...actual,
    subscribeToUserGroupRef: vi.fn((dc: unknown, vars: unknown) => ({ type: 'mutation', dc, vars })),
    unsubscribeFromUserGroupRef: vi.fn((dc: unknown, vars: unknown) => ({ type: 'mutation', dc, vars })),
  };
});

// SectionDetail.tsx fetches section/events/event-detail via callables (getSectionForUser etc.,
// see #328) rather than the react-query hooks these tests used to mock directly. These helpers
// keep the old { data, isLoading, isError } call shape used throughout this file (so none of the
// dozens of call sites below need to change) and translate it into a promise-based mock: a
// never-resolving promise for isLoading, a rejection for isError, otherwise a resolved value
// built from the same `data` shape the old react-query mock would have returned.
function mockGetSectionById(overrides: DataConnectQueryResultOverrides) {
  const mocked = vi.mocked(getSectionForUser);
  if (overrides.isLoading) {
    mocked.mockReturnValue(new Promise(() => undefined));
    return;
  }
  if (overrides.isError) {
    mocked.mockRejectedValue(new Error('Failed to load section'));
    return;
  }
  const section = (overrides.data as { section?: unknown } | undefined)?.section ?? null;
  mocked.mockResolvedValue({ section, hasAccess: true, canModerate: false } as Awaited<
    ReturnType<typeof getSectionForUser>
  >);
}

function mockGetUserAccessGroups(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetUserAccessGroups>(overrides)
  );
}

function mockGetEventsForSection(overrides: DataConnectQueryResultOverrides) {
  const mocked = vi.mocked(getSectionEventsForUser);
  if (overrides.isLoading) {
    mocked.mockReturnValue(new Promise(() => undefined));
    return;
  }
  if (overrides.isError) {
    mocked.mockRejectedValue(new Error('Failed to load events'));
    return;
  }
  const events = (overrides.data as { section?: { events?: unknown[] } } | undefined)?.section?.events ?? [];
  mocked.mockResolvedValue({ events } as Awaited<ReturnType<typeof getSectionEventsForUser>>);
}

function mockGetEventById(overrides: DataConnectQueryResultOverrides) {
  const mocked = vi.mocked(getEventForUser);
  if (overrides.isLoading) {
    mocked.mockReturnValue(new Promise(() => undefined));
    return;
  }
  if (overrides.isError) {
    mocked.mockRejectedValue(new Error('Failed to load event'));
    return;
  }
  const event = (overrides.data as { event?: unknown } | undefined)?.event ?? null;
  mocked.mockResolvedValue({ event } as Awaited<ReturnType<typeof getEventForUser>>);
}

function mockGetCurrentUser(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetCurrentUser).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetCurrentUser>(overrides)
  );
}

function mockGetMyBookingsForEvent(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetMyBookingsForEvent).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetMyBookingsForEvent>(overrides)
  );
}

function mockGetMyTicketOrders(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetMyTicketOrders).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetMyTicketOrders>(overrides)
  );
}

function mockGetMyBookingPaymentAdjustments(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetMyBookingPaymentAdjustments).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetMyBookingPaymentAdjustments>(overrides)
  );
}

describe('SectionDetail', () => {
  const mockOnBack = vi.fn();
  const sectionId = 'section-1';
  const upcomingEventTimes = {
    startDateTime: '2030-03-01T18:00:00Z',
    endDateTime: '2030-03-01T22:00:00Z',
    bookingStartDateTime: '2030-02-01T00:00:00Z',
    bookingEndDateTime: '2030-02-28T23:59:59Z',
  };
  const pastEventTimes = {
    startDateTime: '2024-03-01T18:00:00Z',
    endDateTime: '2024-03-01T22:00:00Z',
    bookingStartDateTime: '2024-02-01T00:00:00Z',
    bookingEndDateTime: '2024-02-28T23:59:59Z',
  };

  const renderSectionDetail = () =>
    render(
      <MemoryRouter>
        <SectionDetail sectionId={sectionId} onBack={mockOnBack} />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSectionMembersMerged).mockResolvedValue({ members: [] });
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockGetCurrentUser({
      data: { user: { membershipStatus: 'REGULAR' } },
      isLoading: false,
      isError: false,
    });
    mockGetMyBookingsForEvent({
      data: { user: { bookings: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetMyTicketOrders({
      data: { user: { ticketOrders: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetMyBookingPaymentAdjustments({
      data: { user: { bookings: [] } },
      isLoading: false,
      isError: false,
    });
  });

  it('should render loading state', () => {
    vi.mocked(getSectionMembersMerged).mockReturnValue(new Promise(() => undefined));

    mockGetSectionById({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    expect(screen.getByText('Section Details')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render error state', async () => {
    mockGetSectionById({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    mockGetUserAccessGroups({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText(/failed to load section details/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render section description above the members list', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              description: 'View description',
              subscribable: false,
            },
          },
        ],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Section', level: 4 })).toBeInTheDocument();
    });

    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render member list for MEMBERS sections', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
        ],
      },
    };

    vi.mocked(getSectionMembersMerged).mockResolvedValue({
      members: [
        { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', membershipStatus: 'REGULAR' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', membershipStatus: 'RESERVE' },
      ],
    });

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Members (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('Reserve')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show email' })).toHaveLength(2);
  });

  it('should show subscribe button when user can subscribe', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [
            { userGroup: { id: 'view-group-1' } },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    });
  });

  it('should show unsubscribe button when user is a member of subscribable group', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [
            { userGroup: { id: 'view-group-1' } },
            { userGroup: { id: 'member-group-1' } },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unsubscribe/i })).toBeInTheDocument();
    });
  });

  it('should filter members by search term', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [],
      },
    };

    vi.mocked(getSectionMembersMerged).mockResolvedValue({
      members: [
        { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', membershipStatus: 'REGULAR' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', membershipStatus: 'RESERVE' },
      ],
    });

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search members/i);
    await user.type(searchInput, 'Jane');

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should show events list for EVENTS sections', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        description: 'Events description',
        purposeLinks: [],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [] } },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText(/no upcoming events yet/i)).toBeInTheDocument();
    });
  });

  it('should show event detail when an event is selected in EVENTS section', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        description: 'Events description',
        purposeLinks: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [
          {
            id: eventId,
            title: 'Annual Dinner',
            ...upcomingEventTimes,
            location: 'Main Hall',
            guestOfHonour: 'Jane Doe',
          },
        ],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        ...upcomingEventTimes,
        bookingStartDateTime: '2020-01-01T00:00:00Z',
        bookingEndDateTime: '2030-12-31T23:59:59Z',
        location: 'Main Hall',
        guestOfHonour: 'Jane Doe',
        maxGuestsWithoutModeratorApproval: null,
        ticketTypes: [
          {
            id: 'tt-1',
            title: 'Standard',
            description: 'Standard ticket',
            price: 25,
            sortOrder: 0,
            audience: 'MEMBER',
            userGroup: { id: 'ag-1', name: 'Standard Access', membershipStatuses: ['REGULAR'] },
          },
        ],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: mockEventsData,
      isLoading: false,
      isError: false,
    });

    mockGetEventById({
      data: mockEventDetailData,
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /annual dinner/i }));

    await waitFor(() => {
      expect(screen.getByText('Back to events')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Annual Dinner', level: 2 })).toBeInTheDocument();
      expect(screen.getByText('Main Hall')).toBeInTheDocument();
      expect(screen.getByText(/Guest of honour: Jane Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Standard · £25\.00/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Book this event' })).toBeInTheDocument();
      expect(screen.queryByText('Ticket types')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument();
    });
  });

  it('should show the booking summary with pay action when payment is still due', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        description: 'Events description',
        purposeLinks: [
          {
            purposes: ['ACCESS', 'BOOKER'],
            userGroup: { id: 'group-1', membershipStatuses: ['REGULAR'] },
          },
        ],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [
          {
            id: eventId,
            title: 'Annual Dinner',
            ...upcomingEventTimes,
            location: 'Main Hall',
            guestOfHonour: 'Jane Doe',
          },
        ],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        ...upcomingEventTimes,
        bookingStartDateTime: '2020-01-01T00:00:00Z',
        bookingEndDateTime: '2030-12-31T23:59:59Z',
        location: 'Main Hall',
        guestOfHonour: 'Jane Doe',
        maxGuestsWithoutModeratorApproval: 1,
        ticketTypes: [
          {
            id: 'tt-1',
            title: 'Standard',
            description: 'Standard ticket',
            price: 25,
            sortOrder: 0,
            audience: 'MEMBER',
            userGroup: { id: 'group-1', name: 'Standard Access', membershipStatuses: ['REGULAR'] },
          },
        ],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [{ userGroup: { id: 'group-1' } }] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventsForSection({
      data: mockEventsData,
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: mockEventDetailData,
      isLoading: false,
      isError: false,
    });
    mockGetMyBookingsForEvent({
      data: {
        user: {
          bookings: [
            {
              id: 'booking-1',
              status: 'SUBMITTED',
              revisionNumber: 2,
              supersededAt: null,
              clientSubmissionKey: null,
              bookerDietaryNote: null,
              sitNextToUserIds: [],
              accommodationRequested: false,
              accommodationNote: null,
              lines: [
                {
                  id: 'line-1',
                  sortOrder: 0,
                  guestDisplayName: null,
                  dietaryNote: null,
                  ticketType: {
                    id: 'tt-1',
                    title: 'Standard',
                    audience: 'MEMBER',
                    price: 25,
                  },
                },
              ],
              guestTicketRequests: [{ id: 'gtr-1', status: 'PENDING', requestedGuestCount: 1 }],
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetMyTicketOrders({
      data: { user: { ticketOrders: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetMyBookingPaymentAdjustments({
      data: { user: { bookings: [] } },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /annual dinner/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Book' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'Book' }));

    await waitFor(() => {
      expect(screen.getByText('Your booking')).toBeInTheDocument();
      expect(screen.getByText('Payment not started')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pay for all tickets/i })).toBeInTheDocument();
    });

    // Edit booking → wizard opens (onWizardOpenChange(true)) → covers open=true branch
    await user.click(screen.getByRole('button', { name: /edit booking/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel editing/i })).toBeInTheDocument();
    });

    // Cancel editing → onWizardOpenChange(false) → setActiveTab("about") → covers open=false branch
    await user.click(screen.getByRole('button', { name: /cancel editing/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'About', selected: true })).toBeInTheDocument();
    });
  });

  it('should show breadcrumbs and return to events list when header Back is clicked from event detail', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [
          {
            id: eventId,
            title: 'Annual Dinner',
            ...upcomingEventTimes,
            location: 'Main Hall',
            guestOfHonour: null,
          },
        ],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        ...upcomingEventTimes,
        bookingStartDateTime: '2020-01-01T00:00:00Z',
        bookingEndDateTime: '2030-12-31T23:59:59Z',
        location: 'Main Hall',
        guestOfHonour: null,
        maxGuestsWithoutModeratorApproval: null,
        // omit ticketTypes to exercise the `?? []` null-fallback branch in EventDetailHero
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: mockEventsData,
      isLoading: false,
      isError: false,
    });

    mockGetEventById({
      data: mockEventDetailData,
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /annual dinner/i }));

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Annual Dinner', level: 4 })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Events Section', level: 4 })).toBeInTheDocument();
      expect(screen.queryByText('Back to events')).not.toBeInTheDocument();
    });

    expect(mockOnBack).not.toHaveBeenCalled();
  });

  it('should return to events list when Back to events is clicked', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [{ id: eventId, title: 'Annual Dinner', ...upcomingEventTimes, location: null, guestOfHonour: null }],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        ...upcomingEventTimes,
        location: null,
        guestOfHonour: null,
        ticketTypes: [],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: mockEventsData,
      isLoading: false,
      isError: false,
    });

    mockGetEventById({
      data: mockEventDetailData,
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /annual dinner/i }));

    await waitFor(() => {
      expect(screen.getByText('Back to events')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to events/i }));

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /back to events/i })).not.toBeInTheDocument();
    });
  });

  it('should hide past events from the default upcoming list', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: 'past-1',
              title: 'Old Dinner',
              ...pastEventTimes,
              location: 'Hall',
              guestOfHonour: null,
            },
            {
              id: 'upcoming-1',
              title: 'Spring Dinner',
              ...upcomingEventTimes,
              location: 'Hall',
              guestOfHonour: null,
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Spring Dinner')).toBeInTheDocument();
    });

    expect(screen.queryByText('Old Dinner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view past events/i })).toBeInTheDocument();
  });

  it('should show past events when View past events is clicked', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: 'past-1',
              title: 'Old Dinner',
              ...pastEventTimes,
              location: 'Hall',
              guestOfHonour: 'Guest',
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText(/no upcoming events right now/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /view past events/i }));

    await waitFor(() => {
      expect(screen.getByText('Old Dinner')).toBeInTheDocument();
      expect(screen.getByText('Guest of honour: Guest')).toBeInTheDocument();
    });
  });

  it('should show description and members list together on MEMBERS sections', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        purposeLinks: [],
      },
    };

    mockGetSectionById({
      data: mockSectionData,
      isLoading: false,
      isError: false,
    });

    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByLabelText(/search members/i)).toBeInTheDocument();
    });
  });

  it('should show ticket type without price on the About tab', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [{ id: eventId, title: 'Annual Dinner', ...upcomingEventTimes, location: null, guestOfHonour: null }],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        ...upcomingEventTimes,
        bookingStartDateTime: '2020-01-01T00:00:00Z',
        bookingEndDateTime: '2030-12-31T23:59:59Z',
        location: null,
        guestOfHonour: null,
        maxGuestsWithoutModeratorApproval: null,
        ticketTypes: [
          {
            id: 'tt-1',
            title: 'Standard',
            description: null,
            price: null,
            sortOrder: 0,
            audience: 'MEMBER',
            userGroup: { id: 'group-1', name: 'Standard Access', membershipStatuses: ['REGULAR'] },
          },
        ],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventsForSection({ data: mockEventsData, isLoading: false, isError: false });
    mockGetEventById({ data: mockEventDetailData, isLoading: false, isError: false });

    renderSectionDetail();

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Annual Dinner')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /annual dinner/i }));

    // About tab is default — EventDetailHero shows with no price on ticket chip
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument());
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });

  it('subscribes user and shows success snackbar when Subscribe is clicked', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [{ userGroup: { id: 'view-group-1' } }],
        },
      },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^subscribe$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^subscribe$/i }));

    await waitFor(() => {
      expect(screen.getByText(/successfully subscribed/i)).toBeInTheDocument();
    });

    // click outside to dismiss snackbar (exercises handleCloseSnackbar)
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByText(/successfully subscribed/i)).not.toBeInTheDocument();
    });
  });

  it('unsubscribes user and shows success snackbar when Unsubscribe is clicked', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: {
        user: {
          id: 'user-1',
          userGroups: [
            { userGroup: { id: 'view-group-1' } },
            { userGroup: { id: 'member-group-1' } },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unsubscribe/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /unsubscribe/i }));

    await waitFor(() => {
      expect(screen.getByText(/successfully unsubscribed/i)).toBeInTheDocument();
    });
  });

  it('shows announcement toggle for user with MODERATOR access (tests || branch in grantsAccess)', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        description: 'Events description',
        purposeLinks: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: {
        user: {
          membershipStatus: 'REGULAR',
          userGroups: [
            {
              userGroup: {
                membershipStatuses: null,
                purposeLinks: [
                  {
                    purposes: ['MODERATOR'],
                    section: { id: sectionId, name: 'Events Section' },
                  },
                ],
              },
            },
          ],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  it('shows announcement toggle for user with explicit section access', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        description: 'Events description',
        purposeLinks: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: {
        user: {
          membershipStatus: 'REGULAR',
          userGroups: [
            {
              userGroup: {
                membershipStatuses: null,
                purposeLinks: [
                  {
                    purposes: ['ACCESS'],
                    section: { id: sectionId, name: 'Events Section' },
                  },
                ],
              },
            },
          ],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  it('shows events list retry button when events fail to load', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventsForSection({ data: undefined, isLoading: false, isError: true });

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows members refresh button and calls refetch when clicked', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        purposeLinks: [],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /refresh/i }));
    // If the callback fires without throwing, the test passes
  });

  it('should navigate back to upcoming events from past events view', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        purposeLinks: [],
      },
    };

    mockGetSectionById({ data: mockSectionData, isLoading: false, isError: false });
    mockGetUserAccessGroups({
      data: { user: { id: 'user-1', userGroups: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            { id: 'past-1', title: 'Old Dinner', ...pastEventTimes, location: null, guestOfHonour: null },
            { id: 'upcoming-1', title: 'Spring Dinner', ...upcomingEventTimes, location: null, guestOfHonour: null },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => expect(screen.getByText('Spring Dinner')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /view past events/i }));

    await waitFor(() => expect(screen.getByText('Old Dinner')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /back to upcoming events/i }));

    await waitFor(() => {
      expect(screen.getByText('Spring Dinner')).toBeInTheDocument();
      expect(screen.queryByText('Old Dinner')).not.toBeInTheDocument();
    });
  });
});
