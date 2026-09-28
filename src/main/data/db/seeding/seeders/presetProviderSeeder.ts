import type { InsertUserProviderRow } from '@data/db/schemas/userProvider'
import { providerService } from '@data/services/ProviderService'
import {
  WH_DEFAULT_PROVIDER_BASE_URL,
  WH_DEFAULT_PROVIDER_ID,
  WH_DEFAULT_PROVIDER_NAME
} from '@shared/data/presets/whDefaultModel'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

import type { DbType, ISeeder } from '../../types'

type NewUserProviderInput = Omit<InsertUserProviderRow, 'orderKey'>

/**
 * Custom deployment: registry presets are NOT seeded. Only the built-in
 * corporate OpenAI-compatible gateways below are inserted (insert-only,
 * user edits are never overwritten).
 */
const BUILT_IN_PROVIDERS: NewUserProviderInput[] = [
  {
    providerId: WH_DEFAULT_PROVIDER_ID,
    presetProviderId: null,
    name: WH_DEFAULT_PROVIDER_NAME,
    endpointConfigs: { [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: { baseUrl: WH_DEFAULT_PROVIDER_BASE_URL } },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    isEnabled: true
  },
  {
    providerId: 'wh-external',
    presetProviderId: null,
    name: 'External Models',
    endpointConfigs: { [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: { baseUrl: 'https://gateway-b.example.com' } },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    isEnabled: true
  },
  {
    providerId: 'wh-internal',
    presetProviderId: null,
    name: 'Gateway B',
    endpointConfigs: { [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: { baseUrl: 'http://gateway-c.example.com' } },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    isEnabled: true
  }
]

export class PresetProviderSeeder implements ISeeder {
  readonly name = 'presetProvider'
  readonly description = 'Insert built-in provider configurations'
  readonly version = 'wh-1'

  run(db: DbType): void {
    db.transaction((tx) => providerService.batchUpsertTx(tx, BUILT_IN_PROVIDERS))
  }
}
