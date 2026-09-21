/**
 * LLM Provider Client Stub
 *
 * Wraps an OpenAI-compatible HTTP API. All calls MUST be made server-side.
 * Replace the stub implementation with a real fetch call once LLM_API_KEY
 * and LLM_PROVIDER_BASE_URL are configured.
 *
 * TODO: Wire up actual LLM provider (e.g. OpenAI, Groq, Gemini-compatible endpoint)
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  finishReason: string;
  tokensUsed: number;
}

/**
 * Sends a chat completion request to the configured LLM provider.
 * Currently returns a stub response.
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  // TODO: Replace stub with real OpenAI-compatible fetch
  // const response = await fetch(`${process.env.LLM_PROVIDER_BASE_URL}/chat/completions`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'gpt-4o',
  //     messages,
  //     temperature: options?.temperature ?? 0.3,
  //     max_tokens: options?.maxTokens ?? 1024,
  //   }),
  // });
  // const data = await response.json();
  // return { text: data.choices[0].message.content, finishReason: data.choices[0].finish_reason, tokensUsed: data.usage.total_tokens };

  console.log('[LLM Stub] chatCompletion called with', messages.length, 'messages', options);
  return {
    text: '[STUB] This is a placeholder LLM response. The real LLM pipeline is not yet wired in.',
    finishReason: 'stop',
    tokensUsed: 0,
  };
}
