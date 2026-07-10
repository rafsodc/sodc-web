import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../../test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SectionAdminPage from '../SectionAdminPage';
import * as reactGenerated from '@dataconnect/generated/react';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from '../../../../test-utils/dataConnectMocks';

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

function renderSectionAdminPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/admin/section/${sectionId}`, state: { sectionName: 'Test Section', sectionType: 'MEMBERS' } }]}>
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

  it('shows the admin hub including Edit Section for a global admin', async () => {
    mockIsAdmin = true;

    renderSectionAdminPage();

    await waitFor(() => {
      expect(screen.getByText('Send Announcement')).toBeInTheDocument();
    });
    expect(screen.getByText('Edit Section')).toBeInTheDocument();
  });
});
