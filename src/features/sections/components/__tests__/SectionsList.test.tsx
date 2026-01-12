import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import SectionsList from '../SectionsList';
import * as reactGenerated from '@dataconnect/generated/react';

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

describe('SectionsList', () => {
  const mockOnBack = vi.fn();
  const mockOnSelectSection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    expect(screen.getByText('Sections')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render error state', () => {
    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    expect(screen.getByText(/failed to load sections/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render sections list for regular users', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        accessGroups: [
          {
            accessGroup: {
              id: 'group-1',
              name: 'Group 1',
              sections: [
                {
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

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: mockSectionsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    expect(screen.getByText('MEMBERS')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render sections list for admin users', async () => {
    const useAdminClaimModule = await import('../../../users/hooks/useAdminClaim');
    vi.mocked(useAdminClaimModule.useAdminClaim).mockReturnValue(true);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: {
        sections: [
          {
            id: 'section-1',
            name: 'Admin Section',
            type: 'EVENTS',
            description: 'Admin description',
          },
        ],
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText('Admin Section')).toBeInTheDocument();
    });
  });

  it('should filter sections by search term', async () => {
    const mockSectionsData = {
      user: {
        id: 'user-1',
        accessGroups: [
          {
            accessGroup: {
              id: 'group-1',
              name: 'Group 1',
              sections: [
                {
                  section: {
                    id: 'section-1',
                    name: 'Test Section',
                    type: 'MEMBERS',
                    description: 'Test description',
                  },
                },
                {
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

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: mockSectionsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

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
        accessGroups: [
          {
            accessGroup: {
              id: 'group-1',
              name: 'Group 1',
              sections: [
                {
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

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: mockSectionsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

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
        accessGroups: [
          {
            accessGroup: {
              id: 'group-1',
              name: 'Group 1',
              sections: [
                {
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

    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: mockSectionsData as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

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
    vi.mocked(reactGenerated.useGetSectionsForUser).mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          accessGroups: [],
        },
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(reactGenerated.useListSections).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionsList onBack={mockOnBack} onSelectSection={mockOnSelectSection} />);

    await waitFor(() => {
      expect(screen.getByText(/no sections available/i)).toBeInTheDocument();
    });
  });
});
