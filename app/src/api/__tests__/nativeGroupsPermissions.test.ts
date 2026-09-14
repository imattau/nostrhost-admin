import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import { getGroups } from '@/api/nativeGroupsPermissions'

vi.mock('@/api/client', () => ({
  request: vi.fn(),
}))

// Regression test for C2: user_group_list() returns `{"groups": {...}}`;
// getGroups() used to return that envelope unwrapped, so the view iterated
// Object.keys() and got a single bogus group literally named "groups".
describe('getGroups', () => {
  it('unwraps the {groups: ...} envelope the backend returns', async () => {
    const backendResponse = {
      groups: {
        admins: { members: ['alice'] },
        all_users: { members: ['alice', 'bob'] },
      },
    }
    vi.mocked(request).mockResolvedValueOnce(backendResponse)

    const groups = await getGroups()

    expect(Object.keys(groups)).toEqual(['admins', 'all_users'])
    expect(groups.admins.members).toEqual(['alice'])
    // The bug's exact symptom: a bogus "groups" key must never appear.
    expect(groups).not.toHaveProperty('groups')
  })
})
