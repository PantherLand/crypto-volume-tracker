import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import express from 'express'
import cors from 'cors'
import { loadLocalEnv } from './env.mjs'
import {
  getDashboardSummary,
  getHourlySeries,
  getRecentRows,
  getSupportedAssets,
  startBackgroundSyncJob,
} from './coingecko.mjs'

loadLocalEnv()

const app = express()
const port = Number(process.env.PORT ?? 3001)
const distPath = path.resolve(process.cwd(), 'dist')

app.use(cors())
app.use(express.json())

app.get('/api/health', (_, response) => {
  response.json({ ok: true })
})

app.get('/api/assets', (_request, response) => {
  response.json({ assets: getSupportedAssets() })
})

app.get('/api/summary', async (request, response, next) => {
  try {
    const assetId = String(request.query.asset ?? 'bitcoin')
    response.json(await getDashboardSummary(assetId))
  } catch (error) {
    next(error)
  }
})

app.get('/api/hourly', async (request, response, next) => {
  try {
    const assetId = String(request.query.asset ?? 'bitcoin')
    const range = String(request.query.range ?? '30d')
    const maxPoints = Number(request.query.maxPoints ?? 2400)
    response.json(await getHourlySeries(assetId, range, maxPoints))
  } catch (error) {
    next(error)
  }
})

app.get('/api/recent', async (request, response, next) => {
  try {
    const assetId = String(request.query.asset ?? 'bitcoin')
    const page = Number(request.query.page ?? 1)
    const pageSize = Number(request.query.pageSize ?? 10)
    const windowSize = Number(request.query.window ?? 50)
    response.json(await getRecentRows(assetId, page, pageSize, windowSize))
  } catch (error) {
    next(error)
  }
})

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))

  app.get(/^(?!\/api).*/, (request, response, next) => {
    if (request.path.startsWith('/api')) {
      next()
      return
    }

    response.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : 'Server error'
  response.status(500).json({ error: message })
})

app.listen(port, () => {
  console.log(`Crypto tracker server listening on http://localhost:${port}`)
})

startBackgroundSyncJob()
