import process from 'node:process'
import { prisma } from '../server/db.mjs'
import { getSyncStatus, startSync } from '../server/coingecko.mjs'
import { loadLocalEnv } from '../server/env.mjs'

loadLocalEnv()

const requestedMode = process.argv[2]
const mode =
  requestedMode === 'full' || requestedMode === 'year' ? requestedMode : 'recent'

async function main() {
  const status = await startSync(mode)
  console.log(`Started ${mode} sync`, status)

  while (true) {
    const current = await getSyncStatus()

    if (!current.active) {
      console.log('Sync finished', current.lastRun)
      break
    }

    console.log(
      `${current.current.assetSymbol} ${current.current.chunkIndex}/${current.current.chunkCount}, inserted ${current.current.insertedPoints}`,
    )

    await new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
