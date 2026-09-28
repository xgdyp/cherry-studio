import { setupTestDatabase } from '@test-helpers/db'
import { mockMainLoggerService } from '@test-mocks/MainLoggerService'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { preferenceTable } from '@data/db/schemas/preference'
import { userModelTable } from '@data/db/schemas/userModel'
import { userProviderTable } from '@data/db/schemas/userProvider'
import {
  CherryAiDefaultModelSeeder,
  DEFAULT_MODEL_PREFERENCE_KEYS
} from '@data/db/seeding/seeders/cherryaiDefaultModelSeeder'
import { generateOrderKeyBetween } from '@data/services/utils/orderKey'
import { CHERRYAI_DEFAULT_UNIQUE_MODEL_ID, CHERRYAI_PROVIDER_ID } from '@shared/data/presets/cherryai'
import {
  WH_DEFAULT_MODEL_ID,
  WH_DEFAULT_PROVIDER_ID,
  WH_DEFAULT_PROVIDER_NAME,
  WH_DEFAULT_UNIQUE_MODEL_ID,
  WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID,
  WH_INTERNAL_PROVIDER_ID,
  WH_INTERNAL_PROVIDER_NAME,
  WH_INTERNAL_QWEN_UNIQUE_MODEL_ID,
  WH_QWEN_MODEL_ID,
  WH_QWEN_UNIQUE_MODEL_ID
} from '@shared/data/presets/whDefaultModel'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

