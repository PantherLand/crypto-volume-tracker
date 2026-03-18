import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import { prisma } from './db.mjs'
import { loadLocalEnv } from './env.mjs'

loadLocalEnv()

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'
const CHUNK_SPAN_MS = 90 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000
const HOURLY_SYNC_INTERVAL_MS = 60 * 60 * 1000
const REFRESH_THRESHOLD_MS = 70 * 60 * 1000

const ASSET_CONFIG = {
  bitcoin: {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    fullSyncStart: Date.parse('2010-07-17T00:00:00Z'),
  },
  ethereum: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    fullSyncStart: Date.parse('2015-08-07T00:00:00Z'),
  },
}

const DEFAULT_ASSET_ID = 'bitcoin'
const execFileAsync = promisify(execFile)

let activeSync = null

function getAssetConfig(assetId = DEFAULT_ASSET_ID) {
  return ASSET_CONFIG[assetId] ?? ASSET_CONFIG[DEFAULT_ASSET_ID]
}

function normalizeAssetIds(assetIds) {
  const candidates = assetIds?.length ? assetIds : Object.keys(ASSET_CONFIG)

  return candidates
    .map((assetId) => getAssetConfig(assetId).id)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
}

export function getSupportedAssets() {
  return Object.values(ASSET_CONFIG).map(({ id, symbol, name }) => ({
    id,
    symbol,
    name,
  }))
}

function getApiKey() {
  const apiKey = process.env.COINGECKO_API_KEY

  if (!apiKey) {
    throw new Error('Missing COINGECKO_API_KEY in environment')
  }

  return apiKey
}

function buildChunks(fromMs, toMs) {
  const chunks = []
  let cursor = fromMs

  while (cursor < toMs) {
    const chunkEnd = Math.min(cursor + CHUNK_SPAN_MS, toMs)
    chunks.push({ fromMs: cursor, toMs: chunkEnd })
    cursor = chunkEnd + 60 * 60 * 1000
  }

  return chunks
}

