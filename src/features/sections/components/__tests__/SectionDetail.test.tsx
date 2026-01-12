import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import SectionDetail from '../SectionDetail';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import { executeMutation } from 'firebase/data-connect';

// Mock the DataConnect hooks
vi.mock('@dataconnect/generated/react', () => ({
  useGetSectionById: vi.fn(),
  useGetSectionMembers: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
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
  });

  it('should render loading state', () => {
    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
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

  it('should render error state', () => {
    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetUserAccessGroups).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any);

    render(<SectionDetail sectionId={sectionId} onBack={mockOnBack} />);

    expect(screen.getByText(/failed to load section details/i)).toBeInTheDocument();
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

    const mockMembersData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        description: 'Test description',
        memberAccessGroups: [],
        viewingAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: mockMembersData as any,
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

    const mockMembersData = {
      section: {
        id: sectionId,
        name: 'Test Section',
        type: 'MEMBERS',
        memberAccessGroups: [
          {
            accessGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR',
                  },
                },
                {
                  user: {
                    id: 'user-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    membershipStatus: 'RESERVE',
                  },
                },
              ],
            },
          },
        ],
        viewingAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: mockMembersData as any,
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

    const mockMembersData = {
      section: {
        id: sectionId,
        type: 'MEMBERS',
        memberAccessGroups: [],
        viewingAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: mockMembersData as any,
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

    const mockMembersData = {
      section: {
        id: sectionId,
        type: 'MEMBERS',
        memberAccessGroups: [],
        viewingAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: mockMembersData as any,
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

    const mockMembersData = {
      section: {
        id: sectionId,
        type: 'MEMBERS',
        memberAccessGroups: [
          {
            accessGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR',
                  },
                },
                {
                  user: {
                    id: 'user-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    membershipStatus: 'RESERVE',
                  },
                },
              ],
            },
          },
        ],
        viewingAccessGroups: [],
      },
    };

    vi.mocked(reactGenerated.useGetSectionById).mockReturnValue({
      data: mockSectionData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: mockMembersData as any,
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

  it('should show placeholder for EVENTS sections', async () => {
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

    vi.mocked(reactGenerated.useGetSectionMembers).mockReturnValue({
      data: undefined,
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
      expect(screen.getByText(/events list coming soon/i)).toBeInTheDocument();
    });
  });
});
