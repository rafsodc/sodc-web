import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import { MemoryRouter } from 'react-router-dom';
import SectionDetail from '../SectionDetail';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import { getSectionMembersMerged } from '../../../../shared/utils/firebaseFunctions';
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from '../../../../test-utils/dataConnectMocks';

// Mock the DataConnect hooks (SectionDetail uses getSectionMembersMerged callable, not useGetSectionMembers)
vi.mock('@dataconnect/generated/react', () => ({
  useGetSectionById: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
  useGetCurrentUser: vi.fn(),
  useGetMyBookingsForEvent: vi.fn(),
  useGetMyTicketOrders: vi.fn(),
  useGetMyBookingPaymentAdjustments: vi.fn(),
}));

vi.mock('../../../../shared/utils/firebaseFunctions', () => ({
  getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
  submitEventBooking: vi.fn(),
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

function mockGetSectionById(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetSectionById).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetSectionById>(overrides)
  );
}

function mockGetUserAccessGroups(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetUserAccessGroups>(overrides)
  );
}

function mockGetEventsForSection(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventsForSection>(overrides)
  );
}

function mockGetEventById(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventById).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventById>(overrides)
  );
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

  it('should render section information on the About tab', async () => {
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

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Section', level: 4 })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'About' }));

    expect(screen.getByRole('tab', { name: 'About', selected: true })).toBeInTheDocument();
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

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Members', selected: true })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'About' }));

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

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Members', selected: true })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'About' }));

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
      expect(screen.getByRole('tab', { name: 'Events', selected: true })).toBeInTheDocument();
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
      expect(screen.getByRole('tab', { name: 'Events', selected: true })).toBeInTheDocument();
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

  it('should open the booking wizard on the review step when payment is still due', async () => {
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
      expect(screen.getByText('Complete your booking')).toBeInTheDocument();
      expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
      expect(screen.queryByText('Book this event')).not.toBeInTheDocument();
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
      expect(screen.getByRole('tab', { name: 'Events', selected: true })).toBeInTheDocument();
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

  it('should switch between About and Members tabs on MEMBERS sections', async () => {
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

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderSectionDetail();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Members', selected: true })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'About' }));

    await waitFor(() => {
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.queryByLabelText(/search members/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: 'Members' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/search members/i)).toBeInTheDocument();
    });
  });
});
