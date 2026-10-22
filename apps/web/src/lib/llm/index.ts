import type { KnowledgeBase } from '@smart-spend/engine';
import { describeAnthropicError, parseIntentAnthropic } from './anthropic';
import { localParse } from './local';
import { describeOpenAIError, OPENAI_MODEL, parseIntentOpenAI, searchOffersOpenAI } from './openai';
import type { IntentParseResult, OfferSearchFailure, OfferSearchResult, ProviderName } from './types';

export { fuzzyBrand, localParse } from './local';
export * from './types';

/** LLM_PROVIDER=openai|anthropic|local; otherwise picked from the keys present. */
export function activeProvider(): ProviderName {
  const forced = process.env.LLM_PROVIDER as ProviderName | undefined;
  if (forced === 'openai' || forced === 'anthropic' || forced === 'local') return forced;
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'local';
}

export function providerLabel(): string {
  const p = activeProvider();
  if (p === 'openai') return `OpenAI ${OPENAI_MODEL}`;
  if (p === 'anthropic') return 'Claude';
  return 'the local parser';
}

export async function parseIntent(message: string, kb: KnowledgeBase): Promise<IntentParseResult> {
  const provider = activeProvider();
  if (provider === 'local') return { parsed: localParse(message, kb), provider: 'local' };
  try {
    const parsed = provider === 'openai' ? await parseIntentOpenAI(message, kb) : await parseIntentAnthropic(message, kb);
    if (parsed) return { parsed, provider };
    return { parsed: localParse(message, kb), provider: 'local', warning: 'The model returned no parse; used the local parser.' };
  } catch (err) {
    const why = provider === 'openai' ? describeOpenAIError(err) : describeAnthropicError(err);
    return { parsed: localParse(message, kb), provider: 'local', warning: `${why}; used the local parser.` };
  }
}

/** Live web research for a brand's gift card discounts and bank offers. OpenAI only. */
export async function searchOffersOnline(brandId: string, kb: KnowledgeBase): Promise<OfferSearchResult | OfferSearchFailure> {
  const brand = kb.brands.find((b) => b.id === brandId);
  if (!brand) return { ok: false, error: 'Unknown brand.' };
  if (activeProvider() !== 'openai') {
    return { ok: false, error: 'Web search needs the OpenAI provider. Set OPENAI_API_KEY (and optionally OPENAI_MODEL) in the environment.' };
  }
  try {
    return await searchOffersOpenAI(brand, kb);
  } catch (err) {
    return { ok: false, error: describeOpenAIError(err) };
  }
}
