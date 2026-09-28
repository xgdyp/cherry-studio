import { createUniqueModelId } from '@shared/data/types/model'

/** Built-in corporate default model (custom deployment). */
export const WH_DEFAULT_PROVIDER_ID = 'wh-ai' as const
export const WH_DEFAULT_PROVIDER_NAME = 'Gateway A' as const
export const WH_DEFAULT_PROVIDER_BASE_URL = 'https://gateway-a.example.com' as const
export const WH_DEFAULT_MODEL_ID = 'DeepSeek-V4-Flash' as const
export const WH_DEFAULT_MODEL_NAME = 'DeepSeek V4 Flash' as const
export const WH_DEFAULT_MODEL_GROUP = 'DeepSeek' as const
export const WH_DEFAULT_UNIQUE_MODEL_ID = createUniqueModelId(WH_DEFAULT_PROVIDER_ID, WH_DEFAULT_MODEL_ID)

/** Built-in secondary model on the same provider (text + image input). */
export const WH_QWEN_MODEL_ID = 'Qwen3.8-27B' as const
export const WH_QWEN_MODEL_NAME = 'Qwen3.8 27B' as const
export const WH_QWEN_MODEL_GROUP = 'Qwen' as const
export const WH_QWEN_UNIQUE_MODEL_ID = createUniqueModelId(WH_DEFAULT_PROVIDER_ID, WH_QWEN_MODEL_ID)

/** Gateway B gateway (custom deployment). Serves the same two models. */
export const WH_INTERNAL_PROVIDER_ID = 'wh-internal' as const
export const WH_INTERNAL_PROVIDER_NAME = 'Gateway B' as const
export const WH_INTERNAL_PROVIDER_BASE_URL = 'http://gateway-c.example.com' as const
export const WH_INTERNAL_DEFAULT_UNIQUE_MODEL_ID = createUniqueModelId(WH_INTERNAL_PROVIDER_ID, WH_DEFAULT_MODEL_ID)
export const WH_INTERNAL_QWEN_UNIQUE_MODEL_ID = createUniqueModelId(WH_INTERNAL_PROVIDER_ID, WH_QWEN_MODEL_ID)

/**
 * WH gateways whose seeded API key is corporate-managed: the renderer never
 * sees the key value and cannot add/replace/update/delete keys for them.
 */
export const WH_MANAGED_PROVIDER_IDS: readonly string[] = [WH_DEFAULT_PROVIDER_ID, WH_INTERNAL_PROVIDER_ID]

/** Placeholder served to the renderer instead of a real WH-managed key value. */
export const WH_MANAGED_KEY_PLACEHOLDER = '********' as const

/** WH gateways that serve models with WH-specific limits instead of catalog limits. */
export const WH_LIMITED_PROVIDER_IDS: readonly string[] = [WH_DEFAULT_PROVIDER_ID, WH_INTERNAL_PROVIDER_ID]

export type WhModelLimits = { contextWindow: number; maxInputTokens: number }

/**
 * Effective limits of known models served behind WH gateways — smaller than
 * the public catalog claims. Keyed by lowercase raw model id from the gateway.
 */
export const WH_MODEL_LIMITS: Readonly<Record<string, WhModelLimits>> = {
  [WH_DEFAULT_MODEL_ID.toLowerCase()]: { contextWindow: 393216, maxInputTokens: 30000 },
  [WH_QWEN_MODEL_ID.toLowerCase()]: { contextWindow: 256000, maxInputTokens: 30000 }
}
