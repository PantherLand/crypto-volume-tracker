# BTC / ETH Hourly Turnover Tracker

A local crypto tracking site that displays hourly `BTC` and `ETH` price, 24-hour volume, market cap, and a turnover rate derived from CoinGecko historical snapshots.

Turnover formula:

```text
turnoverRate = totalVolume(24h) / marketCap
```

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Express
- Database: PostgreSQL + Prisma
- Data source: CoinGecko

## Current Features

- Supports switching between `BTC` and `ETH`
- Shows hourly price and turnover charts
- Shows the latest `50` hourly snapshots with pagination
- Automatically checks recent data when the backend starts
- Automatically refreshes recent data every `1` hour in the background
- Persists raw hourly snapshots in local PostgreSQL

## Project Structure

```text
src/               Frontend app
server/            Express API and CoinGecko sync logic
scripts/           Manual sync scripts
prisma/            Prisma schema
```

## Environment Variables

The project uses a local `.env` file:

```env
DATABASE_URL="postgresql://postgres:881122@localhost:5432/volume_track"
COINGECKO_API_KEY="your-coingecko-api-key"
PORT="3001"
```

See [`.env.example`](/Users/fangxingzhou/dev/aicode/volume_track/.env.example) for the template.

## Install And Run

Install dependencies:

```bash
npm install
```

Initialize the database:

```bash
npm run db:push
```

Start the frontend and backend in development mode:

```bash
npm run dev
```

Default ports:

- Frontend: `5173`
- Backend: `3001`

During development, Vite proxies `/api` requests to the local backend.

## Manual Sync

The frontend no longer exposes sync buttons, but you can still trigger sync jobs from the command line.

Sync the recent range:

```bash
npm run sync:recent
```

Backfill the most recent 365 days:

```bash
npm run sync:365d
```

Trigger a full backfill:

```bash
npm run sync:full
```

## Production Run

Build the frontend:

```bash
npm run build
```

Start the server:

```bash
npm run server
```

## API Overview

- `GET /api/assets`
- `GET /api/summary?asset=bitcoin`
- `GET /api/hourly?asset=bitcoin&range=30d`
- `GET /api/recent?asset=ethereum&page=2&pageSize=10&window=50`
- `GET /api/health`

## Data Limits

This project is currently using a CoinGecko demo key. Under CoinGecko's current limits as of `2026-03-18`:

- A demo key can only query historical data from the most recent `365` days
- Recent `30d`, `90d`, and `1y` ranges work normally
- Full hourly history for BTC since `2010` and ETH since `2015` is not available with a demo key

If you need full historical coverage, replace the demo key with a higher-tier paid CoinGecko key.

As of `2026-03-18`, `npm run sync:365d` is the practical maximum historical backfill available with the current demo key. In practice, that means roughly `2025-03-18` onward.

## Verified Commands

The following commands have already been run successfully in this project:

```bash
npm run db:push -- --accept-data-loss
npm run sync:recent
npm run build
npm run lint
```
