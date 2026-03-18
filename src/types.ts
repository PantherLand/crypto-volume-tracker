export type AssetId = 'bitcoin' | 'ethereum'

export type AssetMeta = {
  id: AssetId
  symbol: 'BTC' | 'ETH'
  name: string
}

export type RangePreset = '7d' | '30d' | '90d' | '1y' | 'max'

export type SnapshotRow = {
  assetId: AssetId
  symbol: 'BTC' | 'ETH'
  name: string
  timestamp: string
  priceUsd: number
  marketCapUsd: number
  volume24hUsd: number
  turnoverRate: number
}

export type SyncRun = {
  id: string
  mode: 'recent' | 'year' | 'full'
  assetIds: AssetId[]
  status: 'running' | 'success' | 'failed'
  fetchedPoints: number
  insertedPoints: number
  startedAt: string
  finishedAt: string | null
}

export type DashboardSummary = {
  asset: AssetMeta
  totalRows: number
  coverageStart: string | null
  coverageEnd: string | null
  latest: SnapshotRow | null
  lastRun: SyncRun | null
}

export type HourlyResponse = {
  asset: AssetMeta
  points: SnapshotRow[]
  meta: {
    sampled: boolean
    totalPoints: number
    returnedPoints: number
    range: string
  }
}

export type RecentResponse = {
  asset: AssetMeta
  rows: SnapshotRow[]
  meta: {
    page: number
    pageSize: number
    totalPages: number
    windowSize: number
  }
}