describe('CherryAiDefaultModelSeeder', () => {
  const dbh = setupTestDatabase()

  beforeEach(() => {
    mockMainLoggerService.warn.mockClear()
    vi.stubEnv('WH_API_KEY', 'sk-test')
    vi.stubEnv('WH_INTERNAL_API_KEY', 'sk-internal-test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function readPreferenceValue(key: string) {
    const [preference] = await dbh.db
      .select()
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, 'default'), eq(preferenceTable.key, key)))
      .limit(1)
    return preference?.value
  }

  async function expectSeededDefaultModelPreferences() {
    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBe(WH_DEFAULT_UNIQUE_MODEL_ID)
    }
  }

  it('does not seed the upstream CherryAI provider or its Qwen model', async () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)

    const providers = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, CHERRYAI_PROVIDER_ID))
    const models = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, CHERRYAI_DEFAULT_UNIQUE_MODEL_ID))

    expect(providers).toHaveLength(0)
    expect(models).toHaveLength(0)
    await expectSeededDefaultModelPreferences()
    expect(mockMainLoggerService.warn).toHaveBeenCalledWith('Self-healed missing default model preference', {
      key: 'chat.default_model_id',
      value: WH_DEFAULT_UNIQUE_MODEL_ID
    })
    expect(await readPreferenceValue('topic.naming.model_id')).toBeUndefined()
  })

  it('seeds the WH default model and points default model preferences at it', async () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)

    const [provider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, WH_DEFAULT_PROVIDER_ID))
      .limit(1)
    const [model] = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, WH_DEFAULT_UNIQUE_MODEL_ID))
      .limit(1)

    expect(provider?.name).toBe(WH_DEFAULT_PROVIDER_NAME)
    expect(provider?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(
      'https://gateway-a.example.com'
    )
    expect(provider?.isEnabled).toBe(true)
    expect(provider?.apiKeys).toHaveLength(1)
    expect(provider?.apiKeys?.[0]).toMatchObject({ isEnabled: true })
    expect(model).toMatchObject({
      id: WH_DEFAULT_UNIQUE_MODEL_ID,
      providerId: WH_DEFAULT_PROVIDER_ID,
      modelId: WH_DEFAULT_MODEL_ID,
      capabilities: ['reasoning', 'function-call'],
      reasoning: {},
      contextWindow: 393216,
      maxInputTokens: 30000,
      maxOutputTokens: 256000,
      isEnabled: true,
      isHidden: false
    })
    await expectSeededDefaultModelPreferences()
  })

  it('seeds the WH Qwen model with vision input and 256k limits', async () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)

    const [model] = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, WH_QWEN_UNIQUE_MODEL_ID))
      .limit(1)

    expect(model).toMatchObject({
      id: WH_QWEN_UNIQUE_MODEL_ID,
      providerId: WH_DEFAULT_PROVIDER_ID,
      modelId: WH_QWEN_MODEL_ID,
      name: 'Qwen3.8 27B',
      capabilities: ['image-recognition'],
      inputModalities: ['text', 'image'],
      outputModalities: ['text'],
      contextWindow: 256000,
      maxInputTokens: 30000,
      maxOutputTokens: 256000,
      isEnabled: true
    })
  })

  it('seeds the WH internal provider with the same two models and a corporate key', async () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)

    const [provider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, WH_INTERNAL_PROVIDER_ID))
      .limit(1)
    const models = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.providerId, WH_INTERNAL_PROVIDER_ID))

    expect(provider?.name).toBe(WH_INTERNAL_PROVIDER_NAME)
    expect(provider?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(
      'http://gateway-c.example.com'
    )
    expect(provider?.isEnabled).toBe(true)
    expect(provider?.apiKeys).toHaveLength(1)
    expect(provider?.apiKeys?.[0]?.key).toMatch(/^sk-/)
    expect(provider?.apiKeys?.[0]).toMatchObject({ label: 'Default', isEnabled: true })

    expect(models.map((m) => m.modelId).sort()).toEqual(['DeepSeek-V4-Flash', 'Qwen3.8-27B'])
    const deepseek = models.find((m) => m.modelId === 'DeepSeek-V4-Flash')
    const qwen = models.find((m) => m.modelId === 'Qwen3.8-27B')
    expect(deepseek).toMatchObject({
      id: WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID,
      contextWindow: 393216,
      maxInputTokens: 30000,
      isEnabled: true
    })
    expect(qwen).toMatchObject({
      id: WH_INTERNAL_QWEN_UNIQUE_MODEL_ID,
      inputModalities: ['text', 'image'],
      contextWindow: 256000,
      maxInputTokens: 30000,
      isEnabled: true
    })
  })

  it('does not overwrite existing non-empty default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values([
      {
        scope: 'default',
        key: 'chat.default_model_id',
        value: 'openai::gpt-4o'
      },
      {
        scope: 'default',
        key: 'feature.quick_assistant.model_id',
        value: 'anthropic::claude-3-haiku'
      },
      {
        scope: 'default',
        key: 'feature.translate.model_id',
        value: 'google::gemini-2.5-flash'
      }
    ])

    new CherryAiDefaultModelSeeder().run(dbh.db)

    expect(await readPreferenceValue('chat.default_model_id')).toBe('openai::gpt-4o')
    expect(await readPreferenceValue('feature.quick_assistant.model_id')).toBe('anthropic::claude-3-haiku')
    expect(await readPreferenceValue('feature.translate.model_id')).toBe('google::gemini-2.5-flash')
  })

  it('preserves existing null default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values(
      DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
        scope: 'default',
        key,
        value: null
      }))
    )

    new CherryAiDefaultModelSeeder().run(dbh.db)

    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBeNull()
    }
  })

  it('preserves existing empty default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values(
      DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
        scope: 'default',
        key,
        value: ''
      }))
    )

    new CherryAiDefaultModelSeeder().run(dbh.db)

    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBe('')
    }
  })

  it('leaves an existing CherryAI provider row alone without adding its model', async () => {
    await dbh.db.insert(userProviderTable).values({
      providerId: CHERRYAI_PROVIDER_ID,
      presetProviderId: CHERRYAI_PROVIDER_ID,
      name: 'Renamed CherryAI',
      orderKey: generateOrderKeyBetween(null, null)
    })

    new CherryAiDefaultModelSeeder().run(dbh.db)

    const [provider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, CHERRYAI_PROVIDER_ID))
      .limit(1)
    const models = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, CHERRYAI_DEFAULT_UNIQUE_MODEL_ID))

    expect(provider?.name).toBe('Renamed CherryAI')
    expect(models).toHaveLength(0)
  })
})
