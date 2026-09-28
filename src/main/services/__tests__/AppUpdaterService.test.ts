import type { UpdateInfo } from 'builder-util-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { netFetchMock, releaseNotesCheckMock, releaseNotesUpdaterInstances, trackAppUpdateMock } = vi.hoisted(() => ({
  netFetchMock: vi.fn(),
  releaseNotesCheckMock: vi.fn(),
  releaseNotesUpdaterInstances: [] as Array<Record<string, unknown>>,
  trackAppUpdateMock: vi.fn()
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    })
  }
}))

vi.mock('@data/PreferenceService', async () => {
  const { MockMainPreferenceServiceExport } = await import('@test-mocks/main/PreferenceService')
  return MockMainPreferenceServiceExport
})

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  const result = mockApplicationFactory()
  const originalGet = result.application.get.getMockImplementation()!
  result.application.get.mockImplementation((name: string) => {
    if (name === 'AnalyticsService') {
      return { trackAppUpdate: trackAppUpdateMock }
    }
    return originalGet(name)
  })
  return result
})

vi.mock('@main/core/lifecycle', () => {
  class MockBaseService {}
  return {
    BaseService: MockBaseService,
    Injectable: () => (target: unknown) => target,
    ServicePhase: () => (target: unknown) => target,
    DependsOn: () => (target: unknown) => target,
    Phase: { Background: 'background', WhenReady: 'whenReady', BeforeReady: 'beforeReady' }
  }
})

vi.mock('@main/core/platform', () => ({
  isWin: false
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0')
  },
  net: { fetch: netFetchMock }
}))

vi.mock('electron-updater', () => {
  class MockAppUpdater {
    allowDowngrade = false
    autoDownload = true
    autoInstallOnAppQuit = true
    channel = ''
    forceDevUpdateConfig = false
    logger: unknown = null
    setFeedURL = vi.fn()

    constructor(public options?: unknown) {
      releaseNotesUpdaterInstances.push(this as unknown as Record<string, unknown>)
    }

    checkForUpdates() {
      return releaseNotesCheckMock()
    }
  }

  return {
    autoUpdater: {
      logger: null,
      forceDevUpdateConfig: false,
      autoDownload: false,
      autoInstallOnAppQuit: false,
      on: vi.fn(),
      removeListener: vi.fn(),
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      channel: '',
      allowDowngrade: false,
      disableDifferentialDownload: false,
      currentVersion: '1.0.0'
    },
    AppUpdater: MockAppUpdater,
    Logger: vi.fn(),
    NsisUpdater: vi.fn()
  }
})

import { MockMainPreferenceServiceUtils } from '@test-mocks/main/PreferenceService'
import { app, net } from 'electron'
import { autoUpdater } from 'electron-updater'

import { application } from '@application'

import { AppUpdaterService } from '../AppUpdaterService'

// Must mirror the private feed constants in AppUpdaterService.ts.
const UPDATE_FEED_BASES = ['http://updates-a.example.com:9000', 'http://updates-b.example.com:9000']
const UPDATE_FEED_URL = `${UPDATE_FEED_BASES[0]}/cherrydeploy-updates/win/`

/** Probe responses succeed with HTTP 200 by default; override for offline cases. */
function mockReachableProbes() {
  netFetchMock.mockImplementation((url: unknown) =>
    Promise.resolve(new Response(null, { status: String(url).includes('latest.yml') ? 200 : 404 }))
  )
}

