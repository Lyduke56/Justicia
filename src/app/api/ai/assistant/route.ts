import { NextRequest, NextResponse } from 'next/server';
import { classifyLegalIssue, retrieveLegalChunks } from '@/lib/ai/retrieval';
import { chatCompletion } from '@/lib/ai/llmClient';

/**
 * AI Legal Assistant — RAG Chat Endpoint
 *
 * RAG Pipeline (stubbed):
 *   1. Classify the legal issue category
 *   2. Retrieve relevant legal source chunks (pgvector similarity search)
 *   3. Build a grounded prompt with retrieved context
 *   4. Call LLM for response generation
 *   5. Attach Philippine legal disclaimer
 *   6. Determine if case should be escalated to a lawyer
 *
 * Returns a stable contract so the frontend can be built before the real pipeline is wired in.
 *
 * TODO: Add streaming support (ReadableStream / SSE)
 * TODO: Persist messages to the `messages` table
 * TODO: Rate limiting per user
 * TODO: Auth guard: only authenticated users
 */

interface AssistantRequest {
  conversationId: string;
  message: string;
}

interface Citation {
  sourceId: string;
  title: string;
  citation: string;
  excerpt: string;
}

interface AssistantResponse {
  text: string;
  citations: Citation[];
  disclaimer: string;
  escalate: boolean;
  category: string;
}

const DISCLAIMER =
  'The information provided is for general informational purposes only and does not constitute legal advice. ' +
  'Justicia is not a law firm. Please consult a licensed Philippine attorney for advice specific to your situation. ' +
  'Ang impormasyong ibinibigay ay para lamang sa pangkalahatang kaalaman at hindi bumubuo ng legal na payo.';

export async function POST(request: NextRequest): Promise<NextResponse<AssistantResponse>> {
  try {
    const body = (await request.json()) as AssistantRequest;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { text: '', citations: [], disclaimer: DISCLAIMER, escalate: false, category: 'unknown' },
        { status: 400 }
      );
    }

    // Step 1: Classify legal issue
    const category = await classifyLegalIssue(body.message);

    // Step 2: Retrieve relevant legal chunks
    const chunks = await retrieveLegalChunks(body.message, 5);

    // Step 3: Build context prompt
    const contextText = chunks
      .map((c) => `[${c.citation}] ${c.excerpt}`)
      .join('\n\n');

    // Step 4: Generate response (stubbed)
    const llmResponse = await chatCompletion([
      {
        role: 'system',
        content: `You are a Philippine legal assistant. Answer questions using only the provided legal sources. 
        Always cite your sources. If you cannot answer from the sources, say so.
        Category: ${category}\n\nSources:\n${contextText}`,
      },
      { role: 'user', content: body.message },
    ]);

    // Step 5: Determine escalation
    // TODO: Implement smarter escalation logic (urgent cases, criminal matters, immediate danger)
    const urgentKeywords = ['arrested', 'detained', 'criminal', 'emergency', 'urgent', 'eviction'];
    const escalate = urgentKeywords.some((kw) =>
      body.message.toLowerCase().includes(kw)
    );

    const response: AssistantResponse = {
      text: llmResponse.text,
      citations: chunks.map((c) => ({
        sourceId: c.sourceId,
        title: c.title,
        citation: c.citation,
        excerpt: c.excerpt,
      })),
      disclaimer: DISCLAIMER,
      escalate,
      category,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[/api/ai/assistant] Error:', error);
    return NextResponse.json(
      {
        text: 'An error occurred while processing your request. Please try again.',
        citations: [],
        disclaimer: DISCLAIMER,
        escalate: false,
        category: 'error',
      },
      { status: 500 }
    );
  }
}

// GET for health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/ai/assistant',
    note: 'POST with { conversationId, message } to get a legal AI response',
    stubbed: true,
  });
}
