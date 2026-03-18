import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type {
  AssetId,
  DashboardSummary,
  HourlyResponse,
  RangePreset,
  RecentResponse,
} from './types'
import {
  formatCompactNumber,
  formatCoverage,
  formatCurrency,
  formatPercent,
  formatRangeLabel,
  formatTimestamp,
} from './utils/format'

const RANGE_OPTIONS: RangePreset[] = ['7d', '30d', '90d', '1y', 'max']
const ASSET_OPTIONS: Array<{ id: AssetId; symbol: 'BTC' | 'ETH'; name: string }> = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
]
const PAGE_SIZE = 20
const RECENT_WINDOW = 60

function App() {
  const [assetId, setAssetId] = useState<AssetId>('bitcoin')
  const [range, setRange] = useState<RangePreset>('30d')
  const [page, setPage] = useState(1)
  const [pendingAssetId, setPendingAssetId] = useState<AssetId | null>(null)
  const [showSyncHelp, setShowSyncHelp] = useState(false)
  const [showCoverageHelp, setShowCoverageHelp] = useState(false)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [chartData, setChartData] = useState<HourlyResponse | null>(null)
  const [recentData, setRecentData] = useState<RecentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [assetId])

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)

      try {
        const search = new URLSearchParams({
          asset: assetId,
        })
        const recentSearch = new URLSearchParams({
          asset: assetId,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          window: String(RECENT_WINDOW),
        })
        const chartSearch = new URLSearchParams({
          asset: assetId,
          range,
        })

        const [summaryResponse, chartResponse, recentResponse] = await Promise.all([
          fetch(`/api/summary?${search.toString()}`),
          fetch(`/api/hourly?${chartSearch.toString()}`),
          fetch(`/api/recent?${recentSearch.toString()}`),
        ])

        if (!summaryResponse.ok || !chartResponse.ok || !recentResponse.ok) {
          throw new Error('读取本地加密货币数据失败')
        }

        const [summaryJson, chartJson, recentJson] = await Promise.all([
          summaryResponse.json() as Promise<DashboardSummary>,
          chartResponse.json() as Promise<HourlyResponse>,
          recentResponse.json() as Promise<RecentResponse>,
        ])

        if (cancelled) {
          return
        }

        setSummary(summaryJson)
        setChartData(chartJson)
        setRecentData(recentJson)
        setError(null)

        if (recentJson.meta.page !== page) {
          setPage(recentJson.meta.page)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setPendingAssetId(null)
        }
      }
    }

    void loadDashboard()

    const timer = window.setInterval(() => {
      void loadDashboard()
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [assetId, page, range])

  const activeAsset = summary?.asset ?? ASSET_OPTIONS.find((asset) => asset.id === assetId) ?? ASSET_OPTIONS[0]
  const latest = summary?.latest ?? null
  const accentColor = activeAsset.id === 'bitcoin' ? '#7dd3fc' : '#34d399'
  const chartName = `${activeAsset.symbol} 价格`
  const isAssetSwitching = loading && pendingAssetId !== null

  function handleAssetChange(nextAssetId: AssetId) {
    if (nextAssetId === assetId) {
      return
    }

    setPendingAssetId(nextAssetId)
    setLoading(true)
    setAssetId(nextAssetId)
  }

  return (
    <main className="min-h-screen bg-ink text-sand">
      {showSyncHelp || showCoverageHelp ? (
        <button
          aria-label="关闭说明"
          className="fixed inset-0 z-10 bg-transparent"
          onClick={() => {
            setShowSyncHelp(false)
            setShowCoverageHelp(false)
          }}
          type="button"
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,184,77,0.22),_transparent_32%),linear-gradient(135deg,_rgba(13,27,42,0.96),_rgba(4,11,20,0.98))] shadow-2xl shadow-black/30">
          <div
            aria-busy={isAssetSwitching}
            className={`grid gap-8 px-6 py-8 transition-opacity duration-200 lg:grid-cols-[1.45fr_0.9fr] lg:px-10 lg:py-10 ${
              isAssetSwitching ? 'opacity-70' : 'opacity-100'
            }`}
          >
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="max-w-2xl font-heading text-4xl font-semibold leading-none text-white sm:text-5xl lg:text-6xl">
                  Crypto Volume Tracker
                </p>
                <div className="flex flex-wrap gap-3">
                  {ASSET_OPTIONS.map((asset) => {
                    const isActive = asset.id === assetId
                    const isPending = pendingAssetId === asset.id

                    return (
                      <button
                        key={asset.id}
                        aria-busy={isPending}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-white text-ink'
                            : 'border border-white/10 bg-white/5 text-sand/72 hover:bg-white/10'
                        }`}
                        disabled={isAssetSwitching}
                        onClick={() => handleAssetChange(asset.id)}
                      >
                        {isPending ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                        ) : null}
                        <span>{asset.symbol} · {asset.name}</span>
                        {isPending ? <span className="text-xs opacity-70">Loading...</span> : null}
                      </button>
                    )
                  })}
                </div>
                <p className="max-w-2xl text-sm leading-7 text-sand/72 sm:text-base">
                  当前视图聚焦 {activeAsset.name}。换手率 = 该时点 24 小时成交量 / 该时点市值。
                  数据唯一来源是 CoinGecko，后端按小时级历史快照入库，并在后台每 1 小时自动补最近数据。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={`${activeAsset.symbol} 最新价格`}
                  value={latest ? formatCurrency(latest.priceUsd) : '--'}
                  detail={latest ? formatTimestamp(latest.timestamp) : '后台正在准备数据'}
                />
                <MetricCard
                  label="最新换手率"
                  value={latest ? formatPercent(latest.turnoverRate) : '--'}
                  detail={
                    latest
                      ? `${formatCompactNumber(latest.volume24hUsd)} / ${formatCompactNumber(latest.marketCapUsd)}`
                      : '24h 成交量 / 市值'
                  }
                />
                <MetricCard
                  label="覆盖区间"
                  value={summary ? `${summary.totalRows.toLocaleString()} 条` : '--'}
                  detail={formatCoverage(summary?.coverageStart ?? null, summary?.coverageEnd ?? null)}
                />
              </div>
            </div>

            <aside className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.28em] text-sand/55">Background refresh</p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="font-heading text-2xl text-white">后台自动同步</h2>
                  <button
                    aria-expanded={showSyncHelp}
                    aria-haspopup="dialog"
                    aria-label="查看自动同步说明"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-sand/80 transition hover:bg-white/10 hover:text-white"
                    onClick={() => setShowSyncHelp((value) => !value)}
                    type="button"
                  >
                    ?
                  </button>
                </div>

                {showSyncHelp ? (
                  <div
                    className="absolute right-0 top-14 z-20 w-[min(26rem,calc(100vw-4rem))] rounded-2xl border border-white/15 bg-[#050b12] p-4 text-left text-sm leading-7 text-sand/88 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
                    role="dialog"
                  >
                    <p>服务启动后会自动检查 BTC 和 ETH 是否缺少最近小时数据。</p>
                    <p>如果某个币种数据为空，或离当前时间超过约 70 分钟，就会在后台触发最近区间补数。</p>
                    <p>全量历史仍保留命令行同步能力，但不再把同步按钮暴露给页面用户。</p>
                    <p>BTC 全量历史从 2010-07-17 起抓取，ETH 全量历史从 2015-08-07 起抓取。</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <DataRow
                  label="当前币种"
                  value={`${activeAsset.symbol} · ${activeAsset.name}`}
                />
                <DataRow
                  label="最近快照时间"
                  value={latest ? formatTimestamp(latest.timestamp) : '--'}
                />
                <DataRow
                  label="24h 成交量"
                  value={latest ? formatCompactNumber(latest.volume24hUsd) : '--'}
                />
                <DataRow
                  label="当前市值"
                  value={latest ? formatCompactNumber(latest.marketCapUsd) : '--'}
                />
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </aside>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-night/80 p-5 shadow-xl shadow-black/20">
            <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sand/50">Price vs turnover</p>
                <h2 className="mt-2 font-heading text-2xl text-white">{activeAsset.symbol} 小时级走势图</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      range === option
                        ? 'bg-amber text-ink'
                        : 'border border-white/10 bg-white/5 text-sand/72 hover:bg-white/10'
                    }`}
                    onClick={() => setRange(option)}
                  >
                    {formatRangeLabel(option)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[420px]">
              {loading ? (
                <ChartPlaceholder label="正在加载图表..." />
              ) : chartData && chartData.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData.points}>
                    <defs>
                      <linearGradient id="turnoverFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#ffb84d" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ffb84d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      minTickGap={24}
                      stroke="rgba(238,229,212,0.4)"
                      tickFormatter={(value) =>
                        format(parseISO(value), range === '7d' ? 'MM-dd HH:mm' : 'yy-MM-dd')
                      }
                    />
                    <YAxis
                      yAxisId="price"
                      orientation="left"
                      stroke={accentColor}
                      tickFormatter={(value) =>
                        `$${Intl.NumberFormat('en-US', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(value)}`
                      }
                    />
                    <YAxis
                      yAxisId="turnover"
                      orientation="right"
                      stroke="#ffb84d"
                      tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                    <Tooltip content={<ChartTooltip assetSymbol={activeAsset.symbol} />} />
                    <Legend />
                    <Area
                      yAxisId="turnover"
                      dataKey="turnoverRate"
                      name="换手率"
                      fill="url(#turnoverFill)"
                      stroke="#ffb84d"
                      strokeWidth={1.5}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="priceUsd"
                      name={chartName}
                      stroke={accentColor}
                      strokeWidth={2.2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder label="后台正在准备图表数据。" />
              )}
            </div>

            {chartData?.meta.sampled ? (
              <p className="mt-4 text-sm text-sand/55">
                当前图表从 {chartData.meta.totalPoints.toLocaleString()} 个原始小时点中抽样展示
                {` ${chartData.points.length.toLocaleString()} `}个点，数据库仍保留完整小时级记录。
              </p>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="relative rounded-[1.75rem] border border-white/10 bg-night/80 p-5 shadow-xl shadow-black/20">
              <p className="text-xs uppercase tracking-[0.28em] text-sand/50">Coverage</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="font-heading text-2xl text-white">数据密度</h2>
                <button
                  aria-expanded={showCoverageHelp}
                  aria-haspopup="dialog"
                  aria-label="查看数据说明"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-sand/80 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setShowCoverageHelp((value) => !value)}
                  type="button"
                >
                  ?
                </button>
              </div>

              {showCoverageHelp ? (
                <div
                  className="absolute right-5 top-20 z-20 w-[min(24rem,calc(100vw-4rem))] rounded-2xl border border-white/15 bg-[#050b12] p-4 text-left text-sm leading-7 text-sand/88 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
                  role="dialog"
                >
                  <p>价格、24h 成交量和市值都来自同一个 CoinGecko 历史时间点快照。</p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <DataRow
                  label="最早记录"
                  value={summary?.coverageStart ? formatTimestamp(summary.coverageStart) : '--'}
                />
                <DataRow
                  label="最新记录"
                  value={summary?.coverageEnd ? formatTimestamp(summary.coverageEnd) : '--'}
                />
                <DataRow
                  label="累计小时点"
                  value={summary ? `${summary.totalRows.toLocaleString()} 条` : '--'}
                />
                <DataRow
                  label="当前浏览区间"
                  value={chartData ? `${chartData.points.length.toLocaleString()} 点` : '--'}
                />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-night/80 p-5 shadow-xl shadow-black/20">
              <p className="text-xs uppercase tracking-[0.28em] text-sand/50">Formula</p>
              <h2 className="mt-2 font-heading text-2xl text-white">换手率定义</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-sand/78">
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-amber-100">
                  turnoverRate = totalVolume(24h) / marketCap
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-night/80 p-5 shadow-xl shadow-black/20">
          <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sand/50">Recent rows</p>
              <h2 className="mt-2 font-heading text-2xl text-white">最近60小时快照</h2>
            </div>
            <p className="text-sm text-sand/55">
              当前第 {recentData?.meta.page ?? 1} / {recentData?.meta.totalPages ?? 1} 页
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-sand/45">
                <tr>
                  <th className="px-3 py-3 font-normal">时间</th>
                  <th className="px-3 py-3 font-normal">价格</th>
                  <th className="px-3 py-3 font-normal">24h 成交量</th>
                  <th className="px-3 py-3 font-normal">市值</th>
                  <th className="px-3 py-3 font-normal">换手率</th>
                </tr>
              </thead>
              <tbody>
                {recentData?.rows.map((row, index) => (
                  <tr
                    key={`${row.assetId}-${row.timestamp}`}
                    className={`border-t border-white/8 text-sand/82 ${
                      index % 2 === 0 ? 'bg-white/[0.06]' : 'bg-[#020811]'
                    }`}
                  >
                    <td className="px-3 py-3">{formatTimestamp(row.timestamp)}</td>
                    <td className="px-3 py-3">{formatCurrency(row.priceUsd)}</td>
                    <td className="px-3 py-3">{formatCompactNumber(row.volume24hUsd)}</td>
                    <td className="px-3 py-3">{formatCompactNumber(row.marketCapUsd)}</td>
                    <td className="px-3 py-3">{formatPercent(row.turnoverRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sand/55">
              每页 {recentData?.meta.pageSize ?? PAGE_SIZE} 条，共展示最近 {recentData?.meta.windowSize ?? 0} 条快照。
            </p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-sand/78 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!recentData || recentData.meta.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-sand/78 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!recentData || recentData.meta.page >= recentData.meta.totalPages}
                onClick={() =>
                  setPage((value) =>
                    recentData ? Math.min(recentData.meta.totalPages, value + 1) : value,
                  )
                }
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] text-sand/55">
      {label}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.28em] text-sand/50">{label}</p>
      <p className="mt-3 font-heading text-3xl text-white">{value}</p>
      <p className="mt-2 text-sm text-sand/58">{detail}</p>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="text-sand/55">{label}</span>
      <span className="font-medium text-right text-white">{value}</span>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  assetSymbol,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; name: string }>
  label?: string
  assetSymbol: 'BTC' | 'ETH'
}) {
  if (!active || !payload || !payload.length || !label) {
    return null
  }

  const pricePoint = payload.find((item) => item.dataKey === 'priceUsd')
  const turnoverPoint = payload.find((item) => item.dataKey === 'turnoverRate')

  return (
    <div className="rounded-2xl border border-white/10 bg-[#06111e]/95 px-4 py-3 text-sm text-sand shadow-2xl">
      <p className="mb-3 text-sand/55">{formatTimestamp(label)}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-8">
          <span className="text-sand/60">{pricePoint?.name ?? `${assetSymbol} 价格`}</span>
          <span className="font-medium text-white">
            {formatCurrency(pricePoint?.value ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <span className="text-sand/60">{turnoverPoint?.name ?? '换手率'}</span>
          <span className="font-medium text-amber-100">
            {formatPercent(turnoverPoint?.value ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
