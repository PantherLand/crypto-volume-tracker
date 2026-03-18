import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export function loadLocalEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return
  }

  const envPath = path.resolve(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  process.loadEnvFile(envPath)
}
