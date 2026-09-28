/**
 * Publishes Windows release artifacts to the WH MinIO update bucket.
 *
 * Uploads latest.yml, the NSIS installer, and (when present) release-history.json
 * into the win/ prefix the in-app updater feeds on (see UPDATE_FEED_URL in
 * src/main/services/AppUpdaterService.ts and publish.url in electron-builder.yml).
 *
 * Usage (from the repo root, after a Windows build):
 *   node scripts/publish-updates.js [distDir]
 *
 * One-time bucket setup (admin machine, needs mc + write credentials):
 *   mc alias set cherrydeploy http://updates-a.example.com:9000 <ACCESS_KEY> <SECRET_KEY>
 *   mc mb --ignore-existing cherrydeploy/cherrydeploy-updates
 *   mc anonymous set download cherrydeploy/cherrydeploy-updates
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const TARGET = 'cherrydeploy/cherrydeploy-updates/win/'
const FEED_URL = 'http://updates-a.example.com:9000/cherrydeploy-updates/win/'
const INSTALLER_PATTERN = /^CherryDeploy-[\d.]+[^/]*-setup\.exe$/

function main() {
  const distDir = path.resolve(process.argv[2] || 'dist')
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist directory not found: ${distDir}`)
  }

  const files = ['latest.yml', ...fs.readdirSync(distDir).filter((f) => INSTALLER_PATTERN.test(f))]
  const optional = ['release-history.json']
  const missing = []

  for (const name of files) {
    if (!fs.existsSync(path.join(distDir, name))) missing.push(name)
  }
  if (missing.length > 0) {
    throw new Error(`Missing required release artifacts in ${distDir}:\n  ${missing.join('\n  ')}`)
  }

  for (const name of optional) {
    if (fs.existsSync(path.join(distDir, name))) files.push(name)
  }

  const paths = files.map((name) => path.join(distDir, name))
  console.log(`Publishing to ${TARGET}:\n  ${files.join('\n  ')}`)
  execFileSync('mc', ['cp', ...paths, TARGET], { stdio: 'inherit' })
  console.log(`Update feed is live at ${FEED_URL}latest.yml`)
}

try {
  main()
} catch (error) {
  console.error(`Failed to publish updates: ${error.message}`)
  process.exit(1)
}
