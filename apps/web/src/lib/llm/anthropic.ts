import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { KnowledgeBase } from '@smart-spend/engine';
import { ParsedIntentSchema, type ParsedIntent } from './types';

/** Claude via the Anthropic SDK; used only when LLM_PROVIDER=anthropic or no OpenAI key is set. */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

export function describeAnthropicError(err: unknown): string {
  return err instanceof Anthropic.APIError ? `Anthropic error ${err.status}` : err instanceof Error ? err.message : 'request failed';
}

export async function parseIntentAnthropic(message: string, kb: KnowledgeBase): Promise<ParsedIntent | null> {
  const client = new Anthropic();
  const brandList = kb.brands.map((b) => `${b.name} (${b.category})`).join(', ');
  const response = await client.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    output_config: { effort: 'low', format: zodOutputFormat(ParsedIntentSchema) },
    system:
      'You extract a purchase intent from a short message written by an Indian credit card user who wants the cheapest way to pay. ' +
      `Known brands: ${brandList}. ` +
      'brandQuery: the matching known brand name, else the merchant named in the message, else null. ' +
      'amount: the bill in rupees as a number ("12k" = 12000, "1.5 lakh" = 150000), else null. ' +
      'channel: "offline" for a physical store/showroom/shop, "online" for a website or app, "upi" only if they say they will pay by UPI, null if unclear. ' +
      'inStoreNow: true only if they are at the store right now.',
    messages: [{ role: 'user', content: message }],
  });
  if (response.stop_reason === 'refusal') return null;
  return response.parsed_output ?? null;
}