describe('AppUpdaterService', () => {
  let appUpdater: AppUpdaterService

  beforeEach(() => {
    vi.clearAllMocks()
    MockMainPreferenceServiceUtils.resetMocks()
    vi.mocked(app.getVersion).mockReturnValue('1.0.0')
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(null)
    netFetchMock.mockReset()
    releaseNotesCheckMock.mockReset().mockResolvedValue(null)
    releaseNotesUpdaterInstances.length = 0
    autoUpdater.channel = ''
    autoUpdater.allowDowngrade = false
    autoUpdater.disableDifferentialDownload = false
    appUpdater = new AppUpdaterService()
  })

  describe('MinIO update feed', () => {
    it('configures the generic MinIO feed on the latest channel', async () => {
      mockReachableProbes()
      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: UPDATE_FEED_URL })
      expect(autoUpdater.channel).toBe('latest')
      expect(autoUpdater.allowDowngrade).toBe(false)
      expect(autoUpdater.disableDifferentialDownload).toBe(true)
    })

    it('falls back to the second MinIO base when the first zone is unreachable', async () => {
      netFetchMock.mockImplementation((url: unknown) =>
        Promise.resolve(new Response(null, { status: String(url).includes(UPDATE_FEED_BASES[0]) ? 503 : 200 }))
      )

      await (appUpdater as any).configureUpdaterForCheck()

      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: `${UPDATE_FEED_BASES[1]}/cherrydeploy-updates/win/`
      })
    })

    it('applies the feed before checking for updates', async () => {
      mockReachableProbes()
      vi.mocked(autoUpdater.checkForUpdates).mockImplementation(async () => {
        expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: UPDATE_FEED_URL })
        expect(autoUpdater.channel).toBe('latest')
        return null
      })

      await appUpdater.checkForUpdates()

      expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
    })

    it('fetches and validates release history from the MinIO bucket', async () => {
      const releaseNotes = '<!--LANG:en-->Remote notes<!--LANG:zh-CN-->远端说明<!--LANG:END-->'
      const history = [{ releaseNotes, version: '1.1.0' }]
      netFetchMock.mockResolvedValue(new Response(JSON.stringify(history)))

      await expect(appUpdater.getReleaseHistory()).resolves.toEqual(history)

      expect(net.fetch).toHaveBeenCalledWith(
        `${UPDATE_FEED_URL}release-history.json`,
        expect.objectContaining({
          redirect: 'follow',
          signal: expect.any(AbortSignal)
        })
      )
      expect(releaseNotesUpdaterInstances).toHaveLength(1)
    })

    it('targets the same MinIO feed on the release-notes updater instance', async () => {
      releaseNotesCheckMock.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: { releaseNotes: 'New release notes', version: '1.1.0' }
      })
      // Probes succeed; only the release-history fetch goes offline.
      netFetchMock.mockImplementation((url: unknown) =>
        String(url).includes('latest.yml')
          ? Promise.resolve(new Response(null, { status: 200 }))
          : Promise.reject(new Error('offline'))
      )

      await expect(appUpdater.getReleaseHistory()).resolves.toEqual([
        { releaseNotes: 'New release notes', version: '1.1.0' }
      ])

      const notesUpdater = releaseNotesUpdaterInstances[0] as unknown as {
        setFeedURL: ReturnType<typeof vi.fn>
        channel: string
      }
      expect(notesUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: UPDATE_FEED_URL })
      expect(notesUpdater.channel).toBe('latest')
    })

    it('keeps newer updater notes when release history is unavailable', async () => {
      // Probes succeed; only the release-history fetch goes offline.
      netFetchMock.mockImplementation((url: unknown) =>
        String(url).includes('latest.yml')
          ? Promise.resolve(new Response(null, { status: 200 }))
          : Promise.reject(new Error('offline'))
      )
      releaseNotesCheckMock.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: { releaseNotes: 'New release notes', version: '1.1.0' }
      })

      await expect(appUpdater.getReleaseHistory()).resolves.toEqual([
        { releaseNotes: 'New release notes', version: '1.1.0' }
      ])
    })

    it('falls back to no history when the bucket response is invalid', async () => {
      netFetchMock.mockResolvedValue(new Response(JSON.stringify([{ releaseNotes: 'English only', version: '1.1.0' }])))

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
    })

    it('falls back to no history when the bucket request fails', async () => {
      // Probes succeed; only the release-history fetch goes offline.
      netFetchMock.mockImplementation((url: unknown) =>
        String(url).includes('latest.yml')
          ? Promise.resolve(new Response(null, { status: 200 }))
          : Promise.reject(new Error('offline'))
      )

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
    })

    it('rejects release history larger than the response limit before reading it', async () => {
      const text = vi.fn()
      netFetchMock.mockResolvedValue({
        headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
        ok: true,
        status: 200,
        text
      })

      await expect(appUpdater.getReleaseHistory()).resolves.toBeNull()
      expect(text).not.toHaveBeenCalled()
    })
  })

  describe('processReleaseInfo', () => {
    it('localizes marked release notes', () => {
      MockMainPreferenceServiceUtils.setPreferenceValue('app.language', 'zh-CN')
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: '<!--LANG:en-->English notes<!--LANG:zh-CN-->中文说明<!--LANG:END-->'
      } as UpdateInfo

      const result = (appUpdater as any).processReleaseInfo(releaseInfo)

      expect(result.releaseNotes).toBe('中文说明')
    })

    it('leaves unmarked release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'Simple release notes'
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBe('Simple release notes')
    })

    it('leaves array release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: [
          { version: '1.0.0', note: 'Note 1' },
          { version: '1.0.1', note: 'Note 2' }
        ]
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toEqual(releaseInfo.releaseNotes)
    })

    it('leaves null release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: null
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBeNull()
    })

    it('leaves marked release notes unchanged when language lookup fails', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: '<!--LANG:en-->English notes<!--LANG:zh-CN-->中文说明<!--LANG:END-->'
      } as UpdateInfo
      vi.mocked(application.get('PreferenceService').get).mockImplementationOnce(() => {
        throw new Error('Test error')
      })

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBe(releaseInfo.releaseNotes)
    })
  })
})
