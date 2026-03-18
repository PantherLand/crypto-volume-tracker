import process from 'node:process'
import { PrismaClient } from '@prisma/client'

process.loadEnvFile?.()

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__volumeTrackPrisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__volumeTrackPrisma = prisma
}
