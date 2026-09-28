import { DEFAULT_ASSISTANT_SETTINGS } from '@shared/data/types/assistant'

import { WH_DEFAULT_UNIQUE_MODEL_ID } from './whDefaultModel'

export const DEFAULT_ASSISTANT_NAME = 'Cherry Assistant' as const
export const DEFAULT_ASSISTANT_EMOJI = '😀' as const
export const DEFAULT_ASSISTANT_PROMPT = '' as const

export function getDefaultAssistantNameForLocale(locale?: string | null): string {
  return locale?.toLowerCase().startsWith('zh') ? 'Cherry 助手' : DEFAULT_ASSISTANT_NAME
}

export const DEFAULT_ASSISTANT_SEED = {
  name: DEFAULT_ASSISTANT_NAME,
  emoji: DEFAULT_ASSISTANT_EMOJI,
  prompt: DEFAULT_ASSISTANT_PROMPT,
  description: '',
  modelId: WH_DEFAULT_UNIQUE_MODEL_ID,
  settings: DEFAULT_ASSISTANT_SETTINGS
} as const
