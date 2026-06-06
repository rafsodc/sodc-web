import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import SectionsList from '../SectionsList';
import * as reactGenerated from '@dataconnect/generated/react';
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from '../../../../test-utils/dataConnectMocks';

// Mock the DataConnect hooks
vi.mock('@dataconnect/generated/react', () => ({
  useGetSectionsForUser: vi.fn(),
  useListSections: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../../../config/firebase', () => ({
  dataConnect: {},
  auth: {
    currentUser: null,
  },
}));

vi.mock('../../../users/hooks/useAdminClaim', () => ({
  useAdminClaim: vi.fn(() => false),
}));

function mockGetSectionsForUser(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetSectionsForUser>(overrides)
  );
}

function mockListSections(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListSections).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListSections>(overrides)
  );
}

describe('SectionsList', () => {
  const mockOnBack = vi.fn();
  const mockOnSelectSection = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const useAdminClaimModule = await import('../../../users/hooks/useAdminClaim');
    vi.mocked(useAdminClaimModule.useAdminClaim).mockReturnValue(false);
  });

  it('should render loading state', () => {
    mockGetSectionsForUser({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    expect(screen.getByText('Sections')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render error state', () => {
    mockGetSectionsForUser({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    expect(screen.getByText(/failed to load sections/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render sections list for regular users', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              purposeLinks: [
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-1',
                    name: 'Test Section',
                    type: 'MEMBERS',
                    description: 'Test description',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should not include sections from member-only purpose when user has no access purpose', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              purposeLinks: [
                {
                  purposes: ['MEMBER'],
                  section: {
                    id: 'events-section-1',
                    name: 'Events Section',
                    type: 'EVENTS',
                    description: 'Member-only section',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });

    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('No sections available.')).toBeInTheDocument();
    });
  });

  it('should deduplicate section when user has both viewing and member access', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              purposeLinks: [
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-1',
                    name: 'Same Section',
                    type: 'EVENTS',
                    description: 'View and member',
                  },
                },
                {
                  purposes: ['MEMBER'],
                  section: {
                    id: 'section-1',
                    name: 'Same Section',
                    type: 'EVENTS',
                    description: 'View and member',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });

    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Same Section')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Same Section')).toHaveLength(1);
  });

  it('should render sections list for admin users', async () => {
    const useAdminClaimModule = await import('../../../users/hooks/useAdminClaim');
    vi.mocked(useAdminClaimModule.useAdminClaim).mockReturnValue(true);
    
    mockListSections({
      data: {
        sections: [
          {
            id: 'section-1',
            name: 'Admin Section',
            type: 'EVENTS',
            description: 'Admin description',
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Admin Section')).toBeInTheDocument();
    });
  });

  it('should filter sections by search term', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              purposeLinks: [
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-1',
                    name: 'Test Section',
                    type: 'MEMBERS',
                    description: 'Test description',
                  },
                },
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-2',
                    name: 'Another Section',
                    type: 'EVENTS',
                    description: 'Another description',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search sections/i);
    await user.type(searchInput, 'Another');

    expect(screen.queryByText('Test Section')).not.toBeInTheDocument();
    expect(screen.getByText('Another Section')).toBeInTheDocument();
  });

  it('should call onSelectSection when section is clicked', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              purposeLinks: [
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-1',
                    name: 'Test Section',
                    type: 'MEMBERS',
                    description: 'Test description',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    await user.click(viewButton);

    expect(mockOnSelectSection).toHaveBeenCalledWith('section-1');
  });

  it('should show empty state when no sections match search', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        userGroups: [
          {
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              purposeLinks: [
                {
                  purposes: ['ACCESS'],
                  section: {
                    id: 'section-1',
                    name: 'Test Section',
                    type: 'MEMBERS',
                    description: 'Test description',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    mockGetSectionsForUser({
      data: mockSectionsData,
      isLoading: false,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search sections/i);
    await user.type(searchInput, 'NonExistentSection');

    expect(screen.getByText(/no sections match your search/i)).toBeInTheDocument();
  });

  it('should show empty state when no sections available', async () => {
    mockGetSectionsForUser({
      data: {
        user: {
          id: 'user-1',
          userGroups: [],
        },
      },
      isLoading: false,
      isError: false,
    });
    
    mockListSections({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText(/no sections available/i)).toBeInTheDocument();
    });
  });
});
