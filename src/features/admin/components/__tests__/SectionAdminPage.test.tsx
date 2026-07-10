import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SectionAdminPage from '../SectionAdminPage';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from '../../../../test-utils/dataConnectMocks';
import { ROUTES } from '../../../../constants';

vi.mock('@dataconnect/generated/react', () => ({
  useGetSectionById: vi.fn(),
  useGetUserAccessGroups: vi.fn(),
}));

const mockCurrentUser = createMockUser({ uid: 'user-1' });
let mockIsAdmin = false;

vi.mock('../../../users/hooks/useAdminClaim', () => ({
  useAdminClaim: vi.fn(() => mockIsAdmin),
}));

vi.mock('../../../../config/firebase', () => ({
  dataConnect: {},
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../SendAnnouncementPage', () => ({
  default: ({ sectionName, onBack }: { sectionName: string; onBack: () => void }) => (
    <div>
      <div>Mock Send Announcement Page for {sectionName}</div>
      <button onClick={onBack}>Back to hub</button>
    </div>
  ),
}));

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

const sectionId = 'section-1';
const moderatorGroupId = 'group-moderator';

function renderSectionAdminPage(sectionType: string = 'MEMBERS') {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: `/admin/section/${sectionId}`, state: { sectionName: 'Test Section', sectionType } },
      ]}
    >
      <Routes>
        <Route path="/admin/section/:sectionId" element={<SectionAdminPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SectionAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
    mockGetSectionById({
      data: {
        section: {
          id: sectionId,
          purposeLinks: [
            { purposes: ['MODERATOR'], userGroup: { id: moderatorGroupId } },
          ],
        },
      },
    });
    mockGetUserAccessGroups({
      data: { user: { userGroups: [] } },
    });
  });

  it('shows access denied for a user who is neither admin nor a section moderator', async () => {
    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Send Announcement')).not.toBeInTheDocument();
  });

  it('navigates home from the access-denied state', async () => {
    const user = userEvent.setup();
    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Back to Home'));
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it('shows the admin hub for a section moderator, without the admin-only Edit Section card', async () => {
    mockGetUserAccessGroups({
      data: { user: { userGroups: [{ userGroup: { id: moderatorGroupId } }] } },
    });

    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText('Send Announcement')).toBeInTheDocument();
    });
    expect(screen.queryByText('Edit Section')).not.toBeInTheDocument();
  });

  it('opens and returns from the Send Announcement view', async () => {
    const user = userEvent.setup();
    mockGetUserAccessGroups({
      data: { user: { userGroups: [{ userGroup: { id: moderatorGroupId } }] } },
    });

    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText('Send Announcement')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Send Announcement'));

    expect(screen.getByText('Mock Send Announcement Page for Test Section')).toBeInTheDocument();

    await user.click(screen.getByText('Back to hub'));
    expect(screen.getByText('Send Announcement')).toBeInTheDocument();
  });

  it('navigates to Manage Sections with the managed section for an EVENTS section', async () => {
    const user = userEvent.setup();
    mockIsAdmin = true;

    renderSectionAdminPage('EVENTS');

    await waitFor(() => {
      expect(screen.getByText('Manage Events')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Manage Events'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.MANAGE_SECTIONS, {
      state: { managedSection: { id: sectionId, name: 'Test Section' } },
    });
  });

  it('shows the admin hub including Edit Section for a global admin, and navigates to edit it', async () => {
    const user = userEvent.setup();
    mockIsAdmin = true;

    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText('Edit Section')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Edit Section'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.MANAGE_SECTIONS, {
      state: { editSectionId: sectionId },
    });
  });
});
