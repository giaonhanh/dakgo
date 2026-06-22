// Layer 5: AI Extractor — calls AIProvider adapter (NOT Grok directly)
import { getProvider } from '../providers'
import type { AIExtraction } from '../types'

export async function extractFromMessage(
  message: string,
  contextSummary: string,
): Promise<AIExtraction> {
  const provider = getProvider()
  return provider.extract(message, contextSummary)
}
