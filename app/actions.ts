"use server"

import { analyzeSignal } from '@/lib/analysis/ai'

export async function analyzeSignalAction(headline: string, content: string) {
  return await analyzeSignal(headline, content)
}
