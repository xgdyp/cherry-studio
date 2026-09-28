import type { ISeeder } from '../types'
import { BuiltinMcpServerSeeder } from './seeders/builtinMcpServerSeeder'
import { CherryAiDefaultModelSeeder } from './seeders/cherryaiDefaultModelSeeder'
import { LegacyFileCleanupPolicySeeder } from './seeders/legacyFileCleanupPolicySeeder'
import { LocalModelSeeder } from './seeders/LocalModelSeeder'
import { LongTextPastePreferenceUpgradeSeeder } from './seeders/longTextPastePreferenceUpgradeSeeder'
import { MiniAppSeeder } from './seeders/miniAppSeeder'
import { PreferenceSeeder } from './seeders/preferenceSeeder'
import { PresetProviderSeeder } from './seeders/presetProviderSeeder'
import { TranslateLanguageSeeder } from './seeders/translateLanguageSeeder'
import { WebSearchPreferenceUpgradeSeeder } from './seeders/WebSearchPreferenceUpgradeSeeder'

/**
 * All seeders in execution order.
 *
 * WH fork: the default assistant and builtin agent seeders are intentionally
 * unregistered — new users start from an empty library.
 *
 * To add a new seeder: create an ISeeder class, add it to this array.
 * No changes to DbService needed.
 */
export const seeders: ISeeder[] = [
  new LegacyFileCleanupPolicySeeder(),
  new CherryAiDefaultModelSeeder(),
  new LongTextPastePreferenceUpgradeSeeder(),
  new WebSearchPreferenceUpgradeSeeder(),
  new PreferenceSeeder(),
  new TranslateLanguageSeeder(),
  new PresetProviderSeeder(),
  new LocalModelSeeder(),
  new MiniAppSeeder(),
  new BuiltinMcpServerSeeder()
]
