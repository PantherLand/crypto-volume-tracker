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
const STORAGE_THEME_KEY = 'volume-track-theme'

type ThemeMode = 'dark' | 'light'

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    const storedTheme = window.localStorage.getItem(STORAGE_THEME_KEY)

    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
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
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_THEME_KEY, theme)
  }, [theme])

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
  const isDark = theme === 'dark'
  const shellClass = isDark ? 'bg-ink text-sand' : 'bg-[#f6efe1] text-[#152131]'
  const heroClass = isDark
    ? 'border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,184,77,0.22),_transparent_32%),linear-gradient(135deg,_rgba(13,27,42,0.96),_rgba(4,11,20,0.98))] shadow-black/30'
    : 'border-[#c9b79c]/55 bg-[radial-gradient(circle_at_top_left,_rgba(252,184,82,0.24),_transparent_34%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(242,230,210,0.98))] shadow-[#a78b63]/20'
  const panelClass = isDark
    ? 'border-white/10 bg-night/80 shadow-black/20'
    : 'border-[#d8c7af]/70 bg-[#fffaf1]/88 shadow-[#bda27a]/15'
  const asideClass = isDark
    ? 'border-white/10 bg-white/5'
    : 'border-[#d8c7af]/70 bg-white/70'
  const surfaceClass = isDark
    ? 'border-white/10 bg-white/5'
    : 'border-[#d8c7af]/70 bg-[#fffdf9]'
  const mutedTextClass = isDark ? 'text-sand/55' : 'text-[#6b6257]'
  const softTextClass = isDark ? 'text-sand/72' : 'text-[#4d5664]'
  const headingClass = isDark ? 'text-white' : 'text-[#142032]'
  const tableHeaderClass = isDark ? 'text-sand/45' : 'text-[#6b6257]'
  const rowEvenClass = isDark ? 'bg-white/[0.06]' : 'bg-[#fff8ef]'
  const rowOddClass = isDark ? 'bg-[#020811]' : 'bg-[#f5ede0]'
  const borderClass = isDark ? 'border-white/10' : 'border-[#d8c7af]/70'
  const lineBorderClass = isDark ? 'border-white/8' : 'border-[#d9c9b5]'
  const inactivePillClass = isDark
    ? 'border-white/10 bg-white/5 text-sand/72 hover:bg-white/10'
    : 'border-[#d8c7af]/80 bg-white/75 text-[#4d5664] hover:bg-white'
  const themeToggleClass = isDark
    ? 'border-white/10 bg-white/5 text-sand/82 shadow-black/20 hover:bg-white/10'
    : 'border-[#d8c7af]/80 bg-white/80 text-[#4d5664] shadow-[#bda27a]/20 hover:bg-white'
  const themeIconClass = isDark ? 'text-sand/45' : 'text-[#9a8c79]'
  const themeIconActiveClass = isDark ? 'bg-white text-[#09111b]' : 'bg-[#152131] text-[#fffaf3]'
  const popoverClass = isDark
    ? 'border-white/15 bg-[#050b12] text-sand/88 shadow-[0_24px_80px_rgba(0,0,0,0.6)]'
    : 'border-[#cfb998]/80 bg-[#fffaf3] text-[#243244] shadow-[0_24px_80px_rgba(93,72,38,0.18)]'
  const chartGrid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(31,41,55,0.09)'
  const chartAxis = isDark ? 'rgba(238,229,212,0.4)' : 'rgba(70,80,94,0.7)'

  function handleAssetChange(nextAssetId: AssetId) {
    if (nextAssetId === assetId) {
      return
    }

    setPendingAssetId(nextAssetId)
    setLoading(true)
    setAssetId(nextAssetId)
  }

  return (
    <main className={`min-h-screen transition-colors duration-200 ${shellClass}`}>
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
        <div className="pointer-events-none fixed right-4 top-4 z-20 sm:right-6 sm:top-6">
          <button
            aria-label={isDark ? '切换到日间模式' : '切换到夜间模式'}
            className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-1.5 shadow-lg transition ${themeToggleClass}`}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            type="button"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                !isDark ? themeIconActiveClass : themeIconClass
              }`}
            >
              <SunIcon />
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                isDark ? themeIconActiveClass : themeIconClass
              }`}
            >
              <MoonIcon />
            </span>
          </button>
        </div>
        <section className={`overflow-hidden rounded-[2rem] border shadow-2xl transition-colors duration-200 ${heroClass}`}>
          <div
            aria-busy={isAssetSwitching}
            className={`grid gap-8 px-6 py-8 transition-opacity duration-200 lg:grid-cols-[1.45fr_0.9fr] lg:px-10 lg:py-10 ${
              isAssetSwitching ? 'opacity-70' : 'opacity-100'
            }`}
          >
            <div className="space-y-6">
              <div className="space-y-4">
                <p className={`max-w-2xl font-heading text-4xl font-semibold leading-none sm:text-5xl lg:text-6xl ${headingClass}`}>
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
                            ? isDark
                              ? 'bg-white text-ink'
                              : 'bg-[#182231] text-[#fffaf3]'
                            : inactivePillClass
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
                <p className={`max-w-2xl text-sm leading-7 sm:text-base ${softTextClass}`}>
                  当前视图聚焦 {activeAsset.name}。换手率 = 该时点 24 小时成交量 / 该时点市值。
                  数据唯一来源是 CoinGecko，后端按小时级历史快照入库，并在后台每 1 小时自动补最近数据。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  isDark={isDark}
                  label={`${activeAsset.symbol} 最新价格`}
                  value={latest ? formatCurrency(latest.priceUsd) : '--'}
                  detail={latest ? formatTimestamp(latest.timestamp) : '后台正在准备数据'}
                />
                <MetricCard
                  isDark={isDark}
                  label="最新换手率"
                  value={latest ? formatPercent(latest.turnoverRate) : '--'}
                  detail={
                    latest
                      ? `${formatCompactNumber(latest.volume24hUsd)} / ${formatCompactNumber(latest.marketCapUsd)}`
                      : '24h 成交量 / 市值'
                  }
                />
                <MetricCard
                  isDark={isDark}
                  label="覆盖区间"
                  value={summary ? `${summary.totalRows.toLocaleString()} 条` : '--'}
                  detail={formatCoverage(summary?.coverageStart ?? null, summary?.coverageEnd ?? null)}
                />
              </div>
            </div>

            <aside className={`space-y-4 rounded-[1.75rem] border p-5 backdrop-blur transition-colors duration-200 ${asideClass}`}>
              <div className="relative">
                <p className={`text-xs uppercase tracking-[0.28em] ${mutedTextClass}`}>Background refresh</p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className={`font-heading text-2xl ${headingClass}`}>后台自动同步</h2>
                  <button
                    aria-expanded={showSyncHelp}
                    aria-haspopup="dialog"
                    aria-label="查看自动同步说明"
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition ${inactivePillClass}`}
                    onClick={() => setShowSyncHelp((value) => !value)}
                    type="button"
                  >
                    ?
                  </button>
                </div>

                {showSyncHelp ? (
                  <div
                    className={`absolute right-0 top-14 z-20 w-[min(26rem,calc(100vw-4rem))] rounded-2xl border p-4 text-left text-sm leading-7 ${popoverClass}`}
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
                  isDark={isDark}
                  label="当前币种"
                  value={`${activeAsset.symbol} · ${activeAsset.name}`}
                />
                <DataRow
                  isDark={isDark}
                  label="最近快照时间"
                  value={latest ? formatTimestamp(latest.timestamp) : '--'}
                />
                <DataRow
                  isDark={isDark}
                  label="24h 成交量"
                  value={latest ? formatCompactNumber(latest.volume24hUsd) : '--'}
                />
                <DataRow
                  isDark={isDark}
                  label="当前市值"
                  value={latest ? formatCompactNumber(latest.marketCapUsd) : '--'}
                />
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </aside>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className={`rounded-[1.75rem] border p-5 shadow-xl transition-colors duration-200 ${panelClass}`}>
            <div className={`mb-5 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between ${borderClass}`}>
              <div>
                <p className={`text-xs uppercase tracking-[0.28em] ${mutedTextClass}`}>Price vs turnover</p>
                <h2 className={`mt-2 font-heading text-2xl ${headingClass}`}>{activeAsset.symbol} 小时级走势图</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      range === option
                        ? isDark
                          ? 'bg-amber text-ink'
                          : 'bg-[#182231] text-[#fffaf3]'
                        : inactivePillClass
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
                <ChartPlaceholder isDark={isDark} label="正在加载图表..." />
              ) : chartData && chartData.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData.points}>
                    <defs>
                      <linearGradient id="turnoverFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#ffb84d" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ffb84d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGrid} vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      minTickGap={24}
                      stroke={chartAxis}
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
                    <Tooltip content={<ChartTooltip assetSymbol={activeAsset.symbol} isDark={isDark} />} />
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
                <ChartPlaceholder isDark={isDark} label="后台正在准备图表数据。" />
              )}
            </div>

            {chartData?.meta.sampled ? (
              <p className={`mt-4 text-sm ${mutedTextClass}`}>
                当前图表从 {chartData.meta.totalPoints.toLocaleString()} 个原始小时点中抽样展示
                {` ${chartData.points.length.toLocaleString()} `}个点，数据库仍保留完整小时级记录。
              </p>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className={`relative rounded-[1.75rem] border p-5 shadow-xl transition-colors duration-200 ${panelClass}`}>
              <p className={`text-xs uppercase tracking-[0.28em] ${mutedTextClass}`}>Coverage</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className={`font-heading text-2xl ${headingClass}`}>数据密度</h2>
                <button
                  aria-expanded={showCoverageHelp}
                  aria-haspopup="dialog"
                  aria-label="查看数据说明"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition ${inactivePillClass}`}
                  onClick={() => setShowCoverageHelp((value) => !value)}
                  type="button"
                >
                  ?
                </button>
              </div>

              {showCoverageHelp ? (
                <div
                  className={`absolute right-5 top-20 z-20 w-[min(24rem,calc(100vw-4rem))] rounded-2xl border p-4 text-left text-sm leading-7 ${popoverClass}`}
                  role="dialog"
                >
                  <p>价格、24h 成交量和市值都来自同一个 CoinGecko 历史时间点快照。</p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <DataRow
                  isDark={isDark}
                  label="最早记录"
                  value={summary?.coverageStart ? formatTimestamp(summary.coverageStart) : '--'}
                />
                <DataRow
                  isDark={isDark}
                  label="最新记录"
                  value={summary?.coverageEnd ? formatTimestamp(summary.coverageEnd) : '--'}
                />
                <DataRow
                  isDark={isDark}
                  label="累计小时点"
                  value={summary ? `${summary.totalRows.toLocaleString()} 条` : '--'}
                />
                <DataRow
                  isDark={isDark}
                  label="当前浏览区间"
                  value={chartData ? `${chartData.points.length.toLocaleString()} 点` : '--'}
                />
              </div>
            </div>

            <div className={`rounded-[1.75rem] border p-5 shadow-xl transition-colors duration-200 ${panelClass}`}>
              <p className={`text-xs uppercase tracking-[0.28em] ${mutedTextClass}`}>Formula</p>
              <h2 className={`mt-2 font-heading text-2xl ${headingClass}`}>换手率定义</h2>
              <div className={`mt-4 space-y-3 text-sm leading-7 ${softTextClass}`}>
                <p
                  className={`rounded-2xl border px-4 py-3 font-mono ${
                    isDark ? 'text-amber-100' : 'text-[#8a4d10]'
                  } ${surfaceClass}`}
                >
                  turnoverRate = totalVolume(24h) / marketCap
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`rounded-[1.75rem] border p-5 shadow-xl transition-colors duration-200 ${panelClass}`}>
          <div className={`mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between ${borderClass}`}>
            <div>
              <p className={`text-xs uppercase tracking-[0.28em] ${mutedTextClass}`}>Recent rows</p>
              <h2 className={`mt-2 font-heading text-2xl ${headingClass}`}>最近60小时快照</h2>
            </div>
            <p className={`text-sm ${mutedTextClass}`}>
              当前第 {recentData?.meta.page ?? 1} / {recentData?.meta.totalPages ?? 1} 页
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeaderClass}>
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
                    className={`border-t transition-colors duration-200 ${
                      isDark ? 'text-sand/82' : 'text-[#1f2b3d]'
                    } ${lineBorderClass} ${
                      index % 2 === 0 ? rowEvenClass : rowOddClass
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
            <p className={`text-sm ${mutedTextClass}`}>
              每页 {recentData?.meta.pageSize ?? PAGE_SIZE} 条，共展示最近 {recentData?.meta.windowSize ?? 0} 条快照。
            </p>
            <div className="flex items-center gap-2">
              <button
                className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35 ${inactivePillClass}`}
                disabled={!recentData || recentData.meta.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <button
                className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35 ${inactivePillClass}`}
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

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2.75V5.25M12 18.75V21.25M21.25 12H18.75M5.25 12H2.75M18.54 5.46L16.77 7.23M7.23 16.77L5.46 18.54M18.54 18.54L16.77 16.77M7.23 7.23L5.46 5.46"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M14.5 3.25C10 4.05 6.75 7.96 6.75 12.5C6.75 17.63 10.87 21.75 16 21.75C18.12 21.75 20.08 21.05 21.64 19.87C17.21 19.59 13.75 15.95 13.75 11.43C13.75 8.45 15.25 5.79 17.56 4.19C16.61 3.54 15.6 3.23 14.5 3.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ChartPlaceholder({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <div
      className={`flex h-full items-center justify-center rounded-[1.5rem] border border-dashed text-sm ${
        isDark
          ? 'border-white/10 bg-white/[0.03] text-sand/55'
          : 'border-[#d8c7af]/80 bg-white/70 text-[#6b6257]'
      }`}
    >
      {label}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  isDark,
}: {
  label: string
  value: string
  detail: string
  isDark: boolean
}) {
  return (
    <div
      className={`rounded-[1.5rem] border p-4 backdrop-blur transition-colors duration-200 ${
        isDark
          ? 'border-white/10 bg-black/18'
          : 'border-[#d8c7af]/70 bg-white/72'
      }`}
    >
      <p className={`text-xs uppercase tracking-[0.28em] ${isDark ? 'text-sand/50' : 'text-[#6b6257]'}`}>{label}</p>
      <p className={`mt-3 font-heading text-3xl ${isDark ? 'text-white' : 'text-[#142032]'}`}>{value}</p>
      <p className={`mt-2 text-sm ${isDark ? 'text-sand/58' : 'text-[#4d5664]'}`}>{detail}</p>
    </div>
  )
}

