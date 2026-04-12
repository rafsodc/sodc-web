import { describe, it, expect } from 'vitest';
import {
  isMembersSection,
  getAllUsersFromSection,
  getMemberGroups,
  canUserAccessSection,
  canUserSubscribe,
  isUserMember,
} from '../sectionHelpers';
import type { SectionType, MembershipStatus } from '@dataconnect/generated';

describe('sectionHelpers', () => {
  describe('isMembersSection', () => {
    it('should return true for MEMBERS section', () => {
      expect(isMembersSection({ type: 'MEMBERS' as SectionType })).toBe(true);
    });

    it('should return false for EVENTS section', () => {
      expect(isMembersSection({ type: 'EVENTS' as SectionType })).toBe(false);
    });
  });

  describe('getAllUsersFromSection', () => {
    it('should return empty array when sectionData is null', () => {
      const result = getAllUsersFromSection(null);
      expect(result).toEqual([]);
    });

    it('should return empty array when sectionData is undefined', () => {
      const result = getAllUsersFromSection(undefined as any);
      expect(result).toEqual([]);
    });

    it('should extract and deduplicate users from MEMBER purpose links', () => {
      const sectionData = {
        purposeLinks: [
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR' as MembershipStatus,
                  },
                },
                {
                  user: {
                    id: 'user-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    membershipStatus: 'RESERVE' as MembershipStatus,
                  },
                },
              ],
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'group-2',
              name: 'Group 2',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR' as MembershipStatus,
                  },
                },
                {
                  user: {
                    id: 'user-3',
                    firstName: 'Bob',
                    lastName: 'Johnson',
                    email: 'bob@example.com',
                    membershipStatus: 'REGULAR' as MembershipStatus,
                  },
                },
              ],
            },
          },
        ],
      };

      const result = getAllUsersFromSection(sectionData as any);
      expect(result).toHaveLength(3);
      expect(result.map((u) => u.userId)).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should use ACCESS purpose when no MEMBER links exist', () => {
      const sectionData = {
        purposeLinks: [
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group 1',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR' as MembershipStatus,
                  },
                },
              ],
            },
          },
        ],
      };

      const result = getAllUsersFromSection(sectionData as any);
      expect(result).toHaveLength(1);
    });

    it('should prefer MEMBER links over ACCESS for rollup', () => {
      const sectionData = {
        purposeLinks: [
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'member-group-1',
              name: 'Member Group',
              users: [
                {
                  user: {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    membershipStatus: 'REGULAR' as MembershipStatus,
                  },
                },
              ],
            },
          },
          {
            purpose: 'ACCESS',
            userGroup: {
              id: 'view-group-1',
              name: 'View Group',
              users: [
                {
                  user: {
                    id: 'user-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    membershipStatus: 'RESERVE' as MembershipStatus,
                  },
                },
              ],
            },
          },
        ],
      };

      const result = getAllUsersFromSection(sectionData as any);
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
    });
  });

  describe('getMemberGroups', () => {
    it('should return empty array when sectionData is null', () => {
      const result = getMemberGroups(null);
      expect(result).toEqual([]);
    });

    it('should extract MEMBER purpose groups', () => {
      const sectionData = {
        purposeLinks: [
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'group-1',
              name: 'Group 1',
              description: 'Description 1',
              subscribable: true,
            },
          },
          {
            purpose: 'MEMBER',
            userGroup: {
              id: 'group-2',
              name: 'Group 2',
              description: null,
              subscribable: false,
            },
          },
        ],
      };

      const result = getMemberGroups(sectionData as any);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'group-1',
        name: 'Group 1',
        description: 'Description 1',
        subscribable: true,
      });
    });

    it('should fall back to ACCESS groups when no MEMBER links', () => {
      const sectionData = {
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
      };

      const result = getMemberGroups(sectionData as any);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('view-group-1');
    });
  });

  describe('canUserAccessSection', () => {
    it('should return true when user matches ACCESS purpose', () => {
      const userUserGroupIds = ['group-1', 'group-2'];
      const links = [
        { purpose: 'ACCESS', userGroup: { id: 'group-2' } },
        { purpose: 'MEMBER', userGroup: { id: 'other' } },
      ];
      expect(canUserAccessSection(userUserGroupIds, links)).toBe(true);
    });

    it('should return true when user matches MODERATOR purpose', () => {
      const userUserGroupIds = ['mod-1'];
      const links = [{ purpose: 'MODERATOR', userGroup: { id: 'mod-1' } }];
      expect(canUserAccessSection(userUserGroupIds, links)).toBe(true);
    });

    it('should return false when user has no ACCESS or MODERATOR match', () => {
      const userUserGroupIds = ['group-1', 'group-2'];
      const links = [
        { purpose: 'ACCESS', userGroup: { id: 'group-3' } },
        { purpose: 'MEMBER', userGroup: { id: 'group-1' } },
      ];
      expect(canUserAccessSection(userUserGroupIds, links)).toBe(false);
    });

    it('should return false when user has no user groups', () => {
      const userUserGroupIds: string[] = [];
      const links = [{ purpose: 'ACCESS', userGroup: { id: 'group-1' } }];
      expect(canUserAccessSection(userUserGroupIds, links)).toBe(false);
    });

    it('should return false when section has no purpose links', () => {
      const userUserGroupIds = ['group-1'];
      expect(canUserAccessSection(userUserGroupIds, [])).toBe(false);
    });
  });

  describe('isUserMember', () => {
    it('should return true when user is a member of at least one member group', () => {
      const userAccessGroupIds = ['group-1', 'member-group-1'];
      const memberAccessGroups = [
        { id: 'member-group-1' },
        { id: 'member-group-2' },
      ];
      expect(isUserMember(userAccessGroupIds, memberAccessGroups)).toBe(true);
    });

    it('should return false when user is not a member of any member group', () => {
      const userAccessGroupIds = ['group-1', 'group-2'];
      const memberAccessGroups = [
        { id: 'member-group-1' },
        { id: 'member-group-2' },
      ];
      expect(isUserMember(userAccessGroupIds, memberAccessGroups)).toBe(false);
    });

    it('should return false when user has no user groups', () => {
      const userUserGroupIds: string[] = [];
      const memberGroups = [{ id: 'member-group-1' }];
      expect(isUserMember(userUserGroupIds, memberGroups)).toBe(false);
    });

    it('should return false when there are no member groups', () => {
      const userAccessGroupIds = ['group-1'];
      const memberAccessGroups: Array<{ id: string }> = [];
      expect(isUserMember(userAccessGroupIds, memberAccessGroups)).toBe(false);
    });
  });

  describe('canUserSubscribe', () => {
    it('should return true when user has ACCESS, not a member, and group is subscribable', () => {
      const userId = 'user-1';
      const userAccessGroupIds = ['view-group-1'];
      const purposeLinks = [{ purpose: 'ACCESS', userGroup: { id: 'view-group-1' } }];
      const memberAccessGroups = [
        { id: 'member-group-1', subscribable: true },
      ];
      const userMemberAccessGroupIds: string[] = [];

      expect(
        canUserSubscribe(
          userId,
          userAccessGroupIds,
          purposeLinks,
          memberAccessGroups,
          userMemberAccessGroupIds
        )
      ).toBe(true);
    });

    it('should return false when user does not have section access', () => {
      const userId = 'user-1';
      const userAccessGroupIds = ['other-group'];
      const purposeLinks = [{ purpose: 'ACCESS', userGroup: { id: 'view-group-1' } }];
      const memberAccessGroups = [
        { id: 'member-group-1', subscribable: true },
      ];
      const userMemberAccessGroupIds: string[] = [];

      expect(
        canUserSubscribe(
          userId,
          userAccessGroupIds,
          purposeLinks,
          memberAccessGroups,
          userMemberAccessGroupIds
        )
      ).toBe(false);
    });

    it('should return false when user is already a member', () => {
      const userId = 'user-1';
      const userAccessGroupIds = ['view-group-1', 'member-group-1'];
      const purposeLinks = [{ purpose: 'ACCESS', userGroup: { id: 'view-group-1' } }];
      const memberAccessGroups = [
        { id: 'member-group-1', subscribable: true },
      ];
      const userMemberAccessGroupIds = ['member-group-1'];

      expect(
        canUserSubscribe(
          userId,
          userAccessGroupIds,
          purposeLinks,
          memberAccessGroups,
          userMemberAccessGroupIds
        )
      ).toBe(false);
    });

    it('should return false when no member group is subscribable', () => {
      const userId = 'user-1';
      const userAccessGroupIds = ['view-group-1'];
      const purposeLinks = [{ purpose: 'ACCESS', userGroup: { id: 'view-group-1' } }];
      const memberAccessGroups = [
        { id: 'member-group-1', subscribable: false },
      ];
      const userMemberAccessGroupIds: string[] = [];

      expect(
        canUserSubscribe(
          userId,
          userAccessGroupIds,
          purposeLinks,
          memberAccessGroups,
          userMemberAccessGroupIds
        )
      ).toBe(false);
    });

    it('should return true when at least one subscribable group exists and user is not a member', () => {
      const userId = 'user-1';
      const userAccessGroupIds = ['view-group-1'];
      const purposeLinks = [{ purpose: 'ACCESS', userGroup: { id: 'view-group-1' } }];
      const memberAccessGroups = [
        { id: 'member-group-1', subscribable: false },
        { id: 'member-group-2', subscribable: true },
      ];
      const userMemberAccessGroupIds: string[] = [];

      expect(
        canUserSubscribe(
          userId,
          userAccessGroupIds,
          purposeLinks,
          memberAccessGroups,
          userMemberAccessGroupIds
        )
      ).toBe(true);
    });
  });
});
