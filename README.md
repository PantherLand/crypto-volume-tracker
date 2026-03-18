# BTC / ETH Hourly Turnover Tracker

一个本地运行的加密货币追踪站点，展示 `BTC` 和 `ETH` 的每小时价格、24 小时成交量、市值，以及基于 CoinGecko 历史快照计算出的换手率。

换手率公式：

```text
turnoverRate = totalVolume(24h) / marketCap
```

## 技术栈

- 前端：React + Vite + Tailwind CSS
- 后端：Express
- 数据库：PostgreSQL + Prisma
- 数据来源：CoinGecko

## 当前能力

- 支持 `BTC` 和 `ETH` 两个币种切换
- 展示小时级价格与换手率走势图
- 展示最近 `50` 条小时快照，并支持分页
- 后端服务启动后会自动检查最近数据
- 后端每 `1` 小时自动补一次最新数据
- 原始小时快照会持久化到本地 PostgreSQL

## 目录结构

```text
src/               前端页面
server/            Express API 与 CoinGecko 同步逻辑
scripts/           手动同步脚本
prisma/            Prisma schema
```

## 环境变量

项目使用本地 `.env`：

```env
DATABASE_URL="postgresql://postgres:881122@localhost:5432/volume_track"
COINGECKO_API_KEY="your-coingecko-api-key"
PORT="3001"
```

参考模板见 [`.env.example`](/Users/fangxingzhou/dev/aicode/volume_track/.env.example)。

## 安装与启动

安装依赖：

```bash
npm install
```

初始化数据库：

```bash
npm run db:push
```

启动前后端开发环境：

```bash
npm run dev
```

默认端口：

- 前端：`5173`
- 后端：`3001`

Vite 开发时会把 `/api` 代理到本地后端。

## 手动同步

虽然前端不再暴露同步按钮，但你仍然可以在命令行手动触发。

同步最近区间：

```bash
npm run sync:recent
```

触发全量补数：

```bash
npm run sync:full
```

## 生产运行

构建前端：

```bash
npm run build
```

启动服务：

```bash
npm run server
```

## API 概览

- `GET /api/assets`
- `GET /api/summary?asset=bitcoin`
- `GET /api/hourly?asset=bitcoin&range=30d`
- `GET /api/recent?asset=ethereum&page=2&pageSize=10&window=50`
- `GET /api/health`

## 数据限制

当前使用的是 CoinGecko demo key。根据 CoinGecko 当前限制，在 `2026-03-18` 这一天：

- demo key 只能查询最近 `365` 天内的历史数据
- 因此可以正常拉最近 30 天、90 天、1 年数据
- 不能通过 demo key 获取 BTC 自 `2010` 年起、ETH 自 `2015` 年起的完整小时级历史

如果需要完整历史，请更换为 CoinGecko 更高权限的付费 key。

## 已验证命令

以下命令已经在本项目中跑通过：

```bash
npm run db:push -- --accept-data-loss
npm run sync:recent
npm run build
npm run lint
```
