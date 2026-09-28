/**
 * Tests for PresetProviderSeeder.run — seeds only the three built-in WH
 * providers (registry presets are excluded in this custom deployment) and
 * is insert-only: existing rows are never overwritten.
 */

import { setupTestDatabase } from '@test-helpers/db'
import { describe, expect, it } from 'vitest'

import { userProviderTable } from '@data/db/schemas/userProvider'
import { PresetProviderSeeder } from '@data/db/seeding/seeders/presetProviderSeeder'
import { generateOrderKeyBetween } from '@data/services/utils/orderKey'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

describe('PresetProviderSeeder.run', () => {
  const dbh = setupTestDatabase()

  it('seeds exactly the three built-in WH providers on an empty DB', async () => {
    const seed = new PresetProviderSeeder()
    seed.run(dbh.db)

    const rows = await dbh.db.select().from(userProviderTable)
    expect(rows.map((r) => r.providerId).sort()).toEqual(['wh-ai', 'wh-external', 'wh-internal'])
  })

  it('configures each with its OpenAI-compatible base URL and enabled state', async () => {
    const seed = new PresetProviderSeeder()
    seed.run(dbh.db)

    const rows = await dbh.db.select().from(userProviderTable)
    const byId = Object.fromEntries(rows.map((r) => [r.providerId, r]))
    expect(byId['wh-ai']?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(
      'https://gateway-a.example.com'
    )
    expect(byId['wh-external']?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(
      'https://gateway-b.example.com'
    )
    expect(byId['wh-internal']?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(
      'http://gateway-c.example.com'
    )
    for (const row of rows) {
      expect(row.presetProviderId).toBeNull()
      expect(row.defaultChatEndpoint).toBe(ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS)
      expect(row.isEnabled).toBe(true)
    }
  })

  it('does NOT seed any registry preset providers', async () => {
    const seed = new PresetProviderSeeder()
    seed.run(dbh.db)

    const rows = await dbh.db.select().from(userProviderTable)
    const ids = rows.map((r) => r.providerId)
    expect(ids).not.toContain('openai')
    expect(ids).not.toContain('anthropic')
    expect(ids).not.toContain('azure-openai')
    expect(ids).not.toContain('vertexai')
    expect(ids).not.toContain('aws-bedrock')
    expect(ids).not.toContain('cherryai')
  })

  it('preserves user edits when the provider already exists (insert-only)', async () => {
    await dbh.db
      .insert(userProviderTable)
      .values({ providerId: 'wh-ai', name: 'User-renamed', orderKey: generateOrderKeyBetween(null, null) })

    const seed = new PresetProviderSeeder()
    seed.run(dbh.db)

    const rows = await dbh.db.select().from(userProviderTable)
    expect(rows.find((r) => r.providerId === 'wh-ai')?.name).toBe('User-renamed')
    expect(rows.map((r) => r.providerId).sort()).toEqual(['wh-ai', 'wh-external', 'wh-internal'])
  })
})
