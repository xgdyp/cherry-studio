import { randomUUID } from 'node:crypto'

import { and, eq, inArray } from 'drizzle-orm'

import { ENDPOINT_TYPE } from '@cherrystudio/provider-registry'
import { preferenceTable } from '@data/db/schemas/preference'
import type { InsertUserModelRow } from '@data/db/schemas/userModel'
import { userModelTable } from '@data/db/schemas/userModel'
import type { InsertUserProviderRow } from '@data/db/schemas/userProvider'
import { providerService } from '@data/services/ProviderService'
import { insertManyWithOrderKey } from '@data/services/utils/orderKey'
import { loggerService } from '@logger'
import {
  CHERRYAI_API_BASE_URL,
  CHERRYAI_DEFAULT_MODEL_GROUP,
  CHERRYAI_DEFAULT_MODEL_ID,
  CHERRYAI_DEFAULT_MODEL_NAME,
  CHERRYAI_DEFAULT_UNIQUE_MODEL_ID,
  CHERRYAI_PROVIDER_ID,
  CHERRYAI_PROVIDER_NAME
} from '@shared/data/presets/cherryai'
import {
  WH_DEFAULT_MODEL_GROUP,
  WH_DEFAULT_MODEL_ID,
  WH_DEFAULT_MODEL_NAME,
  WH_DEFAULT_PROVIDER_BASE_URL,
  WH_DEFAULT_PROVIDER_ID,
  WH_DEFAULT_PROVIDER_NAME,
  WH_DEFAULT_UNIQUE_MODEL_ID,
  WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID,
  WH_INTERNAL_PROVIDER_BASE_URL,
  WH_INTERNAL_PROVIDER_ID,
  WH_INTERNAL_PROVIDER_NAME,
  WH_INTERNAL_QWEN_UNIQUE_MODEL_ID,
  WH_QWEN_MODEL_GROUP,
  WH_QWEN_MODEL_ID,
  WH_QWEN_MODEL_NAME,
  WH_QWEN_UNIQUE_MODEL_ID
} from '@shared/data/presets/whDefaultModel'
import { MODALITY, MODEL_CAPABILITY, type ModelCapability } from '@shared/data/types/model'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

const logger = loggerService.withContext('CherryAiDefaultModelSeeder')

function getWhApiKeys() {
  const key = process.env.WH_API_KEY?.trim()
  return key ? [{ id: randomUUID(), key, label: 'Default', isEnabled: true }] : []
}

function getWhInternalApiKeys() {
  const key = process.env.WH_INTERNAL_API_KEY?.trim()
  return key ? [{ id: randomUUID(), key, label: 'Default', isEnabled: true }] : []
}

const DEFAULT_MODEL_PREFERENCE_SCOPE = 'default' as const
export const DEFAULT_MODEL_PREFERENCE_KEYS = [
  'chat.default_model_id',
  'feature.quick_assistant.model_id',
  'feature.translate.model_id'
] as const

type TxLike = Pick<DbType, 'select' | 'insert' | 'update'>
type CherryAiProviderRow = Omit<InsertUserProviderRow, 'orderKey'>
type CherryAiDefaultModelRow = Omit<InsertUserModelRow, 'orderKey'>
type DefaultModelPreferenceRow = {
  scope: typeof DEFAULT_MODEL_PREFERENCE_SCOPE
  key: (typeof DEFAULT_MODEL_PREFERENCE_KEYS)[number]
  value: typeof WH_DEFAULT_UNIQUE_MODEL_ID
}

