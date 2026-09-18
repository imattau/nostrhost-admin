import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  createBackup,
  deleteBackup,
  getRestorePoints,
  restoreBackup,
  setBackupPolicy,
} from '@/api/nativeBackups'
import { applyRollback, getStateStatus, planRollback, publishState } from '@/api/nativeState'

vi.mock('@/api/client', () => ({ request: vi.fn() }))

describe('Restic backup API', () => {
  it('lists restore points (snapshots)', async () => {
    vi.mocked(request).mockResolvedValueOnce({ snapshots: [] })

    await getRestorePoints()

    expect(request).toHaveBeenCalledWith('/package/backup/list', 'GET')
  })

  it('passes tag/host filters', async () => {
    vi.mocked(request).mockResolvedValueOnce({ snapshots: [] })

    await getRestorePoints('manual', 'box')

    expect(request).toHaveBeenCalledWith(
      '/package/backup/list?tag=manual&host=box',
      'GET',
    )
  })

  it('creates a snapshot via the signed chain', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await createBackup({ paths: ['/etc'] })

    expect(request).toHaveBeenCalledWith(
      '/package/backup/create',
      'POST',
      JSON.stringify({ paths: ['/etc'] }),
    )
  })

  it('restores a named snapshot', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await restoreBackup({ snapshot: 'abc123' })

    expect(request).toHaveBeenCalledWith(
      '/package/backup/restore',
      'POST',
      JSON.stringify({ snapshot: 'abc123' }),
    )
  })

  it('forgets a snapshot with prune', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await deleteBackup({ snapshot: 'abc123', prune: true })

    expect(request).toHaveBeenCalledWith(
      '/package/backup/delete',
      'POST',
      JSON.stringify({ snapshot: 'abc123', prune: true }),
    )
  })

  it('sets the retention policy and schedule', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await setBackupPolicy({ retention: { keep_last: 3 }, schedule_enabled: true })

    expect(request).toHaveBeenCalledWith(
      '/package/backup/policy',
      'POST',
      JSON.stringify({ retention: { keep_last: 3 }, schedule_enabled: true }),
    )
  })
})

describe('state / recovery API', () => {
  it('reads state status', async () => {
    vi.mocked(request).mockResolvedValueOnce({ revision: 'a' })

    await getStateStatus()

    expect(request).toHaveBeenCalledWith('/package/state/status', 'GET')
  })

  it('requests a rollback plan', async () => {
    vi.mocked(request).mockResolvedValueOnce({ steps: [] })

    await planRollback()

    expect(request).toHaveBeenCalledWith(
      '/package/state/rollback/plan',
      'POST',
      JSON.stringify({ from: '', to: '', restic_snapshot: '' }),
    )
  })

  it('applies a rollback plan through the signed chain', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await applyRollback({ steps: [], summary: {} } as never)

    expect(request).toHaveBeenCalledWith(
      '/package/state/rollback/apply',
      'POST',
      JSON.stringify({ plan: { steps: [], summary: {} } }),
    )
  })

  it('publishes the state repository', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'r' })

    await publishState(false)

    expect(request).toHaveBeenCalledWith(
      '/package/state/publish',
      'POST',
      JSON.stringify({ snapshot_only: false }),
    )
  })
})