function DataRow({
  label,
  value,
  isDark,
}: {
  label: string
  value: string
  isDark: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-colors duration-200 ${
        isDark
          ? 'border-white/8 bg-white/[0.03]'
          : 'border-[#d8c7af]/70 bg-[#fffaf1]'
      }`}
    >
      <span className={isDark ? 'text-sand/55' : 'text-[#6b6257]'}>{label}</span>
      <span className={`font-medium text-right ${isDark ? 'text-white' : 'text-[#142032]'}`}>{value}</span>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  assetSymbol,
  isDark,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; name: string }>
  label?: string
  assetSymbol: 'BTC' | 'ETH'
  isDark: boolean
}) {
  if (!active || !payload || !payload.length || !label) {
    return null
  }

  const pricePoint = payload.find((item) => item.dataKey === 'priceUsd')
  const turnoverPoint = payload.find((item) => item.dataKey === 'turnoverRate')

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
        isDark
          ? 'border-white/10 bg-[#06111e]/95 text-sand'
          : 'border-[#d8c7af]/80 bg-[#fffaf1] text-[#1f2b3d]'
      }`}
    >
      <p className={`mb-3 ${isDark ? 'text-sand/55' : 'text-[#6b6257]'}`}>{formatTimestamp(label)}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-8">
          <span className={isDark ? 'text-sand/60' : 'text-[#6b6257]'}>{pricePoint?.name ?? `${assetSymbol} 价格`}</span>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-[#142032]'}`}>
            {formatCurrency(pricePoint?.value ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <span className={isDark ? 'text-sand/60' : 'text-[#6b6257]'}>{turnoverPoint?.name ?? '换手率'}</span>
          <span className="font-medium text-amber-100">
            {formatPercent(turnoverPoint?.value ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
