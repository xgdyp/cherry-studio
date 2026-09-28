import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LATEST_PRIVACY_POLICY_VERSION } from '@shared/utils/constants'

const { initMock } = vi.hoisted(() => ({ initMock: vi.fn() }))

// `@sentry/electron/main` is externalized, so the real module cannot load under
// Vitest (it imports Electron natively).
vi.mock('@sentry/electron/main', () => ({ init: initMock }))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory()
})

import { initSentry } from '../sentry'

/**
 * WH enterprise: crash reporting goes nowhere — initSentry must not install
 * the SDK at all, regardless of build mode or stored consent.
 */
describe('Sentry (WH enterprise)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('DEV', false)
    vi.stubGlobal('__APP_EDITION__', 'global')
  })

  it('never initializes the SDK in a production build', () => {
    initSentry()
    expect(initMock).not.toHaveBeenCalled()
  })

  it('never initializes even with full reporting consent', async () => {
    const { application } = await import('@application')
    const preferences = {
      'app.privacy.data_collection.enabled': true,
      'app.privacy.policy_version': LATEST_PRIVACY_POLICY_VERSION
    }
    vi.mocked(application.getExisting).mockReturnValue({
      isReady: true,
      get: (key: string) => preferences[key]
    } as never)

    initSentry()
    expect(initMock).not.toHaveBeenCalled()
  })
})
