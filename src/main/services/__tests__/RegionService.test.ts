// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))

vi.mock('@logger', () => ({
  loggerService: { withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }
}))

vi.mock('electron', () => ({
  net: { fetch: netFetchMock }
}))

vi.mock('@application', () => ({
  application: {
    get: vi.fn(() => ({ appliedProxyKey: null })),
    getExisting: vi.fn()
  }
}))

import { regionService } from '../RegionService'

/**
 * WH enterprise: RegionService never performs the external ipinfo.io lookup —
 * it answers 'CN' unconditionally so mirror routing stays on domestic
 * endpoints and the intranet sees zero traffic.
 */
describe('RegionService (WH enterprise)', () => {
  it('reports CN without touching the network', async () => {
    await expect(regionService.getCountry()).resolves.toBe('CN')
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('treats the egress as China for mirror routing', async () => {
    await expect(regionService.isInChina()).resolves.toBe(true)
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('answers repeatedly without ever fetching', async () => {
    await regionService.getCountry()
    await regionService.getCountry()
    expect(netFetchMock).not.toHaveBeenCalled()
  })
})
