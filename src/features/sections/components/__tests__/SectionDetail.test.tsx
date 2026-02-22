import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import SectionDetail from '../SectionDetail';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import { getSectionMembersMerged } from '../../../../shared/utils/firebaseFunctions';

// Mock the DataConnect hooks (SectionDetail uses getSectionMembersMerged callable, not useGetSectionMembers)
vi.mock('@dataconnect/generated/react', () => ({
  useGetSectionById: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
}));

vi.mock('../../../../shared/utils/firebaseFunctions', () => ({
  getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
}));

vi.mock('firebase/data-connect', () => ({
  executeMutation: vi.fn().mockResolvedValue({}),
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
    subscribeToAccessGroupRef: vi.fn((dc: any, vars: any) => ({ type: 'mutation', dc, vars })),
    unsubscribeFromAccessGroupRef: vi.fn((dc: any, vars: any) => ({ type: 'mutation', dc, vars })),
  };
});

describe('SectionDetail', () => {
  const mockOnBack = vi.fn();
  const sectionId = 'section-1';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: { section: { id: sectionId, events: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  it('should render loading state', () => {
    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    expect(screen.getByText('Section Details')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render error state', async () => {
    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load section details/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render section information', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        viewingAccessGroups: [
          {
            accessGroup: {
              id: 'view-group-1',
              name: 'View Group',
              description: 'View description',
              subscribable: false,
            },
          },
        ],
        memberAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('MEMBERS')).toBeInTheDocument();
  });

  it('should render member list for MEMBERS sections', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        viewingAccessGroups: [
          {
            accessGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
        ],
        memberAccessGroups: [],
      },
    };

    vi.mocked(getSectionMembersMerged).mockResolvedValue({
      members: [
        { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', membershipStatus: 'REGULAR' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', membershipStatus: 'RESERVE' },
      ],
    });

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText('Members (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('REGULAR')).toBeInTheDocument();
    expect(screen.getByText('RESERVE')).toBeInTheDocument();
  });

  it('should show subscribe button when user can subscribe', async () => {
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        viewingAccessGroups: [
          {
            accessGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
        ],
        memberAccessGroups: [
          {
            accessGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [
            {
              accessGroup: {
                id: 'view-group-1',
              },
            },
          ],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

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
        viewingAccessGroups: [
          {
            accessGroup: {
              id: 'view-group-1',
              name: 'View Group',
              subscribable: false,
            },
          },
        ],
        memberAccessGroups: [
          {
            accessGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              subscribable: true,
            },
          },
        ],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [
            {
              accessGroup: {
                id: 'view-group-1',
              },
            },
            {
              accessGroup: {
                id: 'member-group-1',
              },
            },
          ],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

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
        viewingAccessGroups: [],
        memberAccessGroups: [],
      },
    };

    vi.mocked(getSectionMembersMerged).mockResolvedValue({
      members: [
        { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', membershipStatus: 'REGULAR' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', membershipStatus: 'RESERVE' },
      ],
    });

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

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
        viewingAccessGroups: [],
        memberAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [],
        },
      } as any,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: { section: { id: sectionId, events: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
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
        viewingAccessGroups: [],
        memberAccessGroups: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [
          {
            id: eventId,
            title: 'Annual Dinner',
            startDateTime: '2025-03-01T18:00:00Z',
            endDateTime: '2025-03-01T22:00:00Z',
            bookingStartDateTime: '2025-02-01T00:00:00Z',
            bookingEndDateTime: '2025-02-28T23:59:59Z',
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
        startDateTime: '2025-03-01T18:00:00Z',
        endDateTime: '2025-03-01T22:00:00Z',
        bookingStartDateTime: '2025-02-01T00:00:00Z',
        bookingEndDateTime: '2025-02-28T23:59:59Z',
        location: 'Main Hall',
        guestOfHonour: 'Jane Doe',
        ticketTypes: [
          { id: 'tt-1', title: 'Standard', description: 'Standard ticket', price: 25, sortOrder: 0, accessGroup: { id: 'ag-1', name: 'Standard Access' } },
        ],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: { user: { id: 'user-1', accessGroups: [] } } as any,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: mockEventsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: mockEventDetailData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Back to events')).toBeInTheDocument();
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
      expect(screen.getByText('Main Hall')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Ticket types')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
      expect(screen.getByText('Standard Access')).toBeInTheDocument();
    });
  });

  it('should return to events list when Back to events is clicked', async () => {
    const eventId = 'event-1';
    const mockSectionData = {
      section: {
        id: sectionId,
        name: 'Events Section',
        type: 'EVENTS',
        viewingAccessGroups: [],
        memberAccessGroups: [],
      },
    };
    const mockEventsData = {
      section: {
        id: sectionId,
        events: [{ id: eventId, title: 'Annual Dinner', startDateTime: '2025-03-01T18:00:00Z', endDateTime: '2025-03-01T22:00:00Z', bookingStartDateTime: '2025-02-01T00:00:00Z', bookingEndDateTime: '2025-02-28T23:59:59Z', location: null, guestOfHonour: null }],
      },
    };
    const mockEventDetailData = {
      event: {
        id: eventId,
        title: 'Annual Dinner',
        startDateTime: '2025-03-01T18:00:00Z',
        endDateTime: '2025-03-01T22:00:00Z',
        bookingStartDateTime: '2025-02-01T00:00:00Z',
        bookingEndDateTime: '2025-02-28T23:59:59Z',
        location: null,
        guestOfHonour: null,
        ticketTypes: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: { user: { id: 'user-1', accessGroups: [] } } as any,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: mockEventsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: mockEventDetailData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Back to events')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to events/i }));

    await waitFor(() => {
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Annual Dinner')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /back to events/i })).not.toBeInTheDocument();
    });
  });
});
