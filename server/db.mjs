import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import { loadLocalEnv } from './env.mjs'

loadLocalEnv()

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__volumeTrackPrisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__volumeTrackPrisma = prisma
}
