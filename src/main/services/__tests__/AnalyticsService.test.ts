import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseService } from '@main/core/lifecycle'
import { LATEST_PRIVACY_POLICY_VERSION } from '@shared/utils/constants'

/**
 * WH enterprise: usage telemetry stays off regardless of the stored privacy
 * consent — the service must never instantiate the analytics client, even
 * when both the data-collection switch and the policy version say yes.
 */

const { mockTrackAppLaunch, mockTrackTokenUsage, mockTrackAppUpdate, mockDestroy, MockAnalyticsClient, captured } =
  vi.hoisted(() => {
    const trackAppLaunch = vi.fn()
    const trackTokenUsage = vi.fn()
    const trackAppUpdate = vi.fn()
    const destroy = vi.fn()
    return {
      mockTrackAppLaunch: trackAppLaunch,
      mockTrackTokenUsage: trackTokenUsage,
      mockTrackAppUpdate: trackAppUpdate,
      mockDestroy: destroy,
      MockAnalyticsClient: vi.fn(function AnalyticsClientMock() {
        return {
          trackAppLaunch,
          trackTokenUsage,
          trackAppUpdate,
          destroy
        }
      }),
      captured: {
        prefHandlers: {},
        preferenceValues: {}
      }
    }
  })

vi.mock('@cherrystudio/analytics-client', () => ({
  AnalyticsClient: MockAnalyticsClient
}))

vi.mock('@main/utils/systemInfo', () => ({
  getClientId: vi.fn(() => 'test-client-id'),
  generateUserAgent: vi.fn(() => 'test-user-agent')
}))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory({
    PreferenceService: {
      subscribeChange: vi.fn((key: string, cb: (value: never) => void) => {
        captured.prefHandlers[key] = cb
        return () => {}
      }),
      get: vi.fn((key: string) => captured.preferenceValues[key])
    }
  })
})

import { AnalyticsService } from '../AnalyticsService'

function changePreference(key: string, value: boolean | string): void {
  captured.preferenceValues[key] = value
  captured.prefHandlers[key]?.(value)
}

beforeEach(() => {
  BaseService.resetInstances()
  for (const key of Object.keys(captured.prefHandlers)) {
    delete captured.prefHandlers[key]
  }
  captured.preferenceValues['app.privacy.data_collection.enabled'] = true
  captured.preferenceValues['app.privacy.policy_version'] = LATEST_PRIVACY_POLICY_VERSION
  mockTrackAppLaunch.mockReset()
  mockTrackTokenUsage.mockReset()
  mockTrackAppUpdate.mockReset()
  mockDestroy.mockReset()
  MockAnalyticsClient.mockClear()
})

describe('AnalyticsService (WH enterprise)', () => {
  it('never activates even with full consent', async () => {
    const service = new AnalyticsService()
    await service._doInit()

    expect(service.isActivated).toBe(false)
    expect(MockAnalyticsClient).not.toHaveBeenCalled()
    expect(mockTrackAppLaunch).not.toHaveBeenCalled()
  })

  it('stays off when consent flips at runtime', async () => {
    const service = new AnalyticsService()
    await service._doInit()

    changePreference('app.privacy.data_collection.enabled', false)
    changePreference('app.privacy.data_collection.enabled', true)
    changePreference('app.privacy.policy_version', LATEST_PRIVACY_POLICY_VERSION)

    await service.trackAppUpdate()
    expect(service.isActivated).toBe(false)
    expect(MockAnalyticsClient).not.toHaveBeenCalled()
    expect(mockTrackAppUpdate).not.toHaveBeenCalled()
  })

  it('drops token usage reporting', async () => {
    const service = new AnalyticsService()
    await service._doInit()

    service.trackTokenUsage({
      provider: 'test-provider',
      model: 'test-model',
      input_tokens: 3,
      output_tokens: 5,
      source: 'agent'
    })

    expect(mockTrackTokenUsage).not.toHaveBeenCalled()
  })
})