function mergeSeries(asset, payload) {
  const map = new Map()

  for (const [timestamp, priceUsd] of payload.prices ?? []) {
    map.set(timestamp, {
      timestamp: new Date(timestamp),
      priceUsd,
    })
  }

  for (const [timestamp, marketCapUsd] of payload.market_caps ?? []) {
    const current = map.get(timestamp)
    if (current) {
      current.marketCapUsd = marketCapUsd
    }
  }

  for (const [timestamp, volume24hUsd] of payload.total_volumes ?? []) {
    const current = map.get(timestamp)
    if (current) {
      current.volume24hUsd = volume24hUsd
    }
  }

  return [...map.values()]
    .filter(
      (point) =>
        Number.isFinite(point.priceUsd) &&
        Number.isFinite(point.marketCapUsd) &&
        Number.isFinite(point.volume24hUsd) &&
        point.marketCapUsd > 0,
    )
    .map((point) => ({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      timestamp: point.timestamp,
      priceUsd: point.priceUsd,
      marketCapUsd: point.marketCapUsd,
      volume24hUsd: point.volume24hUsd,
      turnoverRate: point.volume24hUsd / point.marketCapUsd,
      source: 'coingecko',
    }))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function requestTextWithFetch(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 25_000)

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': getApiKey(),
      },
      signal: controller.signal,
    })

    return {
      statusCode: response.status,
      body: await response.text(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function requestTextWithCurl(url) {
  return execFileAsync(
    'curl',
    [
      '-sS',
      '--connect-timeout',
      '10',
      '--max-time',
      '25',
      '-H',
      'accept: application/json',
      '-H',
      `x-cg-demo-api-key: ${getApiKey()}`,
      '-w',
      '\n__STATUS__:%{http_code}',
      url.toString(),
    ],
    {
      maxBuffer: 20 * 1024 * 1024,
    },
  ).then(({ stdout }) => {
    const marker = '\n__STATUS__:'
    const markerIndex = stdout.lastIndexOf(marker)

    if (markerIndex === -1) {
      throw new Error('Missing HTTP status marker from curl response')
    }

    return {
      statusCode: Number(stdout.slice(markerIndex + marker.length).trim()),
      body: stdout.slice(0, markerIndex),
    }
  })
}

async function requestText(url) {
  try {
    return await requestTextWithFetch(url)
  } catch (fetchError) {
    try {
      return await requestTextWithCurl(url)
    } catch (curlError) {
      if (curlError?.code === 'ENOENT') {
        throw fetchError
      }

      throw curlError
    }
  }
}

async function fetchChunk(asset, chunk, attempt = 0) {
  const url = new URL(`${COINGECKO_API_BASE}/coins/${asset.id}/market_chart/range`)
  url.searchParams.set('vs_currency', 'usd')
  url.searchParams.set('from', String(Math.floor(chunk.fromMs / 1000)))
  url.searchParams.set('to', String(Math.floor(chunk.toMs / 1000)))

  let response

  try {
    response = await requestText(url)
  } catch (error) {
    if (attempt < 5) {
      await sleep(1200 * (attempt + 1))
      return fetchChunk(asset, chunk, attempt + 1)
    }

    throw error
  }

  if (response.statusCode === 429 && attempt < 5) {
    await sleep(1200 * (attempt + 1))
    return fetchChunk(asset, chunk, attempt + 1)
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `${asset.symbol} CoinGecko request failed (${response.statusCode}): ${response.body}`,
    )
  }

  const payload = JSON.parse(response.body)
  return mergeSeries(asset, payload)
}

async function replaceChunk(asset, rows) {
  if (!rows.length) {
    return 0
  }

  const first = rows[0].timestamp
  const last = rows[rows.length - 1].timestamp

  await prisma.$transaction([
    prisma.assetHourlySnapshot.deleteMany({
      where: {
        assetId: asset.id,
        timestamp: {
          gte: first,
          lte: last,
        },
      },
    }),
    prisma.assetHourlySnapshot.createMany({
      data: rows,
    }),
  ])

  return rows.length
}

function getRecentSyncStart(latestTimestamp) {
  if (latestTimestamp) {
    return new Date(latestTimestamp.getTime() - 14 * 24 * 60 * 60 * 1000).getTime()
  }

  return Date.now() - 30 * 24 * 60 * 60 * 1000
}

function serializeSnapshot(row) {
  return {
    assetId: row.assetId,
    symbol: row.symbol,
    name: row.name,
    timestamp: row.timestamp.toISOString(),
    priceUsd: row.priceUsd,
    marketCapUsd: row.marketCapUsd,
    volume24hUsd: row.volume24hUsd,
    turnoverRate: row.turnoverRate,
  }
}

function serializeSyncRun(run) {
  return {
    id: run.id,
    mode: run.mode,
    assetIds: run.assetIds.split(','),
    status: run.status,
    fetchedPoints: run.fetchedPoints,
    insertedPoints: run.insertedPoints,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  }
}

async function createSyncRun(mode, assetIds, fromMs, toMs, chunkCount) {
  return prisma.syncRun.create({
    data: {
      mode,
      assetIds: assetIds.join(','),
      status: 'running',
      requestedFrom: new Date(fromMs),
      requestedTo: new Date(toMs),
      chunkCount,
    },
  })
}

async function finishSyncRun(id, payload) {
  await prisma.syncRun.update({
    where: { id },
    data: payload,
  })
}

export async function getDashboardSummary(assetId = DEFAULT_ASSET_ID) {
  const asset = getAssetConfig(assetId)

  const [totalRows, earliest, latest, lastRun] = await Promise.all([
    prisma.assetHourlySnapshot.count({
      where: {
        assetId: asset.id,
      },
    }),
    prisma.assetHourlySnapshot.findFirst({
      where: {
        assetId: asset.id,
      },
      orderBy: {
        timestamp: 'asc',
      },
    }),
    prisma.assetHourlySnapshot.findFirst({
      where: {
        assetId: asset.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
    }),
    prisma.syncRun.findFirst({
      orderBy: {
        startedAt: 'desc',
      },
    }),
  ])

  return {
    asset: {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
    },
    totalRows,
    coverageStart: earliest?.timestamp.toISOString() ?? null,
    coverageEnd: latest?.timestamp.toISOString() ?? null,
    latest: latest ? serializeSnapshot(latest) : null,
    lastRun: lastRun ? serializeSyncRun(lastRun) : null,
  }
}

function getRangeStart(asset, range, latestTimestamp) {
  const end = latestTimestamp?.getTime() ?? Date.now()

  switch (range) {
    case '7d':
      return end - 7 * 24 * 60 * 60 * 1000
    case '30d':
      return end - 30 * 24 * 60 * 60 * 1000
    case '90d':
      return end - 90 * 24 * 60 * 60 * 1000
    case '1y':
      return end - 365 * 24 * 60 * 60 * 1000
    case 'max':
    default:
      return asset.fullSyncStart
  }
}

function sampleRows(rows, maxPoints) {
  if (rows.length <= maxPoints) {
    return rows
  }

  const step = Math.ceil(rows.length / maxPoints)
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1)
}

export async function getHourlySeries(assetId = DEFAULT_ASSET_ID, range = '30d', maxPoints = 2400) {
  const asset = getAssetConfig(assetId)

  const latest = await prisma.assetHourlySnapshot.findFirst({
    where: {
      assetId: asset.id,
    },
    orderBy: {
      timestamp: 'desc',
    },
  })

  const from = new Date(getRangeStart(asset, range, latest?.timestamp))

  const rows = await prisma.assetHourlySnapshot.findMany({
    where: {
      assetId: asset.id,
      timestamp: {
        gte: from,
      },
    },
    orderBy: {
      timestamp: 'asc',
    },
  })

  const sampledRows = sampleRows(rows, maxPoints)

  return {
    asset: {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
    },
    points: sampledRows.map(serializeSnapshot),
    meta: {
      sampled: sampledRows.length !== rows.length,
      totalPoints: rows.length,
      returnedPoints: sampledRows.length,
      range,
    },
  }
}

export async function getRecentRows(
  assetId = DEFAULT_ASSET_ID,
  page = 1,
  pageSize = 10,
  windowSize = 50,
) {
  const asset = getAssetConfig(assetId)
  const totalRows = await prisma.assetHourlySnapshot.count({
    where: {
      assetId: asset.id,
    },
  })

  const boundedWindow = Math.max(1, Math.min(windowSize, 200))
  const boundedPageSize = Math.max(1, Math.min(pageSize, 25))
  const availableWindow = Math.min(totalRows, boundedWindow)
  const totalPages = Math.max(1, Math.ceil(availableWindow / boundedPageSize))
  const currentPage = Math.max(1, Math.min(page, totalPages))
  const skip = (currentPage - 1) * boundedPageSize
  const take = Math.max(0, Math.min(boundedPageSize, availableWindow - skip))

  const rows =
    take > 0
      ? await prisma.assetHourlySnapshot.findMany({
          where: {
            assetId: asset.id,
          },
          orderBy: {
            timestamp: 'desc',
          },
          skip,
          take,
        })
      : []

  return {
    asset: {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
    },
    rows: rows.map(serializeSnapshot),
    meta: {
      page: currentPage,
      pageSize: boundedPageSize,
      totalPages,
      windowSize: availableWindow,
    },
  }
}

export async function getSyncStatus() {
  if (activeSync?.active) {
    return {
      active: true,
      current: activeSync.current,
      lastRun: activeSync.lastRun,
    }
  }

  const lastRun = await prisma.syncRun.findFirst({
    orderBy: {
      startedAt: 'desc',
    },
  })

  return {
    active: false,
    current: null,
    lastRun: lastRun ? serializeSyncRun(lastRun) : null,
  }
}

export async function startSync(mode = 'recent', requestedAssetIds = Object.keys(ASSET_CONFIG)) {
  if (activeSync?.active) {
    return getSyncStatus()
  }

  const assetIds = normalizeAssetIds(requestedAssetIds)
  const toMs = Date.now()

  const latestRows = await Promise.all(
    assetIds.map((assetId) =>
      prisma.assetHourlySnapshot.findFirst({
        where: {
          assetId,
        },
        orderBy: {
          timestamp: 'desc',
        },
      }),
    ),
  )

  const plans = assetIds.map((assetId, index) => {
    const asset = getAssetConfig(assetId)
    const latest = latestRows[index]
    const fromMs =
      mode === 'full' ? asset.fullSyncStart : getRecentSyncStart(latest?.timestamp)

    return {
      asset,
      fromMs,
      chunks: buildChunks(fromMs, toMs),
    }
  })

  const totalChunkCount = plans.reduce((sum, plan) => sum + plan.chunks.length, 0)
  const requestedFrom = Math.min(...plans.map((plan) => plan.fromMs))
  const run = await createSyncRun(mode, assetIds, requestedFrom, toMs, totalChunkCount)

  activeSync = {
    active: true,
    current: {
      mode,
      assetId: plans[0]?.asset.id ?? DEFAULT_ASSET_ID,
      assetSymbol: plans[0]?.asset.symbol ?? ASSET_CONFIG[DEFAULT_ASSET_ID].symbol,
      assetIndex: 1,
      assetCount: plans.length,
      chunkIndex: 0,
      chunkCount: totalChunkCount,
      fetchedPoints: 0,
      insertedPoints: 0,
      startedAt: new Date().toISOString(),
    },
    lastRun: {
      id: run.id,
      mode: run.mode,
      assetIds,
      status: run.status,
      fetchedPoints: 0,
      insertedPoints: 0,
      startedAt: run.startedAt.toISOString(),
      finishedAt: null,
    },
  }

  const execute = (async () => {
    let fetchedPoints = 0
    let insertedPoints = 0
    let completedChunks = 0

    try {
      for (let assetPlanIndex = 0; assetPlanIndex < plans.length; assetPlanIndex += 1) {
        const plan = plans[assetPlanIndex]

        activeSync.current = {
          ...activeSync.current,
          assetId: plan.asset.id,
          assetSymbol: plan.asset.symbol,
          assetIndex: assetPlanIndex + 1,
          assetCount: plans.length,
        }

        for (let chunkIndex = 0; chunkIndex < plan.chunks.length; chunkIndex += 1) {
          const rows = await fetchChunk(plan.asset, plan.chunks[chunkIndex])
          fetchedPoints += rows.length
          insertedPoints += await replaceChunk(plan.asset, rows)
          completedChunks += 1

          activeSync.current = {
            ...activeSync.current,
            chunkIndex: completedChunks,
            chunkCount: totalChunkCount,
            fetchedPoints,
            insertedPoints,
          }

          await finishSyncRun(run.id, {
            status: 'running',
            fetchedPoints,
            insertedPoints,
          })

          await sleep(1200)
        }
      }

      const finishedAt = new Date()

      await finishSyncRun(run.id, {
        status: 'success',
        fetchedPoints,
        insertedPoints,
        finishedAt,
      })

      activeSync.lastRun = {
        id: run.id,
        mode,
        assetIds,
        status: 'success',
        fetchedPoints,
        insertedPoints,
        startedAt: run.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      }
    } catch (error) {
      const finishedAt = new Date()
      const message = error instanceof Error ? error.message : 'Unknown sync error'

      await finishSyncRun(run.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt,
      })

      activeSync.lastRun = {
        id: run.id,
        mode,
        assetIds,
        status: 'failed',
        fetchedPoints,
        insertedPoints,
        startedAt: run.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      }

      throw error
    } finally {
      activeSync.current = null
      activeSync = {
        active: false,
        current: null,
        lastRun: activeSync.lastRun,
      }

      setTimeout(() => {
        activeSync = null
      }, 2000)
    }
  })()

  execute.catch((error) => {
    console.error('Sync failed:', error)
  })

  return getSyncStatus()
}

export async function ensureRecentData() {
  if (activeSync?.active) {
    return getSyncStatus()
  }

  const assetIds = Object.keys(ASSET_CONFIG)
  const latestRows = await Promise.all(
    assetIds.map((assetId) =>
      prisma.assetHourlySnapshot.findFirst({
        where: {
          assetId,
        },
        orderBy: {
          timestamp: 'desc',
        },
      }),
    ),
  )

  const now = Date.now()
  const staleAssetIds = latestRows
    .map((row, index) => ({ row, assetId: assetIds[index] }))
    .filter(({ row }) => !row || now - row.timestamp.getTime() >= REFRESH_THRESHOLD_MS)
    .map(({ assetId }) => assetId)

  if (!staleAssetIds.length) {
    return getSyncStatus()
  }

  return startSync('recent', staleAssetIds)
}

export function startBackgroundSyncJob() {
  const execute = async () => {
    try {
      await ensureRecentData()
    } catch (error) {
      console.error('Background sync failed:', error)
    }
  }

  void execute()

  const timer = setInterval(() => {
    void execute()
  }, HOURLY_SYNC_INTERVAL_MS)

  timer.unref?.()
  return timer
}
