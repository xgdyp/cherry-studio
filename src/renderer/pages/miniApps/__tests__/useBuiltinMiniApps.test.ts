import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type * as MiniAppPresets from '@shared/data/presets/miniApps'

import { useBuiltinMiniApps } from '../useBuiltinMiniApps'

const mocks = vi.hoisted(() => ({ resourcesPath: '/opt/cherry/resources' }))

vi.mock('@data/hooks/useCache', () => ({ useCache: () => [mocks.resourcesPath] }))

// A NON-EMPTY catalog on purpose: with entries present the enterprise gate is
// the only thing that can produce an empty result, so a deleted gate fails.
vi.mock('@shared/data/presets/miniApps', async (importOriginal) => ({
  ...(await importOriginal<typeof MiniAppPresets>()),
  BUILTIN_MINI_APPS: [
    { appId: 'com.cherrystudio.miniapp.notes', name: { en: 'Notes', 'zh-CN': '笔记' }, icon: 'icon.webp' },
    { appId: 'com.cherrystudio.miniapp.draw', name: { en: 'Draw' }, icon: 'icon.webp' }
  ]
}))

/**
 * WH enterprise: the builtin catalog lists external chat sites the intranet
 * cannot reach — the hook must offer nothing, whatever is installed.
 */
describe('useBuiltinMiniApps (WH enterprise)', () => {
  it('offers nothing even with a non-empty catalog', () => {
    const { result } = renderHook(() => useBuiltinMiniApps([], 'zh-CN'))
    expect(result.current).toEqual([])
  })

  it('offers nothing regardless of installed presets', () => {
    const { result } = renderHook(() =>
      useBuiltinMiniApps([{ presetMiniAppId: 'com.cherrystudio.miniapp.draw' }, { presetMiniAppId: null }], 'en')
    )
    expect(result.current).toEqual([])
  })
})