function createCherryAiProviderRow(): CherryAiProviderRow {
  return {
    providerId: CHERRYAI_PROVIDER_ID,
    presetProviderId: CHERRYAI_PROVIDER_ID,
    name: CHERRYAI_PROVIDER_NAME,
    endpointConfigs: {
      [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: {
        baseUrl: CHERRYAI_API_BASE_URL
      }
    },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    authConfig: null,
    providerSettings: null,
    isEnabled: true
  }
}

function createCherryAiDefaultModelRow(): CherryAiDefaultModelRow {
  return {
    id: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID,
    providerId: CHERRYAI_PROVIDER_ID,
    modelId: CHERRYAI_DEFAULT_MODEL_ID,
    presetModelId: null,
    name: CHERRYAI_DEFAULT_MODEL_NAME,
    description: null,
    group: CHERRYAI_DEFAULT_MODEL_GROUP,
    capabilities: [] as ModelCapability[],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null
  }
}

// Exported solely for v1->v2 migration reuse; make private when migration support is dropped.
export function ensureCherryAiDefaultProviderAndModelTx(tx: TxLike): void {
  const insertedProviderCount = providerService.batchUpsertTx(tx, [createCherryAiProviderRow()])
  if (insertedProviderCount > 0) {
    logger.warn('Self-healed missing CherryAI default provider', { providerId: CHERRYAI_PROVIDER_ID })
  }

  const [existing] = tx
    .select({ id: userModelTable.id })
    .from(userModelTable)
    .where(eq(userModelTable.id, CHERRYAI_DEFAULT_UNIQUE_MODEL_ID))
    .limit(1)
    .all()

  if (existing) return

  logger.warn('Self-healed missing CherryAI default model', { modelId: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID })
  insertManyWithOrderKey(tx, userModelTable, [createCherryAiDefaultModelRow()], {
    pkColumn: userModelTable.id,
    scope: eq(userModelTable.providerId, CHERRYAI_PROVIDER_ID)
  })
}

function createWhDefaultModelRow(providerId: string, uniqueModelId: string): CherryAiDefaultModelRow {
  return {
    id: uniqueModelId,
    providerId,
    modelId: WH_DEFAULT_MODEL_ID,
    presetModelId: null,
    name: WH_DEFAULT_MODEL_NAME,
    description: null,
    group: WH_DEFAULT_MODEL_GROUP,
    capabilities: [MODEL_CAPABILITY.REASONING, MODEL_CAPABILITY.FUNCTION_CALL] as ModelCapability[],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    // pi/dsh agent runtimes require a known context window (compaction/overflow
    // recovery); null would hide this model from their pickers.
    contextWindow: 393216,
    maxInputTokens: 30000,
    maxOutputTokens: 256000,
    supportsStreaming: true,
    reasoning: {},
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null
  }
}

function createWhQwenModelRow(providerId: string, uniqueModelId: string): CherryAiDefaultModelRow {
  return {
    id: uniqueModelId,
    providerId,
    modelId: WH_QWEN_MODEL_ID,
    presetModelId: null,
    name: WH_QWEN_MODEL_NAME,
    description: null,
    group: WH_QWEN_MODEL_GROUP,
    capabilities: [MODEL_CAPABILITY.IMAGE_RECOGNITION] as ModelCapability[],
    inputModalities: [MODALITY.TEXT, MODALITY.IMAGE],
    outputModalities: [MODALITY.TEXT],
    endpointTypes: null,
    contextWindow: 256000,
    maxInputTokens: 30000,
    maxOutputTokens: 256000,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null
  }
}

/**
 * Ensure the built-in WH gateway models exist. Provider rows are inserted
 * here (insert-only) because this seeder runs before PresetProviderSeeder,
 * and user_model has an FK to user_provider. The rows must be complete:
 * PresetProviderSeeder's insert-only pass cannot fill in fields later.
 */
function ensureWhDefaultModelTx(tx: TxLike): void {
  providerService.batchUpsertTx(tx, [
    {
      providerId: WH_DEFAULT_PROVIDER_ID,
      presetProviderId: null,
      name: WH_DEFAULT_PROVIDER_NAME,
      endpointConfigs: {
        [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: { baseUrl: WH_DEFAULT_PROVIDER_BASE_URL }
      },
      defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
      apiKeys: getWhApiKeys(),
      isEnabled: true
    },
    {
      providerId: WH_INTERNAL_PROVIDER_ID,
      presetProviderId: null,
      name: WH_INTERNAL_PROVIDER_NAME,
      endpointConfigs: {
        [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: { baseUrl: WH_INTERNAL_PROVIDER_BASE_URL }
      },
      defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
      apiKeys: getWhInternalApiKeys(),
      isEnabled: true
    }
  ])

  const existing = new Set(
    tx
      .select({ id: userModelTable.id })
      .from(userModelTable)
      .where(inArray(userModelTable.providerId, [WH_DEFAULT_PROVIDER_ID, WH_INTERNAL_PROVIDER_ID]))
      .all()
      .map((row) => row.id)
  )

  const rows = [
    createWhDefaultModelRow(WH_DEFAULT_PROVIDER_ID, WH_DEFAULT_UNIQUE_MODEL_ID),
    createWhQwenModelRow(WH_DEFAULT_PROVIDER_ID, WH_QWEN_UNIQUE_MODEL_ID),
    createWhDefaultModelRow(WH_INTERNAL_PROVIDER_ID, WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID),
    createWhQwenModelRow(WH_INTERNAL_PROVIDER_ID, WH_INTERNAL_QWEN_UNIQUE_MODEL_ID)
  ].filter((row) => !existing.has(row.id))

  if (rows.length === 0) return

  insertManyWithOrderKey(tx, userModelTable, rows, {
    pkColumn: userModelTable.id,
    scope: inArray(userModelTable.providerId, [WH_DEFAULT_PROVIDER_ID, WH_INTERNAL_PROVIDER_ID])
  })
}

function createDefaultModelPreferenceRows(): DefaultModelPreferenceRow[] {
  return DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
    scope: DEFAULT_MODEL_PREFERENCE_SCOPE,
    key,
    value: WH_DEFAULT_UNIQUE_MODEL_ID
  }))
}

