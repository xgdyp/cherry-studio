/**
 * WH enterprise deployment switches.
 *
 * The corporate build runs on an intranet: official Cherry Studio services
 * (telemetry, crash reporting, cloud login, skill marketplace, …) are
 * unreachable and must not even surface in the UI. Every gate below compiles
 * to a constant so dead branches tree-shake out of the bundle.
 */
export const WH_ENTERPRISE = true as const

/** Crash/usage telemetry (Sentry, Analytics) and the privacy consent that feeds it. */
export const WH_TELEMETRY_DISABLED = WH_ENTERPRISE
/** Official account systems: Cherry Cloud login and CherryIN OAuth. */
export const WH_OFFICIAL_LOGIN_DISABLED = WH_ENTERPRISE
/** Online skill marketplace (skills.sh / clawhub.ai / claude-plugins.dev) and remote skill install. */
export const WH_SKILL_MARKET_DISABLED = WH_ENTERPRISE
/** Bundled external web apps on the Launchpad (cherry-ai.com hosted). */
export const WH_BUNDLED_WEBAPPS_DISABLED = WH_ENTERPRISE
/** Mini-app online install and update checks. */
export const WH_MINIAPP_ONLINE_DISABLED = WH_ENTERPRISE
/** User feedback channels that post to official services (GitHub issues, diagnostic upload). */
export const WH_FEEDBACK_DISABLED = WH_ENTERPRISE
/** Corporate portal that replaces every outbound cherry-ai.com link. */
export const WH_PORTAL_URL = 'https://portal.example.com' as const