function ensureDefaultModelPreferencesTx(tx: TxLike): void {
  for (const { scope, key, value } of createDefaultModelPreferenceRows()) {
    const [existing] = tx
      .select({ value: preferenceTable.value })
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
      .limit(1)
      .all()

    if (!existing) {
      logger.warn('Self-healed missing default model preference', { key, value })
      tx.insert(preferenceTable)
        .values({
          scope,
          key,
          value
        })
        .run()
    }
  }
}

function ensureCherryAiDefaultModelSetupTx(tx: TxLike): void {
  // WH fork: the upstream CherryAI provider + Qwen model are not seeded for
  // fresh users (only WH gateway providers/models); migration still restores
  // them for upgraded v1 databases via ensureCherryAiDefaultProviderAndModelTx.
  ensureWhDefaultModelTx(tx)
  ensureDefaultModelPreferencesTx(tx)
}

export class CherryAiDefaultModelSeeder implements ISeeder {
  readonly name = 'cherryaiDefaultModel'
  readonly description = 'Ensure WH default providers, models, and default model preferences'
  readonly version: string

  constructor() {
    this.version = hashObject({
      whModel: createWhDefaultModelRow(WH_DEFAULT_PROVIDER_ID, WH_DEFAULT_UNIQUE_MODEL_ID),
      whQwenModel: createWhQwenModelRow(WH_DEFAULT_PROVIDER_ID, WH_QWEN_UNIQUE_MODEL_ID),
      whInternalModel: createWhDefaultModelRow(WH_INTERNAL_PROVIDER_ID, WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID),
      whInternalQwenModel: createWhQwenModelRow(WH_INTERNAL_PROVIDER_ID, WH_INTERNAL_QWEN_UNIQUE_MODEL_ID),
      preferences: createDefaultModelPreferenceRows()
    })
  }

  run(db: DbType): void {
    db.transaction((tx) => ensureCherryAiDefaultModelSetupTx(tx))
  }
}
